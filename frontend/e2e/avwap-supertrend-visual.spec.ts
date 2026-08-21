import { test, expect } from "@playwright/test";

test.describe("AVWAP Chart Supertrend Visual Check", () => {
  test("capture supertrend chart with highlighting and signals", async ({ page }) => {
    await page.goto("/trend?tab=avwap");

    const chartMain = page.locator('[data-chart-id="main"]');
    await expect(chartMain).toBeVisible({ timeout: 15000 });

    const supertrendBtn = page.getByRole("button", { name: "⚡ Supertrend" });
    await expect(supertrendBtn).toBeVisible();

    // Toggle Supertrend ON
    await supertrendBtn.click();
    await page.waitForTimeout(1000);

    // Take screenshot of main chart
    await chartMain.screenshot({ path: "test-results/supertrend-chart.png" });
    console.log("Screenshot saved to test-results/supertrend-chart.png");
  });
});
