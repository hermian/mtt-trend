// 사용자 가이드 페이지 - Server Component
// UserGuide.md 파일을 읽어 react-markdown으로 렌더링

import fs from "fs";
import path from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { TableOfContents } from "./TableOfContents";

// process.cwd()는 frontend/ 디렉토리를 가리키므로 상위 폴더로 이동
const GUIDE_FILE_PATH = path.resolve(process.cwd(), "..", "UserGuide.md");

function readGuideContent(): { content: string | null; error: string | null } {
  try {
    const content = fs.readFileSync(GUIDE_FILE_PATH, "utf-8");
    return { content, error: null };
  } catch {
    return {
      content: null,
      error: `사용자 가이드 파일을 찾을 수 없습니다. (${GUIDE_FILE_PATH})`,
    };
  }
}

export default function GuidePage() {
  const { content, error } = readGuideContent();

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-8">사용자 가이드</h1>

        {error ? (
          <div className="rounded-lg bg-red-900/30 border border-red-700 p-6">
            <p className="text-red-400">{error}</p>
            <p className="text-gray-400 mt-2 text-sm">
              프로젝트 루트에 UserGuide.md 파일이 있는지 확인하세요.
            </p>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* 목차 사이드바 (lg 이상에서 표시) */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <TableOfContents content={content!} />
            </aside>

            {/* 본문 */}
            <main className="flex-1 min-w-0">
              <div className="overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug]}
                  className="prose prose-invert max-w-none"
                  components={{
                    // 테이블을 overflow-x-auto로 감싸서 모바일 스크롤 지원
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto my-6">
                        <table {...props} className="min-w-full">
                          {children}
                        </table>
                      </div>
                    ),
                  }}
                >
                  {content!}
                </ReactMarkdown>
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
