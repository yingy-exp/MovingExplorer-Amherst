// Nestmap – Playwright test suite
// Requires the dev server running on http://localhost:3456
// Run: cd Tests && npm install && npm test

const { test, expect } = require('@playwright/test');

// ─── Helper ────────────────────────────────────────────────────────
// Navigate to the app and complete all 3 onboarding steps with
// "Either" selections so all 5 listings are visible.
async function completeOnboarding(page) {
  await page.goto('/');

  // Wait for CSV data to load and first onboarding step to render
  await page.waitForSelector('.ob-opt', { timeout: 10_000 });

  // Step 1 – home type: Either (3rd button)
  await page.click('.ob-opt:nth-child(3)');
  await page.click('#ob-btn');

  // Step 2 – bedrooms: Either (3rd button)
  await page.click('.ob-opt:nth-child(3)');
  await page.click('#ob-btn');

  // Step 3 – rent: keep default $2,500, click "Show me the map"
  await page.click('#ob-btn');

  // Wait for map and at least the first housing card
  await page.waitForSelector('.leaflet-container', { timeout: 10_000 });
  await page.waitForSelector('#card-h1', { timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════════════
// 1. ONBOARDING QUESTIONNAIRE
// ═══════════════════════════════════════════════════════════════════
test.describe('Onboarding questionnaire', () => {
  test('shows all 3 steps in sequence and lands on the map', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ob-opt');

    // Step 1
    await expect(page.locator('#onboarding')).toBeVisible();
    await expect(page.locator('text=STEP 1 OF 3')).toBeVisible();
    await page.click('.ob-opt:nth-child(1)'); // House
    await page.click('#ob-btn');

    // Step 2
    await expect(page.locator('text=STEP 2 OF 3')).toBeVisible();
    await page.click('.ob-opt:nth-child(1)'); // 2 bedrooms
    await page.click('#ob-btn');

    // Step 3
    await expect(page.locator('text=STEP 3 OF 3')).toBeVisible();
    await page.click('#ob-btn'); // Show me the map

    // Onboarding gone, map visible
    await page.waitForSelector('.leaflet-container');
    await expect(page.locator('#onboarding')).toBeHidden();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('Continue button is disabled until an option is selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#ob-btn');

    // No option selected yet → disabled
    await expect(page.locator('#ob-btn')).toBeDisabled();

    // Select an option → enabled
    await page.click('.ob-opt:nth-child(2)');
    await expect(page.locator('#ob-btn')).toBeEnabled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. MAP RENDERING
// ═══════════════════════════════════════════════════════════════════
test.describe('Map rendering', () => {
  test('renders map tiles, housing cards, and markers', async ({ page }) => {
    await completeOnboarding(page);

    // At least one tile has loaded
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10_000 });
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();

    // All 5 housing cards visible in the list panel
    await expect(page.locator('#card-h1')).toBeVisible();
    await expect(page.locator('#card-h5')).toBeVisible();

    // Results bar reports count
    await expect(page.locator('#rbar')).toContainText('listings found');

    // Many map markers: 5 houses + 79 daycares + 1 UMass = 85+
    const markerCount = await page.locator('.leaflet-marker-icon').count();
    expect(markerCount).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. DAYCARE MARKER TOOLTIP
// ═══════════════════════════════════════════════════════════════════
test.describe('Daycare marker tooltip', () => {
  test('hovering a daycare marker shows a tooltip with its name', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10_000 });

    // Daycares far outnumber housing markers; try the first 20 and expect at
    // least one tooltip (daycares use bindTooltip, housing markers do not).
    const markers = page.locator('.leaflet-marker-icon');
    const count = await markers.count();

    let found = false;
    for (let i = 0; i < Math.min(count, 20); i++) {
      await markers.nth(i).hover({ force: true });
      const tooltip = page.locator('.leaflet-tooltip');
      if (await tooltip.isVisible().catch(() => false)) {
        // Tooltip should contain some text (daycare name)
        const text = await tooltip.textContent();
        expect(text.trim().length).toBeGreaterThan(0);
        found = true;
        break;
      }
    }
    expect(found, 'Expected at least one marker to show a tooltip').toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. HOUSING MARKER — POPUP AND COMMUTE ROUTE
// ═══════════════════════════════════════════════════════════════════
test.describe('Housing marker interaction', () => {
  test('clicking a housing card opens a popup with price and address', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('#card-h1');

    await page.click('#card-h1');

    // Popup appears
    await page.waitForSelector('.leaflet-popup', { timeout: 5_000 });
    await expect(page.locator('.leaflet-popup')).toBeVisible();

    const popup = page.locator('.leaflet-popup-content');
    // Shows a rent price
    await expect(popup).toContainText('$');
    // Commute starts calculating (or already resolved)
    await expect(popup).toContainText(/Calculating commute|min to UMass/);
  });

  test('commute route polyline appears on the map after clicking a card', async ({ page }) => {
    // OSRM can be slow — give this test more time
    test.setTimeout(45_000);

    await completeOnboarding(page);
    await page.waitForSelector('#card-h2');
    await page.click('#card-h2');

    // Wait for the route polyline (Leaflet adds .leaflet-interactive to SVG paths)
    await page.waitForSelector('path.leaflet-interactive', { timeout: 25_000 });
    await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();

    // Popup should now show the resolved commute time
    await expect(page.locator('.leaflet-popup-content')).toContainText('min to UMass', { timeout: 25_000 });
  });

  test('clicking a second property clears the previous route popup', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('#card-h1');

    await page.click('#card-h1');
    await page.waitForSelector('.leaflet-popup', { timeout: 5_000 });

    await page.click('#card-h2');
    await page.waitForSelector('.leaflet-popup', { timeout: 5_000 });

    // The most recently opened popup should show the second property (North 116 Flats → Sunderland)
    await expect(page.locator('.leaflet-popup-content').last()).toContainText('Sunderland');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. DAYCARE FILTERS
// ═══════════════════════════════════════════════════════════════════
test.describe('Daycare filters', () => {
  test('filtering by type (In-home) reduces marker count and updates the badge', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10_000 });

    const markersBefore = await page.locator('.leaflet-marker-icon').count();
    const badgeBefore = await page.locator('#dc-count-badge').textContent();

    // Open daycare sidebar
    await page.click('#dc-toggle-btn');
    await page.waitForSelector('#dcsidebar.on');

    // Switch to in-home only
    await page.click('#dcf-family');
    await page.click('button:has-text("Apply daycare filters")');

    // Wait for re-render
    await page.waitForTimeout(600);

    const markersAfter = await page.locator('.leaflet-marker-icon').count();
    const badgeAfter = await page.locator('#dc-count-badge').textContent();

    expect(markersAfter).toBeLessThan(markersBefore);
    expect(badgeAfter).not.toEqual(badgeBefore);
  });

  test('resetting filter back to All restores original marker count', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10_000 });

    const markersFull = await page.locator('.leaflet-marker-icon').count();

    // Apply center-only filter
    await page.click('#dc-toggle-btn');
    await page.waitForSelector('#dcsidebar.on');
    await page.click('#dcf-center');
    await page.click('button:has-text("Apply daycare filters")');
    await page.waitForTimeout(600);

    // Reset to All
    await page.click('#dcf-all');
    await page.click('button:has-text("Apply daycare filters")');
    await page.waitForTimeout(600);

    const markersRestored = await page.locator('.leaflet-marker-icon').count();
    expect(markersRestored).toEqual(markersFull);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. EDIT HOUSING PREFERENCES
// ═══════════════════════════════════════════════════════════════════
test.describe('Edit housing preferences', () => {
  test('changing type to Apartment updates the results bar count', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('#rbar');

    const countBefore = await page.locator('#rbar').textContent();

    // Re-open onboarding
    await page.click('button:has-text("Edit preferences")');
    await page.waitForSelector('.ob-opt');

    // Step 1: Apartment only (2nd button)
    await page.click('.ob-opt:nth-child(2)');
    await page.click('#ob-btn');

    // Step 2: Either beds
    await page.click('.ob-opt:nth-child(3)');
    await page.click('#ob-btn');

    // Step 3: accept rent default
    await page.click('#ob-btn');

    await page.waitForSelector('#rbar');
    const countAfter = await page.locator('#rbar').textContent();

    // Some listings were townhomes/houses; apartment filter should change the count
    expect(countAfter).not.toEqual(countBefore);
  });

  test('lowering max rent hides listings above the threshold', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForSelector('#rbar');

    const countBefore = parseInt(
      (await page.locator('#rbar').textContent()).match(/\d+/)?.[0] ?? '0'
    );

    await page.click('button:has-text("Edit preferences")');
    await page.waitForSelector('.ob-opt');

    // Step 1 & 2: Either
    await page.click('.ob-opt:nth-child(3)');
    await page.click('#ob-btn');
    await page.click('.ob-opt:nth-child(3)');
    await page.click('#ob-btn');

    // Step 3: drag rent slider to minimum ($1,000) — slider has no ID, select by context
    const slider = page.locator('#onboarding input[type=range]');
    await slider.evaluate(el => {
      el.value = 1000;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#ob-btn');

    await page.waitForSelector('#rbar');
    const countAfter = parseInt(
      (await page.locator('#rbar').textContent()).match(/\d+/)?.[0] ?? '0'
    );

    expect(countAfter).toBeLessThan(countBefore);
  });
});
