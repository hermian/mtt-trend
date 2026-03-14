"use client";

import { useState, useRef } from "react";
import { clsx } from "clsx";

/**
 * Tooltip 컴포넌트 - SPEC-MTT-007
 *
 * 마우스 호버 또는 키보드 포커스 시 툴팁을 표시하는 접근 가능한 컴포넌트
 * WCAG 2.1 Level AA 준수
 *
 * @param content - 툴팁에 표시할 내용
 * @param id - 툴팁의 ID (aria-describedby 연결용)
 * @param children - 툴팁을 트리거할 자식 요소
 */
interface TooltipProps {
  content?: string;
  id?: string;
  children: React.ReactNode;
}

// @MX:ANCHOR: 툴팁 상태 관리 로직 (fan_in: GroupActionTable SliderControl)
// @MX:REASON: 툴팁 표시/숨김 상태를 관리하는 핵심 로직으로, 재사용 가능한 패턴입니다.
export function Tooltip({ content, id, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 툴팁 내용이 없으면 자식 요소만 렌더링
  if (!content) {
    return <>{children}</>;
  }

  // 툴팁 표시/숨김 핸들러
  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);

  return (
    <div
      ref={containerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className="relative inline-flex items-center"
    >
      {children}
      {/* @MX:NOTE: SPEC-MTT-007 F-04: 정보 아이콘 (Heroicons InformationCircleIcon solid variant) */}
      <svg
        width="16"
        height="16"
        className={clsx(
          "w-4 h-4 ml-1 text-gray-400",
          "hover:text-gray-300",
          "transition-colors duration-150"
        )}
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
        role="img"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>

      {/* @MX:NOTE: SPEC-MTT-007 F-01, F-02, F-03: 툴팁 패널 (fade-in 애니메이션) */}
      {/* 항상 DOM에 존재하며, invisible 클래스로 가시성 제어 */}
      <div
        id={id}
        role="tooltip"
        className={clsx(
          "absolute z-10 w-48 px-3 py-2",
          "text-sm text-gray-100",
          "bg-gray-800 rounded-lg shadow-lg",
          "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
          "animate-fade-in",
          "pointer-events-none",
          !isVisible && "invisible"
        )}
      >
        <div className="whitespace-normal break-words">
          {content}
        </div>
        {/* 툴팁 화살표 */}
        <div
          className={clsx(
            "absolute w-2 h-2 bg-gray-800",
            "rotate-45 transform",
            "left-1/2 -translate-x-1/2",
            "-bottom-1"
          )}
        />
      </div>
    </div>
  );
}
