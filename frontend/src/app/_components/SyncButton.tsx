// SyncButton 컴포넌트
// SPEC-MTT-009: REQ-MTT-009-10, REQ-MTT-009-11, REQ-MTT-009-12, REQ-MTT-009-13

"use client";

import { useState, useRef } from "react";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";

// @MX:ANCHOR: SyncButton 컴포넌트 (fan_in: Sidebar)
export function SyncButton({ collapsed = false }: { collapsed?: boolean }) {
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

  // @MX:NOTE: 축소 시 아이콘 2개, 펼쳐질 때는 1개
  const syncIcon = collapsed ? "⟳⟳" : "⟳";

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10
        ${isSyncing
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
        }
      `}
      aria-label={collapsed ? "동기화" : "데이터 동기화"}
      title={collapsed ? "동기화" : undefined}
    >
      {/* @MX:NOTE: 52주 트렌드와 동일한 크기의 SVG 아이콘 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 2v6h-3" />
        <path d="M21 10v6h-3" />
      </svg>
      {isSyncing ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 flex-shrink-0 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
          <path d="M21 3v6" />
        </svg>
      ) : null}
      {!collapsed && (
        <span className="truncate">{isSyncing ? "동기화 중..." : "동기화"}</span>
      )}
    </button>
  );
}
