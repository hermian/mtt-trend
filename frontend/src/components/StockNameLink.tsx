import { getStreamlitSearchUrl, type StreamlitDataType } from "@/lib/streamlitUrl";
import React from "react";

export interface StockNameLinkProps {
  name: string;
  type?: StreamlitDataType;
  className?: string;
  children?: React.ReactNode;
  title?: string;
}

/** 종목명 → Streamlit 검색 (?search=) 하이퍼링크 */
export function StockNameLink({
  name,
  type,
  className,
  children,
  title,
}: StockNameLinkProps) {
  return (
    <a
      href={getStreamlitSearchUrl(name, type)}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? `${name} Screener 차트 열기 (새 창)`}
      className={
        className ??
        "text-inherit hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
      }
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? name}
    </a>
  );
}
