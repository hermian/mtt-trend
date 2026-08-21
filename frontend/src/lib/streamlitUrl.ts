// @MX:NOTE: Streamlit 종목 검색 URL 생성 (동일 서버 다른 포트 → 절대 URL 필요)

/**
 * Streamlit base URL 기본값.
 * 주소가 바뀌면 이 상수만 수정하면 됩니다.
 * (배포/로컬별 오버라이드: NEXT_PUBLIC_STREAMLIT_URL)
 */
export const STREAMLIT_BASE_URL = "http://hermian.duckdns.org:15888";

export function getStreamlitBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_STREAMLIT_URL?.trim() || STREAMLIT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export type StreamlitDataType = "stock" | "etf" | "us_etf";

/** Streamlit 종목 검색 링크: `{base}/?search={종목명}&type={type}` */
export function getStreamlitSearchUrl(
  stockName: string,
  type?: StreamlitDataType
): string {
  const base = getStreamlitBaseUrl();
  const params = new URLSearchParams();
  if (stockName) {
    params.set("search", stockName);
  }
  if (type) {
    params.set("type", type);
  }
  const qs = params.toString();
  return qs ? `${base}/?${qs}` : base;
}
