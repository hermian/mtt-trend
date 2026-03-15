import axios from "axios";

// @MX:ANCHOR: API 클라이언트 설정 (fan_in: 모든 API 함수)
// @MX:REASON: 이 설정은 모든 API 호출의 기반이 되는 중앙 집중식 구성점입니다.

// API 기본 설정 상수
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  TIMEOUT: 10000,
  DEFAULT_STALE_TIME: 5 * 60 * 1000, // 5분
} as const;

// Axios instance with base URL from env
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

export { API_CONFIG };
