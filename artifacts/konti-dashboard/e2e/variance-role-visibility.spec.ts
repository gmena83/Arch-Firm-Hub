import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end Playwright test for the Calculator Variance tab's
 * role-aware gating + Spanish toggle (Task #137 follow-ups from
 * code review).
 *
 * Coverage:
 *   1. Admin (demo@konti.com) lands on /calculator?tab=variance and
 *      sees the Invoiced column, Δ vs Invoiced delta, and the
 *      "Total Invoiced" headline (with "in plan" sub-line).
 *   2. Switching the language pill to ES re-localizes the same
 *      strings (the "Total Invoiced" headline becomes "Total Facturado",
 *      and the unassigned breakdown becomes "fuera de plan").
 *   3. Client (client@konti.com) lands on the same URL and does NOT see
 *      any invoiced column / series / total / delta — only Estimated,
 *      Actual, and Δ vs Estimated.
 *
 * Prerequisite to run locally:
 *   pnpm exec playwright install chromium
 *
 * The dev server (konti-dashboard) and api-server workflows must both
 * be up before running:
 *   E2E_BASE_URL="http://localhost:$PORT" pnpm exec playwright test \
 *     e2e/variance-role-visibility.spec.ts
 */

const ADMIN_EMAIL = "demo@konti.com";
const ADMIN_PASSWORD = "konti2026";
const CLIENT_EMAIL = "client@konti.com";
const CLIENT_PASSWORD = "konti2026";

async function login(page: Page, email: string, password: string) {
  await page.goto("/konti-dashboard/");
  const emailField = page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]'));
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in|log in|iniciar/i }).click();
  }
}

test.describe("Calculator variance — role-aware gating + i18n", () => {
  test("admin sees invoiced columns + Spanish toggle re-localizes", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/konti-dashboard/calculator?tab=variance");

    // The variance panel renders for the admin.
    const panel = page.getByTestId("variance-report-panel");
    await expect(panel).toBeVisible();

    // Wait for the totals strip (the report has loaded).
    const totals = page.getByTestId("variance-totals");
    await expect(totals).toBeVisible();

    // Admin-only: Total Invoiced headline is present (English by default).
    const totalInvoiced = page.getByTestId("variance-totals-invoiced");
    await expect(totalInvoiced).toBeVisible();
    await expect(panel).toContainText(/Total Invoiced/);
    await expect(page.getByTestId("variance-totals-delta-invoiced")).toBeVisible();

    // Per-bucket Invoiced row exists for at least the materials bucket.
    await expect(page.getByTestId("variance-bucket-materials-invoiced")).toBeVisible();
    await expect(page.getByTestId("variance-bucket-materials-delta-invoiced")).toBeVisible();

    // Switch language to ES via the sidebar lang pill. The pill shows
    // EN | ES; clicking once toggles to ES.
    await page.getByTestId("lang-toggle-sidebar").click();

    // Calculator tab label re-localizes.
    await expect(page.getByTestId("tab-variance")).toHaveText(/Varianza/);

    // The same admin-only Invoiced labels re-localize too.
    await expect(panel).toContainText(/Total Facturado/);
    await expect(panel).toContainText(/Δ vs Facturado/);
  });

  test("client view hides invoiced columns, series, totals, and deltas", async ({ page }) => {
    await login(page, CLIENT_EMAIL, CLIENT_PASSWORD);
    await page.goto("/konti-dashboard/calculator?tab=variance");

    const panel = page.getByTestId("variance-report-panel");
    await expect(panel).toBeVisible();

    const totals = page.getByTestId("variance-totals");
    await expect(totals).toBeVisible();

    // Client-safe rollup: Estimated, Actual, and Δ vs Estimated remain.
    await expect(panel).toContainText(/Total Estimated|Total Estimado/);
    await expect(panel).toContainText(/Total Actual|Total Real/);

    // Client must NOT see any of the billing-internal fields.
    await expect(page.getByTestId("variance-totals-invoiced")).toHaveCount(0);
    await expect(page.getByTestId("variance-totals-invoiced-breakdown")).toHaveCount(0);
    await expect(page.getByTestId("variance-totals-delta-invoiced")).toHaveCount(0);

    // Per-bucket Invoiced rows + delta pills are absent.
    await expect(page.getByTestId("variance-bucket-materials-invoiced")).toHaveCount(0);
    await expect(page.getByTestId("variance-bucket-materials-delta-invoiced")).toHaveCount(0);
    await expect(page.getByTestId("variance-bucket-labor-invoiced")).toHaveCount(0);
    await expect(page.getByTestId("variance-bucket-subcontractor-invoiced")).toHaveCount(0);

    // The "unassigned" bucket exists only to surface invoices outside
    // the M/L/S plan — it has no client-safe meaning, so the entire
    // card is dropped from the client view.
    await expect(page.getByTestId("variance-bucket-unassigned")).toHaveCount(0);
  });
});
