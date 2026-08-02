import type { ETFItem } from "./types";

export type MarketKey = "KR" | "US" | "GLOBAL";

/**
 * ETF/인덱스 타일 → 네이버 링크.
 * 한국(KR) ETF는 stock.naver 국내 종목(price) 페이지, 인덱스는 domestic/index 지수 페이지로 연결.
 * 미국/세계(US/GLOBAL) ETF는 stock.naver worldstock ETF(price) 페이지, 지수는 worldstock/index 지수 페이지로 연결.
 * KOSDAQ 150은 네이버에 지수 페이지가 없어 KODEX 코스닥150 ETF(stock.naver 국내 종목)로 대체한다.
 */
const OVERRIDE_LINKS: Record<string, string> = {
  KOSPI: "https://stock.naver.com/domestic/index/KOSPI/price",
  KOSDAQ: "https://stock.naver.com/domestic/index/KOSDAQ/price",
  KOSPI200: "https://stock.naver.com/domestic/index/KPI200/price",
  KOSDAQ150: "https://stock.naver.com/domestic/stock/229200/price",
};
const US_INDEX_LINKS: Record<string, string> = {
  sp500: "https://stock.naver.com/worldstock/index/.INX/price",
  nasdaq100: "https://stock.naver.com/worldstock/index/.IXIC/price",
  DIA: "https://stock.naver.com/worldstock/index/.DJI/price",
};
/**
 * 미국/세계 탭의 시장 지수 타일은 네이버 해외 지수(index) 페이지로 연결한다.
 * DIA 코드는 지수(DOW)와 ETF(DOW30)에 모두 쓰이므로 이름으로 구분한다.
 */
function usIndexLink(etf: ETFItem): string | null {
  if (etf.code === "DIA" && etf.name !== "DOW") return null;
  return US_INDEX_LINKS[etf.code] ?? null;
}

export function etfLink(etf: ETFItem, market: MarketKey = "KR"): string {
  if (market === "US" || market === "GLOBAL") {
    return usIndexLink(etf) ??
      `https://stock.naver.com/worldstock/etf/${etf.url ?? etf.code}/price`;
  }
  return OVERRIDE_LINKS[etf.code] ??
    `https://stock.naver.com/domestic/stock/${etf.code}/price`;
}