"use client";

// TableOfContents: 마크다운 콘텐츠에서 ## 및 ### 헤딩을 파싱하여 목차를 생성하는 클라이언트 컴포넌트

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  content: string;
}

// 한국어를 포함한 헤딩 텍스트를 앵커 ID로 변환
function headingToId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 마크다운 콘텐츠에서 ## 및 ### 헤딩을 파싱
function parseHeadings(content: string): Heading[] {
  const lines = content.split("\n");
  const headings: Heading[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({
        level,
        text,
        id: headingToId(text),
      });
    }
  }

  return headings;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const headings = parseHeadings(content);

  if (headings.length === 0) {
    return null;
  }

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      aria-label="목차"
      className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-gray-800 border border-gray-700 p-4"
    >
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
        목차
      </h2>
      <ul className="space-y-1">
        {headings.map((heading, index) => (
          <li
            key={index}
            className={heading.level === 3 ? "ml-4" : ""}
          >
            <button
              onClick={() => handleClick(heading.id)}
              className={`text-left w-full text-sm hover:text-white transition-colors ${
                heading.level === 2
                  ? "text-gray-300 font-medium"
                  : "text-gray-400"
              }`}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
