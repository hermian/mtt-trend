import { describe, it, expect } from "vitest";
import { etfLink, type MarketKey } from "../links";

interface Case {
  code: string;
  name: string;
  url?: string;
}

function makeEtf(code: string, name: string, url?: string) {
  return { code, name, url, returns: {} as never };
}

describe("etfLink - 미주/세계", () => {
  const us: MarketKey = "US";
  const global: MarketKey = "GLOBAL";

  it("DB url(.O)이 있으면 worldstock/etf에 그대로 사용한다", () => {
    expect(etfLink(makeEtf("QQQ", "NASDAQ", "QQQ.O"), us))
      .toBe("https://stock.naver.com/worldstock/etf/QQQ.O/price");
  });

  it("DB url(.K)이 있으면 그대로 사용한다", () => {
    expect(etfLink(makeEtf("SCHD", "고배당", "SCHD.K"), us))
      .toBe("https://stock.naver.com/worldstock/etf/SCHD.K/price");
  });

  it("url이 없으면 code를 그대로 사용한다(무접미사)", () => {
    expect(etfLink(makeEtf("VOO", "S&P500"), us))
      .toBe("https://stock.naver.com/worldstock/etf/VOO/price");
  });

  it("GLOBAL 마켓도 동일 적용", () => {
    expect(etfLink(makeEtf("VWO", "신흥국", "VWO"), global))
      .toBe("https://stock.naver.com/worldstock/etf/VWO/price");
  });

  it("지수 타일은 기존 인덱스 링크를 우선한다", () => {
    expect(etfLink(makeEtf("sp500", "S&P500"), us))
      .toBe("https://stock.naver.com/worldstock/index/.INX/price");
    expect(etfLink(makeEtf("DIA", "DOW"), us))
      .toBe("https://stock.naver.com/worldstock/index/.DJI/price");
    expect(etfLink(makeEtf("DIA", "DOW30"), us))
      .toBe("https://stock.naver.com/worldstock/etf/DIA/price");
  });
});

describe("etfLink - 한국", () => {
  it("국내는 domestic/stock으로 연결한다", () => {
    expect(etfLink(makeEtf("069500", "KODEX 200"), "KR"))
      .toBe("https://stock.naver.com/domestic/stock/069500/price");
  });
});