# Honeypot API - Security Implementation Details

## Executive Summary

This honeypot is designed with **zero-execution** guarantees:
- ✅ No attacker payload is ever executed
- ✅ All logs are cryptographically signed to prevent tampering
- ✅ Pattern-based threat detection (safe string analysis only)
- ✅ Forensic-ready audit trail

## Security Architecture

### 1. Attack Capture (Zero Execution Design)

#### Request Flow
```
Incoming Attack Request
    ↓
honeypotCapture Middleware
    ├─ Extract metadata (IP, headers, body)
    ├─ Store payload as STRING ONLY
    └─ Never pass to eval/exec/exec
         ↓
threatAnalyzer Service
    ├─ Regex pattern matching (safe)
    └─ Never executes attacker code
         ↓
auditLogger Service
    ├─ Generate HMAC signature
    └─ Write to JSONL file
         ↓
Route Handler
    └─ Return fake response (no side effects)
```

### 2. Payload Handling (Why It's Safe)

#### ❌ Dangerous Patterns (NOT USED)
```typescript
// NEVER: eval, Function constructor
eval(req.body.code);           // EXTREME DANGER
new Function(req.body.code)(); // EXTREME DANGER

// NEVER: Shell commands
exec(`query: ${req.body.search}`);  // DANGER
spawn('sh', ['-c', userInput]);     // DANGER

// NEVER: Database queries with concatenation
`SELECT * FROM users WHERE id=${req.body.id}` // DANGER

// NEVER: Dynamic regex with user input
new RegExp(req.body.pattern).test(data); // DANGER
```

#### ✅ Safe Patterns (USED IN HONEYPOT)
```typescript
// SAFE: String to string analysis
const payload = JSON.stringify(req.body);
const hasSqlInjection = /\bOR\b.*['"]?\s*1\s*['"]?\s*=/.test(payload);

// SAFE: Static pattern matching
const KNOWN_SCANNERS = [/sqlmap/i, /nikto/i, /nessus/i];
const isScanner = KNOWN_SCANNERS.some(pattern => pattern.test(userAgent));

// SAFE: Immutable string operations
const truncatedPayload = payload.substring(0, 500);
const isLongRequest = payload.length > 10000;

// SAFE: Regular expressions with known patterns only
const XSS_PATTERNS = [
  /<script[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,
];
```

### 3. HMAC-SHA256 Log Signing

#### Why HMAC?

**Threat Model:** Attacker gains server access and wants to cover tracks by modifying logs.

**Solution:** Cryptographic signature proves log authenticity

```
Original Log Data
    ↓
SHA256(Log Data + HMAC_SECRET)
    ↓
256-bit hexadecimal signature
    ↓
Stored with log entry
    ↓
If log modified → HMAC no longer matches → Tampering detected!
```

#### Implementation

```typescript
// Log generation
const logData = {
  id: "550e8400-e29b-41d4-a716",
  timestamp: "2026-05-22T00:24:03.535Z",
  attack: {
    sourceIp: "192.168.1.100",
    method: "POST",
    path: "/api/v1/auth/login"
  },
  analysis: {
    type: "SQL_INJECTION",
    severity: "HIGH"
  }
};

// HMAC signature generation (deterministic)
const hmac = crypto
  .createHmac("sha256", HMAC_SECRET)
  .update(JSON.stringify(logData))
  .digest("hex");

// Result
{
  ...logData,
  hmac: "8eba574693d5376942e48549d4d33e44f13bc5503e3a14284d960b8d1539ef9b"
}

// Verification
const recalculatedHmac = crypto
  .createHmac("sha256", HMAC_SECRET)
  .update(JSON.stringify(logData))
  .digest("hex");

const isValid = recalculatedHmac === storedHmac;
```

#### Attack Scenarios & Defense

**Scenario 1: Attacker tries to delete log**
```
Action: Delete log file
Result: Log file not found when reviewing
Detection: Audit trail shows which logs should exist by date
Response: Alert on missing log files
```

**Scenario 2: Attacker modifies log**
```
Original:  {"attack": {"sourceIp": "203.0.113.45"}, "hmac": "abc123..."}
Modified:  {"attack": {"sourceIp": "127.0.0.1"}, "hmac": "abc123..."}
                                         ↑ changed              ↑ stale

Verification: SHA256(modified_data + HMAC_SECRET) ≠ "abc123..."
Result: Tampering detected!
```

**Scenario 3: Attacker tries to forge new log**
```
Action: Create fake log entry
Problem: Without HMAC_SECRET, can't generate valid HMAC
Result: Log fails verification - tampering detected!
```

### 4. Threat Classification

All attack classification uses **static pattern matching only**:

#### SQL Injection Patterns
```regex
\bOR\b.+['"]?\s*1\s*['"]?\s*=    # OR 1=1
\bUNION\b.+\bSELECT\b             # UNION SELECT
\b(DROP|DELETE|INSERT|UPDATE)\b  # DB commands
\bEXEC\b\s*\(                     # Execute functions
```

#### Path Traversal Patterns
```regex
\.\.\/                            # ../
\.\.%2f                           # ..%2f (URL encoded)
%2e%2e                            # ..  (hex encoded)
```

#### Command Injection Patterns
```regex
[;|`$&<>()]                       # Shell metacharacters
\b(bash|sh|cmd)\b                 # Shell keywords
`.*`                              # Backtick substitution
\$\(.*\)                          # Command substitution
```

#### XSS Patterns
```regex
<script[^>]*>                     # Script tags
javascript:                       # JavaScript protocol
on\w+\s*=                         # Event handlers
<iframe[^>]*>                     # iframes
```

### 5. Data Isolation

#### What Gets Logged
```json
{
  "attack": {
    "sourceIp": "192.168.1.100",           // Attacker location
    "method": "POST",                      // HTTP method
    "path": "/api/v1/auth/login",          // Endpoint targeted
    "userAgent": "sqlmap/1.5",             // Tool/Browser
    "headers": {...},                      // All headers
    "body": "{...payload...}"              // Full payload stored
  }
}
```

#### What Does NOT Happen
```
✗ Payload NOT executed
✗ Payload NOT parsed as code
✗ No database connection made
✗ No file system access attempted
✗ No system calls executed
✗ Attacker code cannot break sandbox
```

#### Log Storage Safety
```
logs/honeypot-YYYY-MM-DD.jsonl
    ↑ Single file per day
    ↑ Append-only (no overwrites)
    ↑ File permissions: 0600 (owner read/write only)
    ↑ Timestamps for correlation
```

## Cryptography Details

### HMAC-SHA256 Specification

**Algorithm:** HMAC (Hash-based Message Authentication Code)  
**Hash Function:** SHA-256 (256-bit output)  
**Key Size:** 256-bit minimum (32 bytes hex = 64 characters)  
**Output:** 64-character hexadecimal string

### Key Strength Recommendations

| Key Length | Bits | Security Level | Recommendation |
|-----------|------|-----------------|-----------------|
| 16 chars  | 128  | Weak           | ❌ DO NOT USE   |
| 32 chars  | 256  | Moderate       | ⚠️ Minimum     |
| 64 chars  | 512  | Strong         | ✅ Recommended |
| 128 chars | 1024 | Very Strong    | ✅ Best        |

### Generation Examples

```bash
# Generate 256-bit key (recommended minimum)
openssl rand -hex 32

# Generate 512-bit key (strong)
openssl rand -hex 64

# Generate 1024-bit key (very strong)
openssl rand -hex 128

# Example output
14c4f3261b06c6cc862bcd7c7b4351cf5f11bcac39c105f9cb90d25205ee5085
```

## Security Testing

### Test 1: Verify No Code Execution

```bash
# Attack: Code injection in username
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"$(touch /tmp/pwned)","password":"test"}'

# Result: 
# ✅ /tmp/pwned NOT created
# ✅ Command NOT executed
# ✅ Attack logged with no side effects
```

### Test 2: Verify HMAC Integrity

```bash
# Get a log entry
LOG=$(cat logs/honeypot-$(date +%Y-%m-%d).jsonl | head -1)

# Manually modify the IP
MODIFIED=$(echo "$LOG" | jq '.attack.sourceIp = "1.2.3.4"')

# Verify HMAC check fails
# Expected: HMAC verification fails because sourceIp changed but HMAC didn't
```

### Test 3: Verify Payload Storage

```bash
# Check that full payload is stored
cat logs/honeypot-$(date +%Y-%m-%d).jsonl | \
  jq '.attack.body' | \
  grep "OR '1'='1"

# Result: ✅ Payload stored completely and safely
```

### Test 4: Verify Log Immutability

```bash
# Try to modify a log file
echo '{"fake":"log"}' >> logs/honeypot-*.jsonl

# Run verification
npm test  # (in production: verify logs)

# Result: ✅ Tampered entry detected by HMAC check
```

## Common Security Questions

### Q: What if attacker modifies the HMAC_SECRET?
**A:** Logs would fail verification with the new secret. Old logs would become unverifiable. This is actually good - you'd know the system was compromised.

### Q: Could attacker forge a valid HMAC without the secret?
**A:** Theoretically impossible. SHA-256 + HMAC is cryptographically secure. Brute-forcing 2^256 possibilities would take longer than the age of the universe.

### Q: Why not just encrypt logs?
**A:** HMAC provides **authenticity** (proof the log wasn't modified). Encryption provides **confidentiality** (hiding content). For forensics, we need both:
- Encryption: `openssl enc -aes-256-cbc` (if logs travel over network)
- HMAC: Included in this design (integrity/authenticity)

### Q: What if database gets compromised?
**A:** This honeypot doesn't use a real database - it stores logs in JSONL files only. This is intentional:
- Files are easier to backup and verify
- No SQL injection risk on the honeypot itself
- Immutable append-only logs
- Can be on isolated filesystem

### Q: How do I rotate HMAC secrets?
**A:** You don't need to. However, if compromised:
1. Generate new HMAC_SECRET
2. Re-verify all existing logs with old secret
3. Archive verified logs (with timestamp proof they were verified)
4. Start using new secret for new logs
5. Keep audit trail showing when rotation occurred

## Defense Layers Summary

| Layer | Mechanism | Protection |
|-------|-----------|-----------|
| Input | No execution | Payloads stored as strings only |
| Analysis | Pattern matching | Safe regex-based detection |
| Logging | HMAC-SHA256 | Cryptographic integrity proof |
| Storage | JSONL + file perms | Append-only, restricted access |
| Monitoring | Log verification | Detect tampering attempts |
| Recovery | Backups | Restore from verified backups |

---

**This design ensures:** Your honeypot is secure while actively studying attackers. Perfect for cybersecurity portfolio projects! 🎓🔒
