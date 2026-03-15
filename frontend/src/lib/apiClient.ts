import axios from "axios";

// @MX:ANCHOR: API 클라이언트 설정 (fan_in: 모든 API 함수)
// @MX:REASON: 이 설정은 모든 API 호출의 기반이 되는 중앙 집중식 구성점입니다.

// API 기본 설정 상수
// BASE_URL을 빈 문자열로 설정하여 Next.js rewrite(/api/*)를 통해 백엔드로 전달
// 환경변수 직접 사용 시 모바일 등 외부 접속에서 localhost를 가리켜 실패하는 문제 방지
const API_CONFIG = {
  BASE_URL: "",
  TIMEOUT: 10000,
  DEFAULT_STALE_TIME: 5 * 60 * 1000, // 5분
} as const;

// Axios instance - 상대경로 사용으로 Next.js rewrite가 처리
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

export { API_CONFIG };
