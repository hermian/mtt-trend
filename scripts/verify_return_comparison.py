# scripts/verify_return_comparison.py
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

OUTPUT_DIR = Path("artifacts/playwright")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 1000})
        page = await context.new_page()

        print("1. Navigating to http://localhost:3000/trend?tab=returns ...")
        await page.goto("http://localhost:3000/trend?tab=returns", wait_until="networkidle")

        # Check title / header
        title = await page.text_content("h1")
        print(f"Page Title: {title}")
        assert "수익률 비교" in title, f"Unexpected title: {title}"

        # Wait for statistics table to be rendered
        print("2. Verifying default view (삼성전자 vs NVDA)...")
        await page.wait_for_selector("table", timeout=10000)
        
        # Check text in table
        content = await page.content()
        assert "삼성전자" in content, "삼성전자 not found in page content"
        assert "NVIDIA" in content or "NVDA" in content, "NVIDIA/NVDA not found in page content"
        assert "기간별 수익률 및 기술 통계 요약" in content, "Statistics table header not found"
        assert "종목간 상관계수 분석" in content, "Correlation section header not found"

        await page.wait_for_timeout(1000)
        samsung_nvda_ss = OUTPUT_DIR / "return_compare_samsung_nvda.png"
        await page.screenshot(path=str(samsung_nvda_ss), full_page=True)
        print(f"Saved screenshot: {samsung_nvda_ss}")

        # 3. Click Preset "KODEX 200 vs SPY"
        print("3. Testing preset: KODEX 200 vs SPY ...")
        preset_btn = page.get_by_role("button", name="KODEX 200 vs SPY")
        await preset_btn.click()

        # Wait for network request to complete and table to update
        await page.wait_for_timeout(2000)
        content_kodex = await page.content()
        assert "KODEX 200" in content_kodex, "KODEX 200 not found after clicking preset"
        assert "SPY" in content_kodex or "SPDR" in content_kodex, "SPY not found after clicking preset"

        kodex_spy_ss = OUTPUT_DIR / "return_compare_kodex_spy.png"
        await page.screenshot(path=str(kodex_spy_ss), full_page=True)
        print(f"Saved screenshot: {kodex_spy_ss}")

        # 4. Test adding an item via search
        print("4. Testing stock search & add ...")
        # Click KR + 종목
        kr_btn = page.locator("button", has_text="KR").first
        await kr_btn.click()
        stock_btn = page.locator("button", has_text="종목").first
        await stock_btn.click()

        # Type in search input
        search_input = page.locator("input[placeholder*='국내 종목명 또는 코드']")
        await search_input.click()
        await search_input.fill("SK하이닉스")
        await page.wait_for_timeout(1000)
        await search_input.press("Enter")
        await page.wait_for_timeout(2500)
        content_3assets = await page.content()
        assert "SK하이닉스" in content_3assets, "SK하이닉스 not found after adding"

        multi_ss = OUTPUT_DIR / "return_compare_3assets_search.png"
        await page.screenshot(path=str(multi_ss), full_page=True)
        print(f"Saved screenshot: {multi_ss}")

        # 5. Check correlation period tabs (3M, 6M, 12M, 3Y)
        print("5. Testing correlation period tabs ...")
        tab_3m = page.locator("button", has_text="3M")
        if await tab_3m.count() > 0:
            await tab_3m.first.click()
            await page.wait_for_timeout(500)

        tab_12m = page.locator("button", has_text="12M")
        if await tab_12m.count() > 0:
            await tab_12m.first.click()
            await page.wait_for_timeout(500)

        corr_ss = OUTPUT_DIR / "return_compare_correlation_12m.png"
        await page.screenshot(path=str(corr_ss), full_page=True)
        print(f"Saved screenshot: {corr_ss}")

        await browser.close()
        print("✅ All Playwright checks passed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
