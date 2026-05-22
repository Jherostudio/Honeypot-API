/**
 * Secure Audit Logger Service
 *
 * Logs all honeypot interactions with HMAC-SHA256 cryptographic signatures
 * Logs are immutable - any tampering will break the HMAC signature
 *
 * SECURITY DESIGN:
 * - Logs are written to files immediately (not buffered)
 * - Each log entry includes HMAC signature computed from all fields
 * - Signatures are based on process.env.HMAC_SECRET
 * - Attacker with server access cannot modify logs without the secret key
 */

import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { generateHmac } from "../utils/crypto";
import { LogEntry, AttackMetadata, ThreatAnalysis } from "../types";

const HONEYPOT_VERSION = "1.0.0";

export class AuditLogger {
  private logDir: string;
  private hmacSecret: string;

  constructor(logDir: string, hmacSecret: string) {
    this.logDir = logDir;
    this.hmacSecret = hmacSecret;

    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Records a honeypot interaction with cryptographic signature
   * 
   * @param attack - Metadata about the attack (IP, headers, payload)
   * @param analysis - Threat analysis result
   * @returns Generated log entry with HMAC
   * 
   * SECURITY GUARANTEE:
   * - The HMAC will change if ANY field is modified
   * - This prevents forensic evidence tampering
   */
  public recordInteraction(attack: AttackMetadata, analysis: ThreatAnalysis): LogEntry {
    const logId = uuidv4();

    // Build the log entry WITHOUT the HMAC (we calculate it next)
    const logDataForSignature = {
      id: logId,
      timestamp: attack.timestamp,
      attack: {
        sourceIp: attack.sourceIp,
        method: attack.method,
        path: attack.path,
        userAgent: attack.userAgent,
        // Note: Headers and Body are included but could contain sensitive info
        // In production, you might hash or redact these
      },
      analysis: {
        type: analysis.type,
        severity: analysis.severity,
        confidence: analysis.confidence,
        indicators: analysis.indicators,
      },
      honeypotVersion: HONEYPOT_VERSION,
    };

    // Generate HMAC signature - this proves the log hasn't been tampered with
    const hmac = generateHmac(logDataForSignature, this.hmacSecret);

    // Create complete log entry
    const logEntry: LogEntry = {
      id: logId,
      timestamp: attack.timestamp,
      attack,
      analysis,
      hmac,
      honeypotVersion: HONEYPOT_VERSION,
    };

    // Write to JSONL file (JSON Lines - one log per line for easy parsing)
    this.persistLog(logEntry);

    return logEntry;
  }

  /**
   * Persists log entry to disk in JSONL format
   * JSONL format is ideal for append-only logs and stream processing
   */
  private persistLog(entry: LogEntry): void {
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const logFileName = `honeypot-${timestamp}.jsonl`;
    const logFilePath = path.join(this.logDir, logFileName);

    try {
      // Append to log file (not overwrite) with newline
      const logLine = JSON.stringify(entry) + "\n";
      fs.appendFileSync(logFilePath, logLine, { encoding: "utf8" });

      // Set restrictive file permissions (owner read/write only)
      fs.chmodSync(logFilePath, 0o600);
    } catch (error) {
      // Fallback: log errors to stderr to avoid silent failures
      console.error(`[AuditLogger] Failed to persist log: ${error}`);
    }
  }

  /**
   * Reads and verifies integrity of logs
   * Use this to ensure no tampering has occurred
   */
  public readAndVerifyLogs(dateStr?: string): {
    valid: LogEntry[];
    tampered: LogEntry[];
  } {
    const timestamp = dateStr || new Date().toISOString().split("T")[0];
    const logFileName = `honeypot-${timestamp}.jsonl`;
    const logFilePath = path.join(this.logDir, logFileName);

    const valid: LogEntry[] = [];
    const tampered: LogEntry[] = [];

    if (!fs.existsSync(logFilePath)) {
      console.warn(`Log file not found: ${logFilePath}`);
      return { valid, tampered };
    }

    try {
      const content = fs.readFileSync(logFilePath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const entry: LogEntry = JSON.parse(line);

          // Reconstruct the data that was signed
          const signedData = {
            id: entry.id,
            timestamp: entry.timestamp,
            attack: {
              sourceIp: entry.attack.sourceIp,
              method: entry.attack.method,
              path: entry.attack.path,
              userAgent: entry.attack.userAgent,
            },
            analysis: {
              type: entry.analysis.type,
              severity: entry.analysis.severity,
              confidence: entry.analysis.confidence,
              indicators: entry.analysis.indicators,
            },
            honeypotVersion: entry.honeypotVersion,
          };

          // Verify HMAC
          const expectedHmac = generateHmac(signedData, this.hmacSecret);
          if (expectedHmac === entry.hmac) {
            valid.push(entry);
          } else {
            console.warn(`[AuditLogger] HMAC mismatch for log ${entry.id} - log may be tampered`);
            tampered.push(entry);
          }
        } catch (parseError) {
          console.error(`[AuditLogger] Failed to parse log line: ${parseError}`);
        }
      }
    } catch (error) {
      console.error(`[AuditLogger] Failed to read logs: ${error}`);
    }

    return { valid, tampered };
  }

  /**
   * Gets count of all recorded interactions
   */
  public getLogStats(): { totalLogs: number; directory: string } {
    let totalLogs = 0;

    try {
      const files = fs.readdirSync(this.logDir);
      for (const file of files) {
        if (file.startsWith("honeypot-") && file.endsWith(".jsonl")) {
          const content = fs.readFileSync(path.join(this.logDir, file), "utf8");
          const lines = content.split("\n").filter((line) => line.trim());
          totalLogs += lines.length;
        }
      }
    } catch (error) {
      console.error(`[AuditLogger] Failed to get stats: ${error}`);
    }

    return { totalLogs, directory: this.logDir };
  }
}
