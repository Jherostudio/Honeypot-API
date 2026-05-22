# Honeypot API - Project Documentation

## Quick Reference Guide

### What This Project Does
This is an **active honeypot** - a security research tool that:
1. **Attracts attackers** with fake vulnerable endpoints
2. **Captures attack data** safely without running any malicious code
3. **Analyzes threats** using pattern matching
4. **Logs evidence** with cryptographic signatures to prevent tampering

### Why It's Safe
- ✓ No code execution (eval, exec, etc.)
- ✓ No real database queries
- ✓ No file system operations triggered by attackers
- ✓ Payloads analyzed as **strings only** using regex patterns

### Core Concepts

#### 1. Honeypot Traps (Fake Endpoints)
These look like real vulnerabilities but aren't connected to anything:
- `/.env` - Fake environment file
- `/api/v1/auth/login` - Fake login endpoint  
- `/phpmyadmin` - Fake database admin panel
- `/wp-admin` - Fake WordPress admin

Attackers find these via:
- Automated scanners (nmap, nikto)
- Previous network reconnaissance
- Common path bruteforcing

#### 2. Threat Detection (Pattern Matching)
When an attack hits a trap:
```
Payload String → Regex Patterns → Classification → Log with HMAC
```

Examples:
```
"' OR '1'='1"        → SQL_INJECTION pattern match → Type: SQL_INJECTION
"../../etc/passwd"   → Path traversal pattern     → Type: PATH_TRAVERSAL
"<script>alert(1)</script>" → XSS pattern       → Type: XSS_ATTEMPT
```

#### 3. HMAC-SHA256 Log Signing
Every log entry has a cryptographic signature:

```
Log Data (attack metadata + analysis results)
         ↓
    SHA-256 HMAC
    (using HMAC_SECRET)
         ↓
    Hex signature stored in log
         ↓
If attacker modifies log → HMAC no longer matches → Tampering detected!
```

### File Purpose Guide

| File | Purpose |
|------|---------|
| `index.ts` | Main Express app - starts server |
| `routes/index.ts` | Defines all honeypot trap endpoints |
| `controllers/honeypotHandlers.ts` | Responds to traps with fake data |
| `middlewares/honeypotCapture.ts` | Intercepts ALL requests and logs them |
| `services/threatAnalyzer.ts` | Detects attack patterns (no execution!) |
| `services/auditLogger.ts` | HMAC signing and log persistence |
| `utils/crypto.ts` | HMAC-SHA256 utilities |
| `types/index.ts` | TypeScript interfaces |

### Request Flow

```
Request → honeypotCapture Middleware
              ↓
          Extract metadata (IP, headers, body)
              ↓
          Send to threatAnalyzer
              ↓
          Pattern matching (SQL, Path Traversal, etc.)
              ↓
          auditLogger signs with HMAC
              ↓
          Write to logs/honeypot-YYYY-MM-DD.jsonl
              ↓
          Pass to route handler
              ↓
          Return fake response (401, 404, or 200 with fake data)
```

### Key Security Decisions

1. **Why HMAC instead of just hash?**
   - Hash: `hash(data)` - attacker can modify data and hash together
   - HMAC: `hash(data + secret_key)` - attacker can't forge without knowing secret

2. **Why JSONL format?**
   - One JSON object per line
   - Easy to append (no need to read whole file)
   - Each line independently parseable
   - Great for streaming analysis

3. **Why pattern matching only?**
   - Executing payload to analyze it = running malware
   - Pattern matching is safe - just string comparison
   - Sufficient to classify common attacks

4. **Why capture headers?**
   - Reveals attacker tools (User-Agent: "sqlmap/1.5")
   - Shows infrastructure (X-Forwarded-For, X-Real-IP)
   - Used for correlation and attribution

### Production Checklist

Before deploying to production:

- [ ] Change `HMAC_SECRET` to a 64+ character random value
- [ ] Set `NODE_ENV=production`
- [ ] Configure secure logging (rotate, archive, backup logs)
- [ ] Add authentication to `/stats` endpoint
- [ ] Set up SIEM integration (ELK, Splunk)
- [ ] Configure alerting for HIGH/CRITICAL threats
- [ ] Run in isolated network segment
- [ ] Monitor for attacker persistence attempts
- [ ] Backup logs regularly
- [ ] Review logs for new attack patterns weekly

### Common Attack Patterns You'll See

1. **SQLmap** - Automated SQL injection tool
   - Indicators: `sqlmap` in User-Agent, SQL keywords in payload

2. **Nikto** - Web scanner
   - Indicators: Known vulnerable paths, `Nikto/` in User-Agent

3. **Credential Stuffing** - Large password spray
   - Indicators: Multiple POSTs to `/login` from same/similar IPs

4. **Path Traversal** - Try to read files
   - Indicators: `../` sequences in path

5. **Generic Scanners** - Automated port/vulnerability scanning
   - Indicators: Requests to all common paths, fast request rate

### Example Attack You'll Log

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-21T20:15:30.452Z",
  "attack": {
    "sourceIp": "203.0.113.45",
    "method": "POST",
    "path": "/api/v1/auth/login",
    "userAgent": "sqlmap/1.5.4 (http://sqlmap.org)",
    "body": "{\"username\":\"admin' OR '1'='1\",\"password\":\"')\"}",
    "headers": {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.45"
    }
  },
  "analysis": {
    "type": "SQL_INJECTION",
    "severity": "HIGH",
    "confidence": 85,
    "indicators": [
      "SQL_INJECTION_SYNTAX_DETECTED",
      "AUTOMATED_SCANNER_DETECTED"
    ],
    "reasoning": "Detected 2 threat indicator(s): SQL_INJECTION_SYNTAX_DETECTED, AUTOMATED_SCANNER_DETECTED"
  },
  "hmac": "a3f2d1e8c9b4f7e2a1d5c6b9f3e7a1d4b8c2f5e9a3d7b1c4f8e2a5d9c3f7b1",
  "honeypotVersion": "1.0.0"
}
```

### Extending the Honeypot

Add new attack detection:

```typescript
// In threatAnalyzer.ts, add new pattern
const YOUR_NEW_ATTACK_PATTERNS = [
  /pattern1/i,
  /pattern2/i,
];

// Add detection logic
const yourMatch = YOUR_NEW_ATTACK_PATTERNS.some((pattern) =>
  pattern.test(payload)
);
if (yourMatch) {
  indicators.push("YOUR_ATTACK_DETECTED");
  // Set threat type and severity
}
```

Add new honeypot endpoint:

```typescript
// In routes/index.ts
router.get("/your-fake-endpoint", handleYourTrap);

// In controllers/honeypotHandlers.ts
export function handleYourTrap(req: Request, res: Response): void {
  res.status(404).json({ error: "Not Found" });
}
```

---

**Remember:** This honeypot is a **defensive security tool**. It learns from attackers without putting systems at risk. Perfect for your cybersecurity portfolio! 🎓🔒
