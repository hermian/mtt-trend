/**
 * E2E 테스트: 테마 트렌드 페이지 동적 높이 조정
 * SPEC-MTT-004 F-04: 콘텐츠 기반 동적 높이 조정
 */

import { test, expect } from "@playwright/test";

test.describe("Trend Page Dynamic Height (F-04)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trend");
    // Wait for initial data load
    await page.waitForSelector("select#date-select");
    // Select a date to display content
    await page.selectOption("select#date-select", { index: -1 });
    // Wait for sections to load
    await page.waitForSelector("text=테마별 RS 점수");
  });

  test("AC-04-1: should adjust container height for 10 themes", async ({ page }) => {
    // Set theme count to 10 (default)
    const slider = page.locator("#theme-count-slider");
    await expect(slider).toHaveValue("10");

    // Get the two column containers
    const leftColumn = page.locator("section").locator("> div").first();
    const rightColumn = page.locator("section").locator("> div").nth(1);

    // Measure heights
    const leftBox = await leftColumn.boundingBox();
    const rightBox = await rightColumn.boundingBox();

    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();

    // Both columns should have equal height (CSS Grid items-stretch)
    expect(leftBox!.height).toBeCloseTo(rightBox!.height, 5);

    // Height should be based on content, not fixed 600px
    // Content with 10 themes typically results in 500-700px height
    expect(leftBox!.height).toBeGreaterThan(400);
    expect(leftBox!.height).toBeLessThan(800);
  });

  test("AC-04-2: should adjust container height for 30 themes (maximum)", async ({ page }) => {
    // Set theme count to maximum (30)
    const slider = page.locator("#theme-count-slider");
    await slider.fill("30");
    await slider.evaluate((el) => el.dispatchEvent(new Event("input")));

    // Wait for content to update
    await page.waitForTimeout(500);

    // Get the two column containers
    const leftColumn = page.locator("section").locator("> div").first();
    const rightColumn = page.locator("section").locator("> div").nth(1);

    // Measure heights
    const leftBox = await leftColumn.boundingBox();
    const rightBox = await rightColumn.boundingBox();

    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();

    // Both columns should still have equal height
    expect(leftBox!.height).toBeCloseTo(rightBox!.height, 5);

    // Height should be significantly larger for 30 themes
    // 30 themes typically results in 900-1200px height
    expect(leftBox!.height).toBeGreaterThan(800);
    expect(leftBox!.height).toBeLessThan(1500);

    // Verify it doesn't encroach on "테마 RS 추이" section
    const trendChartSection = page.locator("section").filter({ hasText: "테마 RS 추이" });
    const trendChartBox = await trendChartSection.boundingBox();

    expect(trendChartBox).not.toBeNull();

    // The gap should be consistent (space-y-6 = 1.5rem = 24px)
    // Check that the trend chart section is below the 2-column section
    expect(trendChartBox!.y).toBeGreaterThan((leftBox!.y + leftBox!.height));
  });

  test("AC-04-3: should adjust container height for 5 themes (minimum)", async ({ page }) => {
    // Set theme count to minimum (5)
    const slider = page.locator("#theme-count-slider");
    await slider.fill("5");
    await slider.evaluate((el) => el.dispatchEvent(new Event("input")));

    // Wait for content to update
    await page.waitForTimeout(500);

    // Get the two column containers
    const leftColumn = page.locator("section").locator("> div").first();
    const rightColumn = page.locator("section").locator("> div").nth(1);

    // Measure heights
    const leftBox = await leftColumn.boundingBox();
    const rightBox = await rightColumn.boundingBox();

    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();

    // Both columns should have equal height
    expect(leftBox!.height).toBeCloseTo(rightBox!.height, 5);

    // Height should be smaller for 5 themes
    // 5 themes typically results in 300-500px height
    expect(leftBox!.height).toBeGreaterThan(200);
    expect(leftBox!.height).toBeLessThan(600);

    // Verify no unnecessary empty space
    // The height should be proportional to content, not fixed
    expect(leftBox!.height).toBeLessThan(500);
  });

  test("should maintain consistent spacing with subsequent sections", async ({ page }) => {
    // Test with default theme count (10)
    const twoColumnSection = page.locator("section").filter({
      has: page.locator("text=테마별 RS 점수")
    });
    const trendChartSection = page.locator("section").filter({
      hasText: "테마 RS 추이"
    });

    const twoColumnBox = await twoColumnSection.boundingBox();
    const trendChartBox = await trendChartSection.boundingBox();

    expect(twoColumnBox).not.toBeNull();
    expect(trendChartBox).not.toBeNull();

    // The gap should be consistent (space-y-6 = 1.5rem = 24px)
    const gap = trendChartBox!.y - (twoColumnBox!.y + twoColumnBox!.height);

    // Allow some tolerance for rendering differences
    expect(gap).toBeGreaterThan(20);
    expect(gap).toBeLessThan(30);
  });

  test("should not create unnecessary scrollbars within columns", async ({ page }) => {
    // Get the column containers
    const leftColumn = page.locator("section").locator("> div").first();
    const rightColumn = page.locator("section").locator("> div").nth(1);

    // Check if there's overflow-y-auto creating scrollbars
    const hasLeftOverflow = await leftColumn.evaluate((el) => {
      return window.getComputedStyle(el).overflowY === "auto" ||
             window.getComputedStyle(el).overflowY === "scroll";
    });

    const hasRightOverflow = await rightColumn.evaluate((el) => {
      return window.getComputedStyle(el).overflowY === "auto" ||
             window.getComputedStyle(el).overflowY === "scroll";
    });

    // Columns should not have forced scrolling
    expect(hasLeftOverflow).toBe(false);
    expect(hasRightOverflow).toBe(false);
  });

  test("should maintain equal column heights across different theme counts", async ({ page }) => {
    const slider = page.locator("#theme-count-slider");
    const themeCounts = [5, 10, 20, 30];

    for (const count of themeCounts) {
      // Set theme count
      await slider.fill(count.toString());
      await slider.evaluate((el) => el.dispatchEvent(new Event("input")));

      // Wait for content to update
      await page.waitForTimeout(500);

      // Get column heights
      const leftColumn = page.locator("section").locator("> div").first();
      const rightColumn = page.locator("section").locator("> div").nth(1);

      const leftBox = await leftColumn.boundingBox();
      const rightBox = await rightColumn.boundingBox();

      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();

      // Both columns should have equal height regardless of theme count
      expect(leftBox!.height).toBeCloseTo(rightBox!.height, 5);
    }
  });
});
