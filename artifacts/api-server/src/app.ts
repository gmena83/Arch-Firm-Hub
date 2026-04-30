import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// 25mb body cap accommodates base64-encoded receipt photos / PDFs for OCR
// and the photo-upload data URLs added in #105. Browsers inflate raw bytes
// by ~33% in base64, so the 10MB client-side cap becomes ~13.4MB on the
// wire — comfortably under this limit.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
