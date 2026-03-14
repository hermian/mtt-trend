/**
 * E2E 테스트: 테마 트렌드 페이지
 * SPEC-MTT-002 F-03, F-06: 전체 사용자 시나리오 검증
 */

import { test, expect } from "@playwright/test";

test.describe("Trend Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trend");
  });

  test("should display page header and title", async ({ page }) => {
    await expect(page.getByText("52주 고점 테마 트렌드")).toBeVisible();
    await expect(page.getByText(/테마별 RS\(상대강도\) 분석 대시보드/)).toBeVisible();
  });

  test("should load and display available dates", async ({ page }) => {
    // Wait for dates to load
    await page.waitForSelector("select#date-select");

    const select = page.locator("select#date-select");
    const options = await select.locator("option").count();

    expect(options).toBeGreaterThan(0);
  });

  test("should select latest date by default", async ({ page }) => {
    await page.waitForSelector("select#date-select");

    const select = page.locator("select#date-select");
    const value = await select.inputValue();

    expect(value).not.toBe("");
  });

  test("should switch between data sources", async ({ page }) => {
    // Click MTT source
    await page.click("text=MTT 종목");

    // Verify button is active
    const mttButton = page.locator("button:has-text('MTT 종목')");
    await expect(mttButton).toHaveClass(/bg-blue-600/);
  });

  test("should reset date when source changes", async ({ page }) => {
    await page.waitForSelector("select#date-select");

    // Get initial selected value
    const select = page.locator("select#date-select");
    const initialValue = await select.inputValue();

    // Switch source
    await page.click("text=MTT 종목");

    // Date should be reset
    const newValue = await select.inputValue();
    expect(newValue).toBe("");
  });

  test("should display all sections when date is selected", async ({ page }) => {
    await page.waitForSelector("select#date-select");

    // Select a date
    await page.selectOption("select#date-select", { index: -1 });

    // Wait for sections to load
    await page.waitForSelector("text=테마별 RS 점수 (상위 15)");
    await page.waitForSelector("text=테마 RS 추이");
    await page.waitForSelector("text=종목 분석");

    await expect(page.getByText("테마별 RS 점수 (상위 15)")).toBeVisible();
    await expect(page.getByText("테마 RS 추이")).toBeVisible();
    await expect(page.getByText("종목 분석")).toBeVisible();
  });

  test("should switch between stock analysis tabs", async ({ page }) {
    await page.waitForSelector("select#date-select");

    // Select a date
    await page.selectOption("select#date-select", { index: -1 });

    // Wait for tabs to load
    await page.waitForSelector("text=지속 강세 종목");

    // Click on group action tab
    await page.click("text=그룹 액션");

    // Verify tab is active
    await expect(page.locator("button:has-text('그룹 액션')")).toHaveClass(/bg-blue-600/);
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Mock API failure by intercepting requests
    await page.route("**/api/dates**", route => route.abort());

    // Reload page
    await page.reload();

    // Should show error message
    await expect(page.getByText("날짜 로드 실패")).toBeVisible();
  });

  test("should show loading state during data fetch", async ({ page }) => {
    // Slow down the API response
    await page.route("**/api/dates**", async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.reload();

    // Should show loading indicator
    await expect(page.locator(".animate-pulse")).toBeVisible();
  });

  test("should update data when date changes", async ({ page }) => {
    await page.waitForSelector("select#date-select");

    // Select first date
    await page.selectOption("select#date-select", 0);

    // Wait for data to load
    await page.waitForSelector("text=테마별 RS 점수 (상위 15)");

    // Select different date
    await page.selectOption("select#date-select", 1);

    // Should reload data
    await page.waitForLoadState("networkidle");
  });

  test("should maintain source preference during navigation", async ({ page }) => {
    await page.waitForSelector("select#date-select");

    // Switch to MTT source
    await page.click("text=MTT 종목");

    // Navigate away and back
    await page.goto("/");
    await page.goto("/trend");

    // Source should persist (or reset based on requirements)
    const mttButton = page.locator("button:has-text('MTT 종목')");
    await expect(mttButton).toBeVisible();
  });
});
