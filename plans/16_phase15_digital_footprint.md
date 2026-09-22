# Phase 15 — Digital Footprint

> An interactive visual map of the user's entire digital presence — the product's most visually distinctive feature.

---

## Objective

Render a real-time, interactive graph visualization of a user's digital footprint: all connected email identities, discovered services, category clusters, risk levels, and breach relationships — powered by graph data from the account inventory.

---

## 15.1 — Why This Feature Matters

The Digital Footprint is not just a pretty chart. For the user, it answers a question they've never been able to answer before:

> *"What does my digital life actually look like from the outside?"*

When a user sees 70+ nodes radiating from their email addresses — many of them forgotten — it creates an emotional moment that drives both engagement and product loyalty. This visualization is a key **viral sharing trigger** (shareable card of their footprint score).

---

## 15.2 — Visual Network Graph Architecture

### Technology Choice

| Library | Pros | Cons | Decision |
|---|---|---|---|
| **D3.js** | Maximum flexibility, industry standard | High implementation complexity | ✅ Preferred (force-directed graph) |
| **React Flow** | Good React integration, drag-and-drop | Not optimized for 100+ nodes | ⚠️ Fallback for simpler layouts |
| **Vis.js Network** | Handles large graphs well | Less control over aesthetics | ⚠️ Fallback if D3 proves too complex |

### Recommended: **D3.js Force-Directed Graph** (`d3-force`)

---

## 15.3 — Graph Data Model

### Nodes
```typescript
type FootprintNode =
  | { type: 'user';     id: string; label: 'YOU' }
  | { type: 'email';    id: string; label: string; email: string }
  | { type: 'category'; id: string; label: string; count: number }
  | { type: 'service';  id: string; label: string; serviceId: string;
      riskLevel: 'low' | 'moderate' | 'high' | 'critical';
      isBreached: boolean; activityStatus: string;
      logoUrl: string | null; }
```

### Edges
```typescript
type FootprintEdge =
  | { source: 'user';     target: 'email';    type: 'owns' }
  | { source: 'email';    target: 'category'; type: 'has_category' }
  | { source: 'category'; target: 'service';  type: 'contains' }
```

### API Endpoint
```
GET /api/v1/analytics/footprint
```
```json
{
  "nodes": [
    { "id": "user",              "type": "user",     "label": "YOU" },
    { "id": "email-1",           "type": "email",    "label": "user@gmail.com",   "account_count": 42 },
    { "id": "cat-social",        "type": "category", "label": "Social",           "count": 14 },
    { "id": "svc-instagram",     "type": "service",  "label": "Instagram",
      "risk_level": "low", "is_breached": false, "logo_url": "https://..." }
  ],
  "edges": [
    { "source": "user",       "target": "email-1" },
    { "source": "email-1",    "target": "cat-social" },
    { "source": "cat-social", "target": "svc-instagram" }
  ],
  "summary": {
    "total_accounts": 71,
    "total_emails": 3,
    "total_categories": 8,
    "breached_count": 3,
    "critical_risk_count": 1
  }
}
```

---

## 15.4 — Visual Design Specification

### Node Appearance

| Node Type | Shape | Color | Size |
|---|---|---|---|
| User (YOU) | Large circle | Brand gradient (purple→blue) | 60px |
| Email identity | Medium circle | Dark navy with email initial | 40px |
| Category cluster | Rounded rect | Neutral grey-blue | Based on count |
| Service (safe) | Small circle with logo | Green halo | 28px |
| Service (moderate risk) | Small circle with logo | Yellow halo | 28px |
| Service (high risk) | Small circle with logo | Orange halo | 30px |
| Service (critical / breached) | Small circle with logo | Red pulsing halo | 32px (animated) |

### Node Sizing
- Service nodes scale proportionally to `event_count` (more emails from a service = larger node).
- Category nodes scale to the number of services they contain.

### Breach Pulse Animation
Breached service nodes have a CSS `@keyframes` pulsing red ring to draw immediate attention.

### Graph Physics (D3 Force)
```javascript
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.id).distance(80))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide().radius(d => d.radius + 5));
```

---

## 15.5 — Interactive Controls

| Control | Behavior |
|---|---|
| **Click on service node** | Opens Account Detail side panel |
| **Hover on node** | Shows tooltip (name, risk level, activity status, breach status) |
| **Click on email node** | Filters graph to show only accounts under that email |
| **Click on category node** | Filters graph to only show services in that category |
| **Toggle email filter** | Checkbox per connected email to show/hide their nodes |
| **Toggle category filter** | Checkbox per category to show/hide their service nodes |
| **Zoom & Pan** | D3 zoom behavior on the SVG canvas |
| **Reset Layout** | Resets all filters and re-runs force simulation |

---

## 15.6 — Analytics Dashboard (Alongside Graph)

Four key charts displayed as panels next to or below the graph:

### Chart 1: Category Distribution (Donut Chart)
```
Shopping:      18  ████████████
Social:        14  ██████████
Productivity:  12  █████████
Entertainment:  9  ███████
Finance:        6  █████
Developer:      5  ████
Gaming:         4  ███
Other:          3  ██
```

### Chart 2: Account Discovery Timeline (Bar Chart)
Year-by-year bar chart showing how many accounts were first detected:
```
2016: ▌ 3
2017: ██ 7
2018: ████ 14
2019: ███ 10
2020: █ 4
2021: ███ 9
2022: ██ 8
2023: ████ 12
2024: ██ 4
```

### Chart 3: Risk Breakdown (Horizontal Bar)
```
Low Risk:       54  ████████████████████████
Moderate Risk:  10  ████████
High Risk:       4  ████
Critical:        3  ███
```

### Chart 4: Email Identity Distribution (Pie Chart)
```
user@gmail.com:    42 (59%)
user@outlook.com:  18 (25%)
user@company.com:  11 (15%)
```

---

## 15.7 — Shareable Footprint Card

A key growth feature: users can generate and share a **Digital Footprint Summary Card** (PNG/JPEG):

```
┌──────────────────────────────────────────────────┐
│  🌐 MY DIGITAL FOOTPRINT                          │
│  Powered by My_Login                              │
│                                                  │
│  71 Accounts · 3 Emails · 8 Categories           │
│                                                  │
│  🟢 54 Safe   🟡 10 Moderate   🔴 7 At Risk       │
│                                                  │
│  3 active data breaches detected                 │
│  Scan yours free → mylogin.app                   │
└──────────────────────────────────────────────────┘
```

Generated server-side using `Pillow` (Python) and served as a static image URL.

---

## 15.8 — Performance Considerations

| Concern | Solution |
|---|---|
| 100+ nodes slowing browser | Virtualize: only render nodes currently visible in viewport using D3 zoom |
| API data load time | Cache footprint data in Redis for 5 minutes per user |
| Graph re-render on filter change | Filter state modifies node/edge visibility in-memory — no API call needed |
| Mobile rendering | On mobile viewports: replace force graph with simplified category donut chart + list |

---

## Acceptance Criteria

- [ ] Force-directed graph renders correctly for 10 to 200 nodes without frame drops.
- [ ] Clicking any service node opens the Account Detail side panel.
- [ ] Breached nodes visually pulse red and are distinguishable from safe nodes.
- [ ] Email and category filter toggles update the graph within 100ms (client-side, no API call).
- [ ] Footprint summary card generates correctly as a shareable PNG image.
- [ ] Category donut chart, discovery timeline, and risk breakdown charts all render with accurate data.
- [ ] Graph zoom and pan work on both desktop and touch devices.
- [ ] Mobile fallback renders a list-based view when viewport < 768px.
- [ ] Footprint data API endpoint responds within 500ms (with Redis cache).
