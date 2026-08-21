import { test, expect } from "@playwright/test";

test.describe("Select KODEX 인버스 Performance & Supertrend Check", () => {
  test("measure time to select, render, and toggle Supertrend on KODEX 인버스", async ({ page }) => {
    await page.goto("/trend?tab=avwap");

    const chartMain = page.locator('[data-chart-id="main"]');
    await expect(chartMain).toBeVisible({ timeout: 15000 });

    // Switch to ETF
    const etfBtn = page.getByRole("button", { name: "ETF", exact: true });
    await etfBtn.click();

    // Type in search
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill("kodex 인버스");

    // Wait for dropdown
    const dropdownItem = page.getByRole("button", { name: /KODEX 인버스/ }).first();
    await expect(dropdownItem).toBeVisible({ timeout: 5000 });

    const startTime = Date.now();
    await dropdownItem.click();

    // Wait for chart header to update
    const headerTitle = page.locator("span").filter({ hasText: /KODEX 인버스/ }).first();
    await expect(headerTitle).toBeVisible({ timeout: 15000 });

    const elapsed = Date.now() - startTime;
    console.log(`Time taken to load KODEX 인버스: ${elapsed}ms`);

    // Toggle Supertrend
    const supertrendBtn = page.getByRole("button", { name: "⚡ Supertrend" });
    const stStartTime = Date.now();
    await supertrendBtn.click();

    // Verify HUD header displays Supertrend
    const hudBar = page.locator(".font-mono.flex.flex-wrap");
    await expect(hudBar.getByText(/Supertrend\(10, 3\):/)).toBeVisible();
    const stElapsed = Date.now() - stStartTime;
    console.log(`Time taken to toggle Supertrend on KODEX 인버스: ${stElapsed}ms`);

    // Take screenshot
    await page.waitForTimeout(500);
    await chartMain.screenshot({ path: "test-results/kodex-inverse-supertrend-chart.png" });
  });
});
