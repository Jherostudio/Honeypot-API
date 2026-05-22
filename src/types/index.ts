/**
 * Type Definitions for Honeypot Security System
 * Defines interfaces for logs, threat detection, and cryptographic signatures
 */

/** Supported attack classification types */
export enum ThreatType {
  SQL_INJECTION = "SQL_INJECTION",
  PATH_TRAVERSAL = "PATH_TRAVERSAL",
  COMMAND_INJECTION = "COMMAND_INJECTION",
  XSS_ATTEMPT = "XSS_ATTEMPT",
  BRUTEFORCE = "BRUTEFORCE",
  CREDENTIAL_STUFFING = "CREDENTIAL_STUFFING",
  SCANNER = "SCANNER",
  UNKNOWN = "UNKNOWN",
}

/** Severity levels for detected threats */
export enum ThreatSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/** Metadata extracted from attacker request */
export interface AttackMetadata {
  timestamp: string;
  id: string;
  sourceIp: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  body: string | null;
  userAgent: string;
  referer: string | null;
}

/** Threat analysis result */
export interface ThreatAnalysis {
  type: ThreatType;
  severity: ThreatSeverity;
  confidence: number; // 0-100
  indicators: string[];
  reasoning: string;
}

/** Complete log entry with cryptographic integrity */
export interface LogEntry {
  id: string;
  timestamp: string;
  attack: AttackMetadata;
  analysis: ThreatAnalysis;
  hmac: string; // Cryptographic signature for tamper-detection
  honeypotVersion: string;
}

/** Response for honeypot fake endpoints */
export interface FakeResponse {
  status: number;
  body: Record<string, unknown>;
  delay?: number;
}
