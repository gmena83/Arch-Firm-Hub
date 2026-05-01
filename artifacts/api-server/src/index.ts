import app from "./app";
import { logger } from "./lib/logger";
import { installAsanaSync } from "./lib/asana-sync";

// Wire the optional Asana sync hook (Task #127). Stays a noop until an admin
// connects the Asana workspace in Settings → Integrations.
installAsanaSync();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
