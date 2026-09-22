# Phase 19 — Optional Local Password Audit

> A zero-knowledge client-side tool for users who want to check their existing password health — without ever sending a password to My_Login.

---

## Objective

Allow users to optionally import an exported CSV from their password manager or browser and receive a local security audit — all processing happening inside the browser's Web Worker. No raw password or credential data ever leaves the device.

---

## 19.1 — Design Principle: Zero-Knowledge Architecture

This is the only My_Login feature that touches password data. The design constraints are absolute:

| Constraint | Implementation |
|---|---|
| **No passwords sent to server** | All processing in browser WebWorker |
| **No passwords stored locally** | Memory cleared immediately after analysis |
| **No network calls with passwords** | Only SHA-1 hash prefix (5 chars) sent to HIBP Pwned Passwords API (k-Anonymity) |
| **No server-side logging** | Feature is entirely client-side; backend has zero involvement |
| **User-initiated only** | No auto-scan, no automatic import |

---

## 19.2 — Supported Import Formats

| Source | File Format | Columns Expected |
|---|---|---|
| **Bitwarden** | `.csv` | `name, login_uri, login_username, login_password` |
| **1Password** | `.csv` | `Title, Website, Username, Password` |
| **Chrome / Edge** | `.csv` | `name, url, username, password` |
| **Firefox** | `.csv` | `url, username, password` |
| **LastPass** | `.csv` | `url, username, password, name` |
| **Dashlane** | `.csv` | `username, password, domain` |
| **KeePass** | `.csv` | `Account, Login Name, Password, Web Site` |

The parser auto-detects format by inspecting the CSV header row. Generic fallback supports any CSV with `password` and `url`/`site` columns.

---

## 19.3 — Processing Pipeline (All Client-Side)

```
User selects .csv file
         │
         ▼ (FileReader API — browser)
  File content read into memory (NEVER sent to server)
         │
         ▼ (Transferred to WebWorker via postMessage)
  WebWorker — password_audit_worker.js
         │
  ┌──────┴──────────────────────────────────────────────┐
  │  1. Parse CSV → extract (site, username, password)  │
  │                                                     │
  │  2. Detect duplicate passwords across sites         │
  │     (group by password hash SHA-256)                │
  │                                                     │
  │  3. Evaluate password strength per entry            │
  │     (zxcvbn library — offline, no network)         │
  │     → score 0–4: Very Weak / Weak / Fair /          │
  │       Strong / Very Strong                          │
  │                                                     │
  │  4. For each unique password:                       │
  │     a. SHA-1 hash the password                      │
  │     b. Take first 5 chars (the "prefix")            │
  │     c. HIBP API: GET /range/{prefix}                │
  │        (sends only 5 chars — k-Anonymity model)     │
  │     d. Check if full hash suffix appears in response│
  │     e. If yes → password is in breach database      │
  │                                                     │
  │  5. Assemble audit results (counts only, no raw pw) │
  └──────┬──────────────────────────────────────────────┘
         │
         ▼ (postMessage back to main thread)
  Display results in UI
         │
         ▼
  User closes panel or clicks "Clear"
         │
         ▼
  Worker memory cleared, CSV reference discarded
```

---

## 19.4 — k-Anonymity: How No Password Leaves the Browser

This is the HIBP Pwned Passwords k-Anonymity model — the same used by 1Password and Firefox Monitor:

```javascript
// In WebWorker:
async function checkPasswordBreached(password) {
  // Step 1: SHA-1 hash the password
  const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('').toUpperCase();

  // Step 2: Split hash — only prefix is sent
  const prefix = hashHex.substring(0, 5);    // e.g. "5BAA6"  ← SENT TO HIBP
  const suffix = hashHex.substring(5);       // e.g. "1E4..."  ← NEVER SENT

  // Step 3: HIBP returns ALL hashes starting with that prefix (~500 results)
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();

  // Step 4: Check if our specific suffix appears in the response
  const lines = text.split('\n');
  for (const line of lines) {
    const [responseSuffix, count] = line.split(':');
    if (responseSuffix.trim() === suffix) {
      return { breached: true, count: parseInt(count) };
    }
  }

  return { breached: false, count: 0 };
}
```

HIBP receives only 5 characters of the SHA-1 hash. It cannot reconstruct the original password. HIBP returns ~500 candidate hashes that share the same prefix — the browser checks locally which one matches.

---

## 19.5 — Audit Results UI

```
┌─────────────────────────────────────────────────────────────┐
│  🔒 PASSWORD AUDIT RESULTS                    [Clear Data]  │
│                                                             │
│  Analyzed 87 passwords from Bitwarden export                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 🔴 3         │  │ 🟠 7         │  │ 🟡 12        │      │
│  │ COMPROMISED  │  │ REUSED       │  │ WEAK         │      │
│  │ in breaches  │  │ across sites │  │ passwords    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  COMPROMISED PASSWORDS (change these immediately):          │
│  ─────────────────────────────────────────────────          │
│  • facebook.com / user@email.com — seen in 34,291 breaches  │
│  • oldforum.net / username123    — seen in 1,840 breaches   │
│  • gamesite.com / gamer99        — seen in 724 breaches     │
│                                                             │
│  REUSED PASSWORDS:                                          │
│  ─────────────────────────────────────────────────          │
│  • Same password used on: amazon.com, ebay.com, etsy.com   │
│                                                             │
│  ⚠️  This data exists only in your browser.                  │
│     Closing this panel permanently clears it.               │
│                                                             │
│  [ Import New File ]  [ Clear All Data ]  [ Close ]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 19.6 — Privacy Footer (Required in UI)

The following disclaimer must always be visible in the audit panel:

> *"My_Login never receives your passwords. All analysis runs locally in your browser. Only the first 5 characters of each SHA-1 password hash are sent to Have I Been Pwned's k-Anonymity API to check for breach exposure. Raw passwords are cleared from memory when you close this panel."*

---

## Acceptance Criteria

- [ ] All password parsing and analysis happens inside a browser WebWorker (off main thread).
- [ ] Network inspector confirms only 5-char SHA-1 hash prefixes are sent — no passwords, no full hashes.
- [ ] CSV auto-detection correctly identifies Bitwarden, 1Password, Chrome, Firefox, and LastPass formats.
- [ ] zxcvbn strength scores are computed offline with no network call.
- [ ] Duplicate password detection groups entries by password hash, not plain text.
- [ ] Breach check uses HIBP Pwned Passwords `/range/{prefix}` endpoint (k-Anonymity).
- [ ] "Clear Data" wipes the WebWorker memory and removes the file reference from the DOM.
- [ ] UI shows site and username for compromised entries but NEVER shows the password in plaintext.
- [ ] Privacy disclaimer is always visible in the audit panel.
- [ ] Feature is only available to Pro users (gate with pro_required check).
