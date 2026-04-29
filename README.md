# VisualDiff — Visual Regression Testing Platform

A full-stack visual regression testing platform with a React dashboard and Express backend. No CLI required — run tests directly from the browser.

---

## 📁 Project Structure

```
VR APP V4/
├── backend/                  ← Express API server (port 4000)
│   ├── server.js
│   ├── db.js                 ← PostgreSQL schema + connection pool
│   ├── middleware/
│   │   └── auth.js           ← JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js           ← Register / Login (JWT)
│   │   ├── config.js         ← Per-user config + page crawler
│   │   ├── runs.js           ← Run management + Playwright capture + diff generation
│   │   └── snapshots.js      ← Baseline approval + pixel diff
│   └── uploads/              ← Auto-created image storage
│       ├── snapshots/        ← Captured staging + production screenshots
│       ├── baselines/{userId}/ ← Per-user approved baseline images
│       └── diffs/            ← Generated diff images (production + red rectangles)
│
└── frontend/                 ← React + Vite dashboard (port 5173)
    └── src/
        ├── pages/
        │   ├── AuthPage.jsx        ← Login / Register
        │   ├── Dashboard.jsx       ← Run history, pass/fail stats
        │   ├── RunDetail.jsx       ← Per-test diff viewer + approve baseline
        │   ├── ConfigPage.jsx      ← Viewports and threshold settings
        │   ├── ComparePage.jsx     ← Staging vs production compare
        │   └── BaselinesPage.jsx   ← View all approved baselines
        ├── components/Sidebar.jsx
        ├── context/
        │   ├── AuthContext.jsx
        │   └── ThemeContext.jsx
        └── api/client.js
```

---

## 🚀 Setup & Running

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (default: `localhost:5432`)

### 1. Database

Create a database named `vrapp`:

```sql
CREATE DATABASE vrapp;
```

The schema is auto-created on first server start.

### 2. Backend

```bash
cd backend
npm install
npx playwright install chromium
npm start
# → http://localhost:4000
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/vrapp
JWT_SECRET=your-secret-here
PORT=4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🔐 Authentication

- Register/login via the web UI
- JWT tokens (7-day expiry)
- All `/api/*` endpoints require `Authorization: Bearer <token>` header (except `/api/auth`)
- Each user's run history and baselines are private

---

## 🖥️ How to Use

1. **Register / Login** at `http://localhost:5173`
2. **Compare** — enter a staging URL and production URL, click **Discover Paths** to crawl all pages, select which paths to compare, choose viewports, then click **Compare**
3. **Dashboard** — view your personal run history with pass/fail stats; click any run to inspect results
4. **Run Detail** — inspect each screenshot card and open the diff viewer:
   - **Slider** — drag the divider left/right to reveal staging vs production
   - **Side by Side** — synchronized scroll between both screenshots
   - **Diff** — production image with red rectangles drawn around changed regions
   - Click **Approve as Baseline** to promote a screenshot as the reference
5. **Config** — adjust pixel threshold, fail threshold, and viewport dimensions per account
6. **Baselines** — view and manage all approved baseline images per page/viewport

---

## 🖥️ Page Features

| Page | Features |
|------|----------|
| **Dashboard** | Personal run history, pass/fail stats, live polling while run is active, delete runs |
| **Compare** | Crawl staging URL to discover paths, checkbox path picker, viewport selector, popup dismiss toggle, live result streaming |
| **Run Detail** | Screenshot cards, slider/side-by-side/diff viewer, filter by pass/fail, approve baseline |
| **Config** | Per-user viewport sizes and comparison thresholds |
| **Baselines** | List all approved baselines per page and viewport |

---

## 🔍 Diff Image Format

Diff images show the **production screenshot** with **red rectangles** drawn around each region where pixels changed:

- Changed pixels are detected using [pixelmatch](https://github.com/mapbox/pixelmatch)
- Diff pixels (`255,0,0`) are bucketed into 4×4px cells
- Adjacent dirty cells are clustered via 4-connected BFS
- One red rectangle is drawn per cluster with 6px padding
- If no pixels differ, the production image is copied as-is

---

## 🔍 Popup & Overlay Handling

Screenshots are taken with automatic popup dismissal using a 4-layer strategy:

1. **Browser dialogs** — `alert()`, `confirm()`, `prompt()` are auto-dismissed
2. **DOM removal** — cookie banners, consent overlays, and modal elements are removed by known ID/class patterns (`#onetrust-*`, `[class*="cookie"]`, `[class*="modal"]`, etc.)
3. **Accept button clicks** — common consent buttons are clicked ("Accept all", "Got it", "I agree", etc.)
4. **Fixed overlay sweep** — any remaining `position: fixed/absolute` elements with `z-index > 1` are hidden, while preserving the site's own navigation bar

---

## 🌐 Capture Reliability

Each page capture uses:

- `--no-sandbox` browser flags for compatibility across environments
- `ignoreHTTPSErrors: true` for staging sites with self-signed certificates
- `waitUntil: 'load'` with automatic fallback to `domcontentloaded` on timeout
- 1.5s settle wait after navigation for JS-rendered content
- 30s timeout per page

---

## ⚙️ API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |

### Runs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/runs` | ✅ | List runs for the authenticated user |
| GET | `/api/runs/:runId` | ✅ | Get run details (owner only) |
| POST | `/api/runs/compare` | ✅ | Capture staging + production screenshots and diff them |
| POST | `/api/runs/trigger` | ✅ | Run snapshot tests against saved config |
| DELETE | `/api/runs/:runId` | ✅ | Delete a run and its image files |
| PATCH | `/api/runs/:runId/finish` | ✅ | Finalize a run |

### Snapshots

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/snapshots/approve` | ✅ | Promote a snapshot as the new baseline |
| GET | `/api/snapshots/baselines` | ✅ | List all baselines for the current user |

### Config

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/config` | ✅ | Get this user's config |
| PUT | `/api/config` | ✅ | Save this user's config |
| POST | `/api/config/crawl` | ✅ | Crawl a base URL, returns all discovered internal pages |

---

## 🗄️ Storage

| Type | Location |
|------|----------|
| Users, runs, configs | PostgreSQL (`vrapp` database) |
| Captured screenshots | `backend/uploads/snapshots/` |
| Approved baselines | `backend/uploads/baselines/{userId}/` |
| Diff images | `backend/uploads/diffs/` |

---

## 🎨 Tech Stack

- **Frontend**: React 19, Vite, React Router, Axios, react-hot-toast, Lucide icons
- **Backend**: Node.js, Express, Playwright (Chromium), JWT, bcryptjs, Multer, Sharp, Pixelmatch, PNGjs, fs-extra
- **Database**: PostgreSQL (via `pg`)
