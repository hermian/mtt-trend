import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockListModal } from "../_components/StockListModal";
import { ToastProvider } from "@/contexts/ToastContext";
import type { StockHeatmapGroup } from "@/lib/api";

const mockGroups: StockHeatmapGroup[] = [
  {
    name: "반도체",
    stock_count: 2,
    weight: 100,
    avg_return: 3.5,
    rs: 88,
    stocks: [
      {
        code: "005930",
        name: "삼성전자",
        market: "KOSPI",
        marcap: 4000000,
        ret: 2.5,
        weight: 50,
        rs: 85,
      },
      {
        code: "000660",
        name: "SK하이닉스",
        market: "KOSPI",
        marcap: 1000000,
        ret: 4.5,
        weight: 50,
        rs: 92,
      },
    ],
  },
  {
    name: "IT 서비스",
    stock_count: 1,
    weight: 50,
    avg_return: 1.2,
    rs: 75,
    stocks: [
      {
        code: "035420",
        name: "NAVER",
        market: "KOSPI",
        marcap: 300000,
        ret: 1.2,
        weight: 50,
        rs: 75,
      },
    ],
  },
];

const renderModal = (props: React.ComponentProps<typeof StockListModal>) => {
  return render(
    <ToastProvider>
      <StockListModal {...props} />
    </ToastProvider>
  );
};

describe("StockListModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    groups: mockGroups,
    groupingTitle: "섹터",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    renderModal({ ...defaultProps, isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders correctly with all stock names joined by comma", () => {
    renderModal(defaultProps);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/필터링 종목 콤마 목록/i)).toBeDefined();

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("삼성전자,SK하이닉스,NAVER");
  });

  it("toggles comma space formatting when checkbox is clicked", () => {
    renderModal(defaultProps);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("삼성전자, SK하이닉스, NAVER");
  });

  it("filters stock list when specific group is selected", () => {
    renderModal(defaultProps);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "반도체" } });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("삼성전자,SK하이닉스");
  });

  it("generates correct Streamlit search URL", () => {
    renderModal(defaultProps);

    const link = screen.getByRole("link", { name: /Streamlit 차트 검색 열기/i });
    expect(link.getAttribute("href")).toContain(
      "/?search=" + encodeURIComponent("삼성전자,SK하이닉스,NAVER")
    );
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ ...defaultProps, onClose });

    const closeBtns = screen.getAllByRole("button", { name: "닫기" });
    fireEvent.click(closeBtns[0]);

    expect(onClose).toHaveBeenCalled();
  });
});
