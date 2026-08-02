import { getStreamlitSearchUrl } from "@/lib/streamlitUrl";

interface StockNameLinkProps {
  name: string;
  className?: string;
}

/** 종목명 → Streamlit 검색 (?search=) 하이퍼링크 */
export function StockNameLink({ name, className }: StockNameLinkProps) {
  return (
    <a
      href={getStreamlitSearchUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "text-inherit hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
      }
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </a>
  );
}
