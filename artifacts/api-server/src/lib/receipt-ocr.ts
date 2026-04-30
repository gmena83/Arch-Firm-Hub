// Receipt OCR via PDF.co. Accepts a base64-encoded image or PDF, runs OCR,
// returns the extracted plain text plus a best-effort structured parse.

import { logger } from "./logger";

export interface OcrExtraction {
  text: string;
  vendor?: string;
  date?: string;
  amount?: number;
  hours?: number;
}

export interface OcrInput {
  fileBase64: string;
  filename: string;
}

const PDF_CO_BASE = "https://api.pdf.co/v1";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "tif", "tiff", "bmp", "webp"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function pdfcoFetch(path: string, apiKey: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${PDF_CO_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json["error"] === true) {
    const msg = (json["message"] as string) || `PDF.co request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

// Calls PDF.co to extract OCR text from a base64-encoded image or PDF.
export async function extractReceiptText(input: OcrInput, apiKey: string): Promise<string> {
  const ext = extOf(input.filename);
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isPdf = ext === "pdf";
  if (!isImage && !isPdf) {
    throw new Error(`Unsupported file type ".${ext}". Upload a PDF or image (PNG/JPG/etc.).`);
  }

  // 1. Upload file (base64) to PDF.co storage → get a temporary URL.
  const upload = await pdfcoFetch("/file/upload/base64", apiKey, {
    file: input.fileBase64,
    name: input.filename,
  });
  const uploadedUrl = upload["url"] as string | undefined;
  if (!uploadedUrl) throw new Error("PDF.co did not return an upload URL.");

  // 2. If image → convert to PDF first.
  let pdfUrl = uploadedUrl;
  if (isImage) {
    const conv = await pdfcoFetch("/pdf/convert/from/image", apiKey, {
      url: uploadedUrl,
      name: input.filename.replace(/\.[^.]+$/, "") + ".pdf",
      async: false,
    });
    const out = conv["url"] as string | undefined;
    if (!out) throw new Error("PDF.co did not return a PDF URL after image conversion.");
    pdfUrl = out;
  }

  // 3. Run OCR text extraction. inline:true returns the text in the response body.
  const text = await pdfcoFetch("/pdf/convert/to/text", apiKey, {
    url: pdfUrl,
    inline: true,
    async: false,
    ocrLanguage: "eng+spa",
  });
  const body = text["body"];
  if (typeof body !== "string") {
    throw new Error("PDF.co text conversion did not return a body.");
  }
  return body;
}

// Heuristic parse for vendor / date / amount / hours from receipt OCR text.
export function parseReceiptText(raw: string): Pick<OcrExtraction, "vendor" | "date" | "amount" | "hours"> {
  const text = raw.replace(/\u00a0/g, " ");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Vendor heuristic: first meaningful non-numeric line that doesn't look like
  // a header label (date/total/tel/etc.). Receipts almost always start with
  // the merchant name.
  const skip = /^(receipt|invoice|cash receipt|tel|phone|address|date|total|subtotal|customer|bill|order|ticket)\b/i;
  const vendor = lines.find((l) => l.length > 2 && !/^[\d\W]+$/.test(l) && !skip.test(l)) ?? lines[0];

  // Date heuristic: scan a few common formats.
  let date: string | undefined;
  const dateRe = /\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b|\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic)[a-zñ]*\s+\d{1,2},?\s+\d{4})\b/i;
  for (const l of lines) {
    const m = l.match(dateRe);
    if (m) {
      date = normalizeDate(m[0]);
      if (date) break;
    }
  }

  // Amount heuristic: prefer line tagged as "TOTAL"/"GRAND TOTAL"/"AMOUNT DUE",
  // ignoring "SUBTOTAL". Fallback to the largest dollar value in the body.
  let amount: number | undefined;
  const totalRe = /(?:grand\s*total|amount\s*due|balance\s*due|total\s*due|^total\b|\btotal\s*[:\-]|\btotal\s+\$)/i;
  const subtotalRe = /sub.?total/i;
  for (const l of [...lines].reverse()) {
    if (subtotalRe.test(l)) continue;
    if (totalRe.test(l)) {
      const m = l.match(/\$?\s*([\d,]+\.\d{2})/);
      if (m && m[1]) {
        amount = parseFloat(m[1].replace(/,/g, ""));
        break;
      }
    }
  }
  if (amount === undefined) {
    const all: number[] = [];
    const re = /\$?\s*([\d,]+\.\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat((m[1] ?? "").replace(/,/g, ""));
      if (isFinite(v) && v > 0) all.push(v);
    }
    if (all.length > 0) amount = Math.max(...all);
  }

  // Hours heuristic: explicit "X hours/hrs/horas". Scan line-by-line so we
  // never bridge across a newline (e.g. "$135.50\nHours: 6.5").
  let hours: number | undefined;
  const hoursAfter = /(\d+(?:\.\d+)?)[ \t]*(?:hours?|hrs?|horas?)\b/i;
  const hoursBefore = /\b(?:hours?|hrs?|horas?)\b[^\d\n]{0,30}(\d+(?:\.\d+)?)/i;
  for (const l of lines) {
    const m = l.match(hoursAfter) ?? l.match(hoursBefore);
    if (m && m[1]) {
      const v = parseFloat(m[1]);
      if (isFinite(v) && v > 0) { hours = v; break; }
    }
  }

  return { vendor, date, amount, hours };
}

function normalizeDate(input: string): string | undefined {
  const s = input.trim();
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY or DD-MM-YYYY etc.
  const dm = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dm) {
    const a = parseInt(dm[1] ?? "0", 10);
    const b = parseInt(dm[2] ?? "0", 10);
    let y = parseInt(dm[3] ?? "0", 10);
    if (y < 100) y += 2000;
    // Assume MM/DD/YYYY (US receipts most common). Swap if month > 12.
    let mo = a;
    let d = b;
    if (a > 12 && b <= 12) { mo = b; d = a; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
    return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }
  // Month-name forms — let Date parse it.
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return undefined;
}

export async function extractAndParseReceipt(input: OcrInput, apiKey: string): Promise<OcrExtraction> {
  const text = await extractReceiptText(input, apiKey);
  const parsed = parseReceiptText(text);
  logger.info({ vendor: parsed.vendor, date: parsed.date, amount: parsed.amount, hours: parsed.hours }, "receipt OCR parsed");
  return { text, ...parsed };
}
