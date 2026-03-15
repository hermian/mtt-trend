// SyncButton 컴포넌트 테스트
// SPEC-MTT-009: ACC-05 모든 시나리오

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncButton } from "../SyncButton";
import { ToastProvider } from "@/contexts/ToastContext";
import { api } from "@/lib/api";

// @MX:NOTE: ToastContext Mock 구현
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

// ToastProvider wrapper with mock toast
function MockToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}

// useToast mock
vi.mock("@/contexts/ToastContext", async () => {
  const actual = await vi.importActual("@/contexts/ToastContext");
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

// api mock
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      syncData: vi.fn(),
    },
  };
});

describe("SyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ACC-05-1 시나리오: 성공 케이스 테스트
  it("ACC-05-1: 버튼 클릭 시 비활성화 상태로 전환되고 로딩 스피너가 표시된다", async () => {
    const mockResponse = {
      status: "completed",
      total_files_scanned: 5,
      files_processed: 3,
      files_skipped: 2,
      records_created: 45,
      errors: [],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    };

    vi.mocked(api.syncData).mockResolvedValue(mockResponse);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    // 버튼이 비활성화되고 로딩 스피너가 표시됨
    expect(button).toBeDisabled();
    expect(screen.getByText("동기화 중...")).toBeInTheDocument();
  });

  // ACC-05-1 시나리오: API 호출 검증
  it("ACC-05-1: 버튼 클릭 시 POST /api/sync API가 호출된다", async () => {
    const mockResponse = {
      status: "completed",
      total_files_scanned: 5,
      files_processed: 3,
      files_skipped: 2,
      records_created: 45,
      errors: [],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    };

    vi.mocked(api.syncData).mockResolvedValue(mockResponse);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    await userEvent.click(button);

    expect(api.syncData).toHaveBeenCalledTimes(1);
  });

  // ACC-05-1 시나리오: 성공 토스트 표시
  it("ACC-05-1: API 성공 시 'N개 파일 처리 완료' 토스트가 표시된다", async () => {
    const mockResponse = {
      status: "completed",
      total_files_scanned: 5,
      files_processed: 3,
      files_skipped: 2,
      records_created: 45,
      errors: [],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    };

    vi.mocked(api.syncData).mockResolvedValue(mockResponse);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("3개 파일 처리 완료");
    });
  });

  // ACC-05-1 시나리오: 버튼 복원
  it("ACC-05-1: API 완료 후 버튼이 다시 활성 상태로 복원된다", async () => {
    const mockResponse = {
      status: "completed",
      total_files_scanned: 5,
      files_processed: 3,
      files_skipped: 2,
      records_created: 45,
      errors: [],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    };

    vi.mocked(api.syncData).mockResolvedValue(mockResponse);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(screen.getByText("동기화")).toBeInTheDocument();
    });
  });

  // ACC-05-2 시나리오: 동기화 중 비활성화
  it("ACC-05-2: 동기화 진행 중 버튼 클릭 시 추가 API 호출이 발생하지 않는다", async () => {
    let resolveSync: (value: any) => void;
    const syncPromise = new Promise((resolve) => {
      resolveSync = resolve;
    });

    vi.mocked(api.syncData).mockReturnValue(syncPromise as any);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });

    // 첫 번째 클릭
    await userEvent.click(button);
    expect(api.syncData).toHaveBeenCalledTimes(1);

    // 두 번째 클릭 (동기화 중)
    await userEvent.click(button);
    expect(api.syncData).toHaveBeenCalledTimes(1); // 여전히 1번만 호출됨

    // Promise 해제
    resolveSync!({
      status: "completed",
      total_files_scanned: 5,
      files_processed: 3,
      files_skipped: 2,
      records_created: 45,
      errors: [],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    });
  });

  // ACC-05-3 시나리오: 오류 응답 처리
  it("ACC-05-3: API 응답에 errors가 포함된 경우 경고 토스트가 표시된다", async () => {
    const mockResponse = {
      status: "completed",
      total_files_scanned: 5,
      files_processed: 2,
      files_skipped: 2,
      records_created: 30,
      errors: [
        { file: "file1.html", error: "Parse error" },
        { file: "file2.html", error: "Invalid format" },
      ],
      started_at: "2026-03-15T10:30:00Z",
      completed_at: "2026-03-15T10:30:05Z",
    };

    vi.mocked(api.syncData).mockResolvedValue(mockResponse);

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith("2개 파일 처리 완료, 2개 오류 발생");
    });
  });

  // ACC-05-4 시나리오: 네트워크 오류 처리
  it("ACC-05-4: 네트워크 오류 시 오류 토스트가 표시된다", async () => {
    vi.mocked(api.syncData).mockRejectedValue(new Error("Network error"));

    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("동기화 실패: 네트워크 오류가 발생했습니다");
    });
  });

  // 접근성 테스트
  it("버튼에 적절한 aria-label이 포함된다", () => {
    render(<SyncButton />, { wrapper: MockToastProvider });

    const button = screen.getByRole("button", { name: "데이터 동기화" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "데이터 동기화");
  });
});
