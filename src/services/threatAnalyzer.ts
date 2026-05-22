/**
 * Threat Detection & Analysis Service
 *
 * Analyzes captured payloads for common attack patterns without executing them.
 * CRITICAL SECURITY: This service ONLY READS AND COMPARES - never executes attacker code
 */

import { ThreatType, ThreatAnalysis, ThreatSeverity } from "../types";

/** SQL Injection patterns - detects common SQLi techniques */
const SQL_INJECTION_PATTERNS = [
  /(\bOR\b|\bAND\b)\s*['"]?\s*1\s*['"]?\s*=\s*['"]?\s*1/i,
  /['\"];?\s*\bOR\b\s*['"]?1['"]?\s*=\s*['"]?1/i,
  /\bunion\b.+\bselect\b/i,
  /\bselect\b.+\bfrom\b.+\bwhere\b/i,
  /\bdrop\b\s+\b(table|database)\b/i,
  /\binsert\b\s+\binto\b/i,
  /\bupdate\b\s+\b.+\b(set|where)\b/i,
  /\bdelete\b\s+\bfrom\b/i,
  /\bexec\b\s*\(/i,
  /\bexecute\b\s*\(/i,
];

/** Path Traversal patterns - detects directory escape attempts */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.%2f/i,
  /\.\.\\(?:\\)?/g,
  /%2e%2e/i,
  /\.\.%5c/i,
  /\.\.\.\//g,
];

/** Command Injection patterns - detects shell command injection */
const COMMAND_INJECTION_PATTERNS = [
  /[;|`$&<>()]/,
  /\b(bash|sh|cmd|powershell|exec|system|spawn)\b/i,
  /`.*`/, // Backtick command substitution
  /\$\(.*\)/, // Command substitution
];

/** XSS patterns - detects cross-site scripting attempts */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/i,
  /javascript:/i,
  /on(load|error|click|mouse\w+)\s*=/i,
  /<iframe[^>]*>/i,
  /<img[^>]*onerror/i,
];

/** Common vulnerability scanner signatures */
const SCANNER_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /nessus/i,
  /openvas/i,
  /acunetix/i,
  /burp/i,
  /zaproxy/i,
];

/**
 * Main threat detection function
 * Analyzes payload against known attack patterns
 */
export function analyzeThreat(payload: string, path: string, method: string): ThreatAnalysis {
  const indicators: string[] = [];
  let highestThreat: { type: ThreatType; severity: ThreatSeverity; confidence: number } = {
    type: ThreatType.UNKNOWN,
    severity: ThreatSeverity.LOW,
    confidence: 0,
  };

  // SQL Injection Detection
  const sqlMatch = SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(payload));
  if (sqlMatch) {
    indicators.push("SQL_INJECTION_SYNTAX_DETECTED");
    highestThreat = {
      type: ThreatType.SQL_INJECTION,
      severity: ThreatSeverity.HIGH,
      confidence: 85,
    };
  }

  // Path Traversal Detection
  const pathTraversalMatch = PATH_TRAVERSAL_PATTERNS.some((pattern) =>
    pattern.test(path)
  );
  if (pathTraversalMatch) {
    indicators.push("PATH_TRAVERSAL_SEQUENCE_DETECTED");
    if (highestThreat.confidence < 80) {
      highestThreat = {
        type: ThreatType.PATH_TRAVERSAL,
        severity: ThreatSeverity.HIGH,
        confidence: 80,
      };
    }
  }

  // Command Injection Detection
  const commandMatch = COMMAND_INJECTION_PATTERNS.some((pattern) =>
    pattern.test(payload)
  );
  if (commandMatch) {
    indicators.push("COMMAND_SHELL_METACHARACTERS_DETECTED");
    if (highestThreat.confidence < 75) {
      highestThreat = {
        type: ThreatType.COMMAND_INJECTION,
        severity: ThreatSeverity.HIGH,
        confidence: 75,
      };
    }
  }

  // XSS Detection
  const xssMatch = XSS_PATTERNS.some((pattern) => pattern.test(payload));
  if (xssMatch) {
    indicators.push("XSS_PAYLOAD_DETECTED");
    if (highestThreat.confidence < 70) {
      highestThreat = {
        type: ThreatType.XSS_ATTEMPT,
        severity: ThreatSeverity.MEDIUM,
        confidence: 70,
      };
    }
  }

  // Scanner Detection
  const scannerMatch = SCANNER_PATTERNS.some((pattern) =>
    pattern.test(payload) || pattern.test(method)
  );
  if (scannerMatch) {
    indicators.push("AUTOMATED_SCANNER_DETECTED");
    if (highestThreat.confidence < 90) {
      highestThreat = {
        type: ThreatType.SCANNER,
        severity: ThreatSeverity.MEDIUM,
        confidence: 90,
      };
    }
  }

  // Bruteforce detection (multiple requests to sensitive endpoints)
  if (
    path.includes("/login") ||
    path.includes("/admin") ||
    path.includes("/auth")
  ) {
    indicators.push("SENSITIVE_ENDPOINT_TARGETED");
    if (highestThreat.type === ThreatType.UNKNOWN) {
      highestThreat = {
        type: ThreatType.BRUTEFORCE,
        severity: ThreatSeverity.MEDIUM,
        confidence: 60,
      };
    }
  }

  const reasoning =
    indicators.length > 0
      ? `Detected ${indicators.length} threat indicator(s): ${indicators.join(", ")}`
      : "No direct attack patterns detected, but endpoint is under honeypot surveillance";

  return {
    type: highestThreat.type,
    severity: highestThreat.severity,
    confidence: highestThreat.confidence,
    indicators,
    reasoning,
  };
}
