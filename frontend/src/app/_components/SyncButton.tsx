// SyncButton 컴포넌트
// SPEC-MTT-009: REQ-MTT-009-10, REQ-MTT-009-11, REQ-MTT-009-12, REQ-MTT-009-13

"use client";

import { useState, useRef } from "react";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";

// @MX:ANCHOR: SyncButton 컴포넌트 (fan_in: Sidebar)
export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();
  // @MX:FIX: 컴포넌트 unmount 후 상태 업데이트 방지
  const isMountedRef = useRef(true);

  // 동기화 핸들러 구현
  const handleSync = async () => {
    if (isSyncing) return; // 이미 동기화 중이면 무시

    try {
      setIsSyncing(true);

      // API 호출
      const response = await api.syncData();

      // @MX:FIX: unmount 체크
      if (!isMountedRef.current) return;

      // 응답 처리
      if (response.errors.length > 0) {
        // 오류가 있는 경우 경고 토스트
        toast.warning(
          `${response.files_processed}개 파일 처리 완료, ${response.errors.length}개 오류 발생`
        );
      } else {
        // 성공한 경우 성공 토스트
        toast.success(`${response.files_processed}개 파일 처리 완료`);
      }
    } catch (error) {
      // 네트워크 오류 처리
      console.error("Sync error:", error);
      // @MX:FIX: unmount 체크
      if (isMountedRef.current) {
        toast.error("동기화 실패: 네트워크 오류가 발생했습니다");
      }
    } finally {
      // @MX:FIX: unmount 체크
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${isSyncing
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
        }
      `}
      aria-label="데이터 동기화"
    >
      {isSyncing ? (
        <>
          <span className="animate-spin">⟳</span>
          <span>동기화 중...</span>
        </>
      ) : (
        <>
          <span>↻</span>
          <span>동기화</span>
        </>
      )}
    </button>
  );
}
