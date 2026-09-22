# Phase 8 — Service Launcher

> One click from My_Login to the exact page that matters — login, settings, security, or deletion.

---

## Objective

Provide single-click access to any discovered service's official website, account settings, security pages, or deletion portal — adapting intelligently between web browser links and native mobile app launches.

---

## 8.1 — Launch Target Hierarchy

Every account card exposes a prioritized set of action URLs, surfaced from the service catalog:

| Action | URL Field | When Available | Fallback |
|---|---|---|---|
| **Open** | `login_url` → `website_url` | Always | `https://{primary_domain}` |
| **Account Settings** | `account_settings_url` | When cataloged | Opens `website_url` |
| **Security & 2FA** | `security_settings_url` | When cataloged | Opens `account_settings_url` |
| **Delete Account** | `delete_account_url` | When cataloged | Opens search: "How to delete {service} account" |
| **Export Data** | `data_export_url` | When cataloged | Opens privacy policy |

> **"Opens search" fallback:** When a direct deletion URL is unavailable, My_Login opens a pre-formatted Google search: `site:{domain} delete account` — safer than guessing a URL that may be wrong.

---

## 8.2 — Web Platform Launcher

All external links must be opened with security-safe attributes:

```typescript
function openExternalUrl(url: string, label: string) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';  // Prevent tab-napping attacks
  link.click();
}
```

### Link Validation Before Opening
- Validate URL starts with `https://` — never open `http://` or unknown scheme.
- Check against My_Login's own internal blocklist of known phishing domains.
- If validation fails: show warning modal, do not navigate.

---

## 8.3 — Mobile Platform Launcher (React Native)

On mobile, check if the native app is installed before deciding the launch target:

```typescript
// React Native launcher logic
async function launchService(service: Service) {
  const deepLink = service.android_deep_link ?? service.ios_deep_link;

  if (deepLink) {
    const canOpen = await Linking.canOpenURL(deepLink);
    if (canOpen) {
      // Native app is installed → launch it directly
      await Linking.openURL(deepLink);
      return;
    }
  }

  // App not installed → open in system browser
  await Linking.openURL(service.login_url ?? service.website_url);
}
```

### Known Deep Link Schemes (Examples)
| Service | Android Deep Link | iOS Deep Link |
|---|---|---|
| Instagram | `instagram://` | `instagram://` |
| Spotify | `spotify://` | `spotify://` |
| GitHub | `github://` | `github://` |
| Netflix | `nflx://` | `nflx://` |
| YouTube | `vnd.youtube://` | `youtube://` |

---

## 8.4 — Launch Event Tracking

Every launch action is logged locally for analytics and security awareness:

```sql
CREATE TABLE launch_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,  -- open | settings | security | delete | export
  platform    VARCHAR(20) DEFAULT 'web',   -- web | android | ios
  launched_at TIMESTAMPTZ DEFAULT now()
);
```

This data powers:
- **Account Activity signals** (a recent "open" event indicates the account is still in use)
- **Cleanup suggestions** (accounts that have never been launched in 180+ days are more confidently flagged inactive)

---

## 8.5 — UI: Action Button States

### When All URLs Are Available
```
[ 🌐 Open ]  [ ⚙️ Settings ]  [ 🔒 Security ]  [ 🗑️ Delete Account ]
```

### When Only website_url Is Available
```
[ 🌐 Open ]  [ ⚙️ Settings ↗ (opens main site) ]  [ 🔒 Security ↗ ]  [ 🗑️ Delete Account → Search ↗ ]
```
Tooltips indicate when a direct URL is unavailable: *"No direct link available — we'll open a search to help you find it."*

### Unavailable / Unknown URL
- Button appears faded/disabled with tooltip: *"No link available for this action."*
- Never show a broken or wrong link.

---

## Acceptance Criteria

- [ ] All external links opened with `target="_blank"` and `rel="noopener noreferrer"`.
- [ ] URL validation rejects non-HTTPS and malformed URLs before navigation.
- [ ] "Delete Account" fallback search opens correctly when `delete_account_url` is null.
- [ ] Mobile launcher detects installed apps and prefers native deep link over browser.
- [ ] Deep link fallback to system browser works when native app is not installed.
- [ ] Launch events are recorded in `launch_events` table for activity signal purposes.
- [ ] Tooltip text explains when a direct URL is unavailable (no broken/hidden buttons).
