# Gold Tracker 🪙

A static, installable PWA for tracking Egyptian gold holdings against live market prices. No backend, no database, no sign-up — just a GitHub repo that updates itself every 30 minutes.

## What it does

- **Live prices** — A scheduled GitHub Action scrapes [market.isagha.com/prices/eg](https://market.isagha.com/prices/eg) every 30 minutes and commits the results to `public/prices.json`. The app reads this file directly (same-origin, no CORS, no API key).
- **Portfolio tracking** — Add your gold holdings (karat, weight in grams, purchase price). The app computes:
  - Invested amount vs. current market value
  - Profit/loss in EGP and %
  - Portfolio-wide totals
- **Since Last Visit** — Compares today's price against the last time you opened the app, per karat.
- **Offline shell** — Service worker caches the app shell so it loads even without a connection. Prices always come fresh from the network.
- **Installable** — Meets PWA installability criteria; Chrome/Edge will offer "Add to Home Screen".

All holdings are stored in `localStorage` — nothing leaves your device.

---

## Project structure

```
gold-tracker-eg/
├── index.html                         App shell
├── manifest.json                      PWA manifest
├── sw.js                              Service worker
├── assets/
│   ├── gold-price.js                  Price fetching & diff logic (DO NOT MODIFY)
│   ├── app.js                         App logic (portfolio CRUD, rendering)
│   └── style.css                      Styles
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── public/
│   └── prices.json                    ← Written by GitHub Action, read by app
└── scripts/
    └── scrape-gold-price.js           Scraper run by the Action
```

---

## Local development

No build step. Just serve the files with any static server.

**Option 1 — npx serve (recommended):**
```bash
npx serve .
# Open http://localhost:3000
```

**Option 2 — Python:**
```bash
python -m http.server 3000
# Open http://localhost:3000
```

**Option 3 — VS Code Live Server** — right-click `index.html` → *Open with Live Server*.

> ⚠ Do NOT open `index.html` directly via `file://` — ES modules and service workers require an HTTP origin.

### Test data

A sample `public/prices.json` is included so the app works without waiting for the Action to run. Delete it to test the "prices unavailable" error state.

---

## How the price-update Action works

File: [`.github/workflows/update-gold-price.yml`](.github/workflows/update-gold-price.yml)

1. **Triggers** every 30 minutes (cron) and on manual dispatch from the Actions tab.
2. Runs `node scripts/scrape-gold-price.js`, which:
   - Fetches the public iSagha Egypt gold price page
   - Parses Arabic karat labels using a regex (no HTML parser dependency)
   - Writes structured JSON to `public/prices.json`
3. If the file changed, the Action commits and pushes `public/prices.json`.

The app reads this file on load with a cache-busting query param, so GitHub Pages' CDN doesn't serve stale data.

### Adjusting the schedule

Edit the cron expression in `.github/workflows/update-gold-price.yml`:

```yaml
- cron: "*/30 * * * *"   # every 30 minutes
- cron: "*/15 * * * *"   # every 15 minutes
- cron: "0 * * * *"      # hourly
```

Be respectful of iSagha's server.

---

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages → Source → Branch: main / (root)**.
3. The app will be live at `https://username.github.io/repo-name/`.
4. The Action will start running on its schedule automatically (needs `contents: write` permission, which is already set).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | Vanilla HTML / CSS / JS — no framework, no build |
| Styling | Custom CSS (dark gold theme, glassmorphism) |
| Font | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |
| Storage | `localStorage` |
| PWA | Web App Manifest + Service Worker |
| Price data | GitHub Actions + iSagha scraper |
| Hosting | GitHub Pages (static) |
