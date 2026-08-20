import { test, expect } from "@playwright/test";

test.describe("AVWAP Chart Supertrend Feature E2E", () => {
  test("should toggle Supertrend indicator and configure parameters via popover", async ({ page }) => {
    // 1. Navigate to AVWAP chart tab
    await page.goto("/trend?tab=avwap");

    // Wait for the chart container to render
    const chartMain = page.locator('[data-chart-id="main"]');
    await expect(chartMain).toBeVisible({ timeout: 15000 });

    // 2. Verify Supertrend toggle button exists in control bar
    const supertrendBtn = page.getByRole("button", { name: "⚡ Supertrend" });
    await expect(supertrendBtn).toBeVisible();

    const gearBtn = page.locator('button[title*="Supertrend 파라미터 설정"]');
    await expect(gearBtn).toBeVisible();

    // 3. Toggle Supertrend ON
    await supertrendBtn.click();
    await expect(supertrendBtn).toHaveClass(/bg-emerald-500\/20/);

    // Verify HUD header displays Supertrend value
    const hudBar = page.locator(".font-mono.flex.flex-wrap");
    await expect(hudBar.getByText(/Supertrend\(10, 3\):/)).toBeVisible();

    // 4. Open Settings Popover
    await gearBtn.click();
    await expect(page.getByText("⚡ Supertrend 설정")).toBeVisible();
    await expect(page.getByText("ATR 기간 (Period)")).toBeVisible();

    // 5. Change ATR period to 14
    const periodInput = page.locator('input[type="number"]').first();
    await periodInput.fill("14");

    // Verify HUD reflects new parameters (14, 3)
    await expect(hudBar.getByText(/Supertrend\(14, 3\):/)).toBeVisible();

    // 6. Close Popover via confirmation button
    const confirmBtn = page.getByRole("button", { name: "확인" });
    await confirmBtn.click();
    await expect(page.getByText("⚡ Supertrend 설정")).not.toBeVisible();

    // 7. Toggle Supertrend OFF
    await supertrendBtn.click();
    await expect(hudBar.getByText(/Supertrend\(14, 3\):/)).not.toBeVisible();
  });
});
