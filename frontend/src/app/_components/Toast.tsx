// Toast UI 컴포넌트
// SPEC-MTT-009: REQ-MTT-009-12

"use client";

import { useEffect, useCallback } from "react";
import type { Toast } from "@/contexts/ToastContext";

// @MX:NOTE: Toast 스타일 매핑
const toastStyles = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-yellow-600 text-white",
  info: "bg-blue-600 text-white",
};

interface ToastProps {
  toast: Toast;
  onClose: () => void;
}

// @MX:ANCHOR: Toast 컴포넌트 (fan_in: ToastProvider)
export function Toast({ toast, onClose }: ToastProps) {
  // 자동 닫기 타이머 구현
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 ${toastStyles[toast.type]}`}
      role="alert"
      aria-live="polite"
    >
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white rounded"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

// ToastContainer 컴포넌트 구현 (여러 토스트 표시)
interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

// @MX:FIX: useCallback으로 콜백 메모이제이션
export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  // @MX:FIX: useMemo가 아닌 useCallback 사용 (콜백 함수)
  const handleClose = useCallback((id: string) => {
    onClose(id);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => handleClose(toast.id)} />
      ))}
    </div>
  );
}
