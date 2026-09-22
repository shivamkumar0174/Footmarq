# Phase 7 — Search & Filtering

> Fast, multi-dimensional discovery navigation across hundreds of accounts with zero page reloads.

---

## Objective

Provide real-time, client-side search combined with multi-dimensional server-side filtering — enabling users to find any account instantly by name, email, category, risk level, breach status, or activity state.

---

## 7.1 — Filter Dimensions (Full)

All filters are combinable (AND logic). URL state is kept in sync with active filters for deep-linking.

### Category Filter
```
[ All ] [ Social ] [ Shopping ] [ Finance ] [ Entertainment ]
[ Productivity ] [ Developer ] [ Gaming ] [ Education ]
[ Healthcare ] [ Travel ] [ Utilities ] [ Other ]
```
Multi-select supported: user can filter "Finance + Developer" simultaneously.

### Email Address Filter
Dropdown listing all verified emails:
```
● All emails
○ user@gmail.com (42 accounts)
○ user@outlook.com (18 accounts)
○ user@company.com (11 accounts)
```

### Risk Level Filter
```
[ ] 🟢 Low Risk      (54)
[ ] 🟡 Moderate      (10)
[ ] 🟠 High Risk     ( 4)
[ ] 🔴 Critical      ( 3)
```
Multi-select supported.

### Security & Breach Status
```
[ ] 🔴 Breached accounts only
[ ] ⚠️  Missing 2FA signal
[ ] ✅ Safe & monitored
```

### Activity Status
```
[ ] Active      < 90 days
[ ] Dormant     90–180 days
[ ] Inactive    > 180 days
[ ] Unknown     No activity date available
```

### Confidence Level Filter (Advanced)
```
[ ] Verified    90–100% confidence
[ ] Likely      70–89% confidence
[ ] Uncertain   50–69% confidence  (awaiting user confirmation)
```

---

## 7.2 — Search Engine Implementation

### Client-Side Search (Primary)
- Library: **Fuse.js** (fuzzy search with weighted fields)
- Triggers: debounced at 150ms after last keystroke
- Searches across:
  ```typescript
  const fuseOptions = {
    keys: [
      { name: 'service.name',         weight: 0.6 },
      { name: 'service.primary_domain', weight: 0.3 },
      { name: 'service.category',     weight: 0.1 },
    ],
    threshold: 0.35,   // 0=exact, 1=match anything
    includeScore: true,
    minMatchCharLength: 2,
  };
  ```

### Server-Side Search (Fallback for > 500 accounts)
```typescript
// MongoDB text search using Mongoose
const accounts = await Account.find({
  userId,
  isDeletedByUser: false,
  $text: { $search: searchQuery }
})
.populate({
  path: 'serviceId',
  match: { isVerified: true }
})
.sort({ score: { $meta: 'textScore' } });
```

---

## 7.3 — URL State Synchronization

Every active filter and search state is reflected in the URL for shareability and browser back-button support:

```
/dashboard?search=git&category=developer&risk=high,critical&email=uuid&status=active&sort=risk_score&page=1
```

Implementation using React Router `useSearchParams`:
```typescript
// Read filters from URL on page load
const [searchParams, setSearchParams] = useSearchParams();
const category = searchParams.get('category');
const risk = searchParams.get('risk')?.split(',') ?? [];

// Write filters back to URL on change (replaceState, no history entry)
setSearchParams({ ...currentParams, category: selected }, { replace: true });
```

---

## 7.4 — Active Filters Summary Bar

When any non-default filters are active, a summary bar appears above the account list:

```
Filters active:  [Developer ×]  [High Risk ×]  [user@gmail.com ×]    [Clear all]
Showing 8 of 71 accounts
```

- Each filter chip has an × to remove that individual filter.
- "Clear all" resets to default (all accounts, no filters).

---

## 7.5 — Empty States

| Scenario | Message |
|---|---|
| Search returns 0 results | "No accounts match '**{query}**'. Try a broader term." |
| Filter combination returns 0 | "No accounts match the selected filters. Try removing a filter." |
| No accounts at all (new user) | "No accounts discovered yet. Connect Gmail to start scanning." |
| Category has 0 accounts | "No accounts found in **{category}**." |

---

## 7.6 — Saved Filters (Pro Feature)

Pro users can save frequently used filter combinations:

```
[ Save current filter ]
  Name: "Risky Finance accounts"
  Category: Finance
  Risk: High, Critical
  Saved: [Mon 12 Aug 2026]
```

Saved filters appear as quick-access chips above the category tabs.

---

## Acceptance Criteria

- [ ] Fuse.js fuzzy search returns results within 100ms for up to 500 accounts.
- [ ] Server-side MongoDB text search activates when account count exceeds 500.
- [ ] All filter dimensions work independently and in combination (AND logic).
- [ ] Multi-select works for category and risk level filters.
- [ ] Active filters are reflected in the URL and persist on page refresh.
- [ ] Active filters summary bar displays all selected filters with individual removal chips.
- [ ] Empty states display contextually appropriate messages for each scenario.
- [ ] Saved filters (Pro) persist across sessions and load correctly on next login.
