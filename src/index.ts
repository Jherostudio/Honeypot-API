/**
 * Main Application Entry Point
 *
 * Honeypot API - Active REST API Security Intelligence System
 *
 * PURPOSE:
 * - Attracts and logs malicious API requests
 * - Analyzes threat patterns without executing payloads
 * - Stores tamper-proof audit logs with HMAC signatures
 *
 * SECURITY GUARANTEES:
 * - No user input is ever executed (eval, exec, etc.)
 * - All payloads are analyzed as strings only
 * - Logs are cryptographically signed to prevent tampering
 * - Real database/file operations are never triggered by attacker input
 */

import express, { Express } from "express";
import dotenv from "dotenv";
import path from "path";
import { AuditLogger } from "./services/auditLogger";
import { createHoneypotMiddleware } from "./middlewares/honeypotCapture";
import { createRouter } from "./routes";

// Load environment variables
dotenv.config();

// ========== CONFIGURATION ==========

const PORT_ENV = process.env.PORT || "3000";
const PORT = parseInt(PORT_ENV, 10);
const HOST = process.env.HOST || "127.0.0.1";
const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "..", "logs");
const HMAC_SECRET = process.env.HMAC_SECRET;

// ========== VALIDATION ==========

if (!HMAC_SECRET) {
  console.error(
    "[ERROR] HMAC_SECRET not set in environment. Please set it before running."
  );
  console.error("        Create a .env file or set the environment variable.");
  process.exit(1);
}

if (HMAC_SECRET.length < 32) {
  console.warn(
    "[WARNING] HMAC_SECRET is shorter than 32 characters. Recommended: 64+ chars."
  );
}

// ========== INITIALIZE SERVICES ==========

// Create audit logger - handles all honeypot event logging with HMAC signatures
const auditLogger = new AuditLogger(LOG_DIR, HMAC_SECRET);

console.log(`[HONEYPOT] Initializing with log directory: ${LOG_DIR}`);

// ========== EXPRESS SETUP ==========

const app: Express = express();

// Store auditLogger in app locals for access by route handlers
app.locals.auditLogger = auditLogger;

/**
 * Middleware Setup Order (CRITICAL):
 * 1. JSON/URL-encoded body parsing (before capturing middleware)
 * 2. Honeypot capture middleware (intercepts ALL requests)
 * 3. Routes (honeypot traps)
 */

// Parse JSON bodies (needed for POST requests to auth endpoints)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// MAIN HONEYPOT DEFENSE: Capture all requests hitting fake endpoints
// This middleware:
// - Extracts metadata from the request
// - Analyzes the payload for threat patterns
// - Generates HMAC-signed log entry
// - Passes to next middleware (no modification of request/response)
app.use(createHoneypotMiddleware(auditLogger));

// Mount routes (honeypot traps + real endpoints)
app.use("/", createRouter());

// ========== ERROR HANDLING ==========

/**
 * Global error handler
 * Ensures attacker payloads never reach here with execution context
 */
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(`[ERROR] Unhandled exception: ${err.message}`);

    // Never expose stack traces to attacker
    res.status(500).json({
      error: "Internal Server Error",
      message:
        NODE_ENV === "development"
          ? err.message
          : "An unexpected error occurred",
    });
  }
);

// ========== SERVER STARTUP ==========

const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         🍯  HONEYPOT API - SECURITY INTELLIGENCE 🍯        ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Status: ACTIVE                                            ║
║  Endpoint: http://${HOST}:${PORT}                              ║
║  Environment: ${NODE_ENV}                                      ║
║  Log Directory: ${LOG_DIR}                        ║
║                                                            ║
║  Monitoring for:                                           ║
║  ✓ SQL Injection attempts                                 ║
║  ✓ Path traversal attacks                                 ║
║  ✓ Command injection payloads                             ║
║  ✓ XSS attack vectors                                     ║
║  ✓ Automated scanner fingerprints                         ║
║  ✓ Brute force patterns                                   ║
║                                                            ║
║  All threats logged with tamper-proof HMAC signatures     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log(`[HONEYPOT] Listening for malicious traffic...`);
  console.log(`[HEALTH] http://${HOST}:${PORT}/health`);
  console.log(`[STATS]  http://${HOST}:${PORT}/stats`);
});

// ========== GRACEFUL SHUTDOWN ==========

process.on("SIGTERM", () => {
  console.log("[HONEYPOT] SIGTERM received - shutting down gracefully");
  server.close(() => {
    console.log("[HONEYPOT] Server closed");

    // Print final stats
    const stats = auditLogger.getLogStats();
    console.log(`[STATS] Total interactions logged: ${stats.totalLogs}`);

    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[HONEYPOT] SIGINT received - shutting down");
  server.close(() => {
    console.log("[HONEYPOT] Server closed");
    process.exit(0);
  });
});

export default app;
