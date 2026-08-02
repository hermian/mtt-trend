import { describe, it, expect, afterEach, vi } from "vitest";
import {
  STREAMLIT_BASE_URL,
  getStreamlitBaseUrl,
  getStreamlitSearchUrl,
} from "../streamlitUrl";

describe("streamlitUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("환경 변수 없으면 STREAMLIT_BASE_URL 상수를 사용한다", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAMLIT_URL", "");
    expect(getStreamlitBaseUrl()).toBe(STREAMLIT_BASE_URL);
  });

  it("환경 변수 base URL을 사용하고 trailing slash를 제거한다", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAMLIT_URL", "http://localhost:15888/");
    expect(getStreamlitBaseUrl()).toBe("http://localhost:15888");
  });

  it("종목명 검색 URL을 encode한다", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAMLIT_URL", "");
    expect(getStreamlitSearchUrl("롯데케미칼")).toBe(
      `${STREAMLIT_BASE_URL}/?search=%EB%A1%AF%EB%8D%B0%EC%BC%80%EB%AF%B8%EC%B9%BC`
    );
  });
});
