# Nestmap — Amherst Housing & Daycare Finder

An interactive map for UMass Amherst affiliates searching for housing with nearby daycare access. Filter listings by type, rent, and daycare preferences. Click any property to see the driving commute to UMass and the nearest daycare options along the route.

Click [here](https://yingy-exp.github.io/MovingExplorer-Amherst/) or visit https://yingy-exp.github.io/MovingExplorer-Amherst/ to play around.

<img width="1540" height="812" alt="Screenshot 2026-03-29 at 10 03 04 AM" src="https://github.com/user-attachments/assets/59898481-4c61-4e8e-a705-777a371beef5" />

---

## Features

- **Housing listings** — filtered by type (Apartment / Townhome / House), bedrooms, and max rent
- **Daycare markers** — color-coded by nearest housing; filterable by type (In-home / Center), child's age, and monthly price
- **Commute route** — click any listing to draw the driving route to UMass Math & Statistics and show commute time (via OSRM)
- **On-the-way daycares** — daycares geometrically close to the commute corridor are highlighted in the popup
- **Onboarding questionnaire** — three-step wizard that sets initial housing preferences

---

## Running Locally

No build step required. Serve the project root with any static file server:

```bash
python3 -m http.server 3456
```

Then open **http://localhost:3456** in your browser.

---

## Project Structure

```
index.html                          # Entire app (HTML + CSS + JS, single file)
geocode.py                          # CLI tool to add lat/lng to CSV databases
Databases/
  Daycare Amherst - Sheet1.csv      # Active daycare database
  Amherst Housing 2026 - Sheet1.csv # Active housing database
  DayCareAmherst.csv                # Source EEC registry (reference only)
Tests/
  app.test.js                       # Playwright end-to-end test suite
  playwright.config.js              # Test config (baseURL: http://localhost:3456)
  package.json
```

---

## Updating the Data

### Adding housing listings

1. Add rows to `Databases/Amherst Housing 2026 - Sheet1.csv` following the existing column structure
2. Leave `lat` and `lng` blank
3. Run the geocoder:
   ```bash
   python3 geocode.py "Databases/Amherst Housing 2026 - Sheet1.csv"
   ```
4. Verify coordinates look correct, then reload the app

### Adding daycare listings

1. Add rows to `Databases/Daycare Amherst - Sheet1.csv`
   Required columns: `Daycare`, `Address`, `Price` (e.g. `1800/month`), `Town`, `Program Type` (`Large Group` or `Family Child Care`), `minAge`, `maxAge`
2. Leave `lat` and `lng` blank
3. Run the geocoder:
   ```bash
   python3 geocode.py "Databases/Daycare Amherst - Sheet1.csv"
   ```

### `geocode.py` behavior

- Skips rows that already have valid `lat`/`lng` values
- Skips rows with no usable address (prints a warning)
- Handles addresses exported from Google Sheets (double-space before state abbreviation)
- Uses [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) — free, no API key needed, rate-limited to 1 req/s

---

## Running Tests

```bash
cd Tests
npm install
npm test
```

Requires the dev server running on port 3456. The suite covers:

- Onboarding questionnaire flow
- Map tile and marker rendering
- Daycare tooltip on hover
- Housing popup with commute info
- Commute route polyline
- Daycare filters (type, age, price)
- Housing preference editing (type, rent slider)
