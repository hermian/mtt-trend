import { test, expect } from "@playwright/test";

test.describe("AVWAP 수급 사이드바 탭 E2E", () => {
  test("sidebar tab loads supply-demand only when selected", async ({ page }) => {
    await page.goto(
      "/trend?tab=avwap&symbol=078930&name=GS&type=stock&country=kr"
    );

    await expect(page.locator('[data-chart-id="main"]')).toBeVisible({ timeout: 20000 });

    // AVWAP 탭에서는 수급 API 호출 없어야 함
    const supplyCallsDuringAvwap: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/charts/supply-demand")) {
        supplyCallsDuringAvwap.push(req.url());
      }
    });
    await page.waitForTimeout(2000);
    expect(supplyCallsDuringAvwap.length).toBe(0);

    // 사이드바 AVWAP 수급 탭
    await page.getByRole("link", { name: "AVWAP 수급" }).click();
    await expect(page).toHaveURL(/tab=avwap_sugeub/);

    await page.waitForResponse(
      (r) => r.url().includes("/api/charts/supply-demand") && r.status() === 200,
      { timeout: 30000 }
    );

    await expect(page.getByText("수급 분석표 (상세)")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-chart-id="sugeub-dispersion"]')).toBeVisible();
  });
});
