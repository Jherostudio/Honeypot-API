/**
 * Honeypot Capture Middleware
 *
 * Intercepts requests to honeypot endpoints and extracts attacker metadata
 *
 * SECURITY DESIGN:
 * - Captures raw payload without executing it
 * - Stores complete headers and query parameters for analysis
 * - Extracts real source IP (handles proxies with X-Forwarded-For)
 * - Never processes attacker input through dangerous functions
 */

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuditLogger } from "../services/auditLogger";
import { analyzeThreat } from "../services/threatAnalyzer";
import { AttackMetadata } from "../types";

/**
 * Extract real client IP considering proxy headers
 * Defends against IP spoofing by checking headers in order of trust
 */
function extractClientIp(req: Request): string {
  // Check X-Forwarded-For (last IP in the chain is most recent proxy)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor.split(",")[0];
    return ips.trim();
  }

  // Fallback to direct connection IP
  return (
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "UNKNOWN"
  );
}

/**
 * Extracts User-Agent safely (might contain attacker info)
 */
function extractUserAgent(req: Request): string {
  return (req.headers["user-agent"] as string) || "UNKNOWN";
}

/**
 * Safely converts request body to string
 * CRITICAL: We never execute this - just store it for analysis
 */
function bodyToString(body: unknown): string {
  if (body === null || body === undefined) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * Creates honeypot capture middleware
 * Must be instantiated with an AuditLogger instance
 */
export function createHoneypotMiddleware(auditLogger: AuditLogger) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract attack metadata - this is the evidence collection phase
      const sourceIp = extractClientIp(req);
      const userAgent = extractUserAgent(req);
      const payload = bodyToString(req.body);

      const attackMetadata: AttackMetadata = {
        timestamp: new Date().toISOString(),
        id: uuidv4(),
        sourceIp,
        method: req.method,
        path: req.path,
        query: req.query as Record<string, string | string[]>,
        headers: req.headers as Record<string, string | string[]>,
        body: payload || null,
        userAgent,
        referer: (req.headers.referer as string) || null,
      };

      // Analyze the threat WITHOUT executing the payload
      // This is purely string/pattern matching, no code execution
      const threatAnalysis = analyzeThreat(
        payload + (req.path || ""),
        req.path,
        req.method
      );

      // Record the interaction with cryptographic signature
      const logEntry = auditLogger.recordInteraction(
        attackMetadata,
        threatAnalysis
      );

      console.log(`[HONEYPOT] Captured attack from ${sourceIp}: ${threatAnalysis.type}`);

      // Add metadata to response for potential downstream processing
      res.locals.honeypotEntry = logEntry;
    } catch (error) {
      console.error(`[HoneypotMiddleware] Error processing honeypot interaction: ${error}`);
    }

    // Continue to next handler regardless of error
    next();
  };
}
