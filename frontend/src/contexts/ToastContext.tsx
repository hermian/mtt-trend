// Toast Context 및 Hook 구현
// SPEC-MTT-009: REQ-MTT-009-12

"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { ToastContainer } from "@/app/_components/Toast";

// @MX:NOTE: Toast 타입 정의
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// @MX:ANCHOR: ToastProvider 컴포넌트 (fan_in: layout.tsx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // @MX:FIX: 타이머 cleanup을 위한 ref 추가
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // @MX:FIX: 컴포넌트 unmount 시 타이머 정리
  const clearAllTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, []);

  // 토스트 추가 로직 구현
  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    // @MX:FIX: crypto.randomUUID()로 고유 ID 생성
    const id = crypto.randomUUID();
    const newToast: Toast = { id, type, message, duration };
    setToasts((prev) => [...prev, newToast]);

    // @MX:FIX: duration이 0인 경우 타이머 설정 스킵
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        // @MX:FIX: 타이머 ref에서 제거
        delete timersRef.current[id];
      }, duration);
      timersRef.current[id] = timer;
    }
  }, []);

  // 토스트 제거 로직
  const removeToast = useCallback((id: string) => {
    // @MX:FIX: 해당 타이머 정리
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // @MX:FIX: useMemo로 value 객체 재생성 방지
  const value: ToastContextValue = useMemo(() => ({
    toast: {
      success: (message, duration) => addToast("success", message, duration),
      error: (message, duration) => addToast("error", message, duration),
      warning: (message, duration) => addToast("warning", message, duration),
      info: (message, duration) => addToast("info", message, duration),
    },
  }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

// @MX:ANCHOR: useToast Hook (fan_in: SyncButton, future components)
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context.toast;
}
