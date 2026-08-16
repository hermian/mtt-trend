import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AvwapQuickAnchorPopover from "../AvwapQuickAnchorPopover";
import AvwapAnchorManagerModal, { UnifiedAnchorItem } from "../AvwapAnchorManagerModal";

describe("AvwapQuickAnchorPopover Component", () => {
  it("submits date, label, and color correctly", () => {
    const onAddAnchorMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <AvwapQuickAnchorPopover
        isOpen={true}
        onClose={onCloseMock}
        onAddAnchor={onAddAnchorMock}
        defaultDate="2025-04-07"
      />
    );

    expect(screen.getByText("변곡점 앵커 추가")).toBeInTheDocument();

    const labelInput = screen.getByPlaceholderText(/25년 4월 저점/);
    fireEvent.change(labelInput, { target: { value: "관세 발표 바닥" } });

    const submitBtn = screen.getByText("+ 앵커 생성");
    fireEvent.click(submitBtn);

    expect(onAddAnchorMock).toHaveBeenCalledWith("2025-04-07", "관세 발표 바닥", expect.any(String));
    expect(onCloseMock).toHaveBeenCalled();
  });
});

describe("AvwapAnchorManagerModal Component", () => {
  const mockAnchors: UnifiedAnchorItem[] = [
    {
      id: "anchor_20200323",
      name: "코로나 저점 (2020-03-23)",
      anchor_date: "2020-03-23",
      color: "#ec4899",
      isCustom: false,
      isEnabled: true,
    },
    {
      id: "anc_custom_1",
      name: "25년 4월 저점 (2025-04-07)",
      anchor_date: "2025-04-07",
      color: "#10b981",
      isCustom: true,
      isEnabled: true,
    },
  ];

  it("renders anchors list and supports toggle, delete, and add", () => {
    const onToggleAnchor = vi.fn();
    const onUpdateCustomAnchor = vi.fn();
    const onDeleteAnchor = vi.fn();
    const onAddCustomAnchor = vi.fn();
    const onResetToDefaults = vi.fn();
    const onClose = vi.fn();

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <AvwapAnchorManagerModal
        isOpen={true}
        onClose={onClose}
        targetName="S&P 500"
        anchors={mockAnchors}
        onToggleAnchor={onToggleAnchor}
        onUpdateCustomAnchor={onUpdateCustomAnchor}
        onDeleteAnchor={onDeleteAnchor}
        onAddCustomAnchor={onAddCustomAnchor}
        onResetToDefaults={onResetToDefaults}
      />
    );

    expect(screen.getByText("변곡점 앵커 관리")).toBeInTheDocument();
    expect(screen.getByText("S&P 500")).toBeInTheDocument();
    expect(screen.getByText("코로나 저점 (2020-03-23)")).toBeInTheDocument();
    expect(screen.getByText("25년 4월 저점 (2025-04-07)")).toBeInTheDocument();

    // Toggle anchor
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onToggleAnchor).toHaveBeenCalledWith("anchor_20200323");

    // Delete buttons should be present for both system and custom anchors
    const deleteBtns = screen.getAllByTitle("삭제");
    expect(deleteBtns.length).toBe(2);

    // Delete system anchor
    fireEvent.click(deleteBtns[0]);
    expect(onDeleteAnchor).toHaveBeenCalledWith("anchor_20200323", "2020-03-23", false);

    // Delete custom anchor
    fireEvent.click(deleteBtns[1]);
    expect(onDeleteAnchor).toHaveBeenCalledWith("anc_custom_1", "2025-04-07", true);

    // Add new custom anchor
    const dateInput = screen.getByLabelText(/기준 날짜/i);
    fireEvent.change(dateInput, { target: { value: "2025-05-01" } });

    const registerBtn = screen.getByText("+ 등록");
    fireEvent.click(registerBtn);
    expect(onAddCustomAnchor).toHaveBeenCalledWith("2025-05-01", "", expect.any(String));

    // Reset button
    const resetBtn = screen.getByText("🔄 기본값으로 복원");
    fireEvent.click(resetBtn);
    expect(onResetToDefaults).toHaveBeenCalled();
  });
});

