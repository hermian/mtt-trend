import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ControlBar, type HeatmapControls } from "../_components/ControlBar";

const defaultControls: HeatmapControls = {
  grouping: "sector",
  period: "1D",
  startDate: null,
  endDate: null,
  marcapMin: null,
  marcapMax: null,
  minRet: null,
  minRs: null,
  mmt: null,
  limit: 0,
};

describe("ControlBar RS Filter", () => {
  it("renders RS filter preset buttons and calls onChange when clicked", () => {
    const handleChange = vi.fn();
    render(<ControlBar value={defaultControls} onChange={handleChange} />);

    expect(screen.getByText("RS 필터")).toBeDefined();
    expect(screen.getByText("70+")).toBeDefined();
    expect(screen.getByText("80+")).toBeDefined();
    expect(screen.getByText("85+")).toBeDefined();
    expect(screen.getByText("90+")).toBeDefined();
    expect(screen.getByText("95+")).toBeDefined();

    fireEvent.click(screen.getByText("95+"));
    expect(handleChange).toHaveBeenCalledWith({ minRs: 95 });
  });

  it("handles custom min RS input and applies on button click", () => {
    const handleChange = vi.fn();
    render(<ControlBar value={defaultControls} onChange={handleChange} />);

    // Find custom input for RS filter (3rd input with placeholder "최저")
    const inputs = screen.getAllByPlaceholderText("최저");
    const rsInput = inputs[inputs.length - 1]; // RS custom input is the last "최저" placeholder

    fireEvent.change(rsInput, { target: { value: "75" } });

    // Apply button for RS section is the 3rd "적용" button
    const applyButtons = screen.getAllByText("적용");
    const rsApplyBtn = applyButtons[applyButtons.length - 1];

    fireEvent.click(rsApplyBtn);
    expect(handleChange).toHaveBeenCalledWith({ minRs: 75 });
  });
});

describe("ControlBar MMT Filter", () => {
  it("renders MMT filter preset buttons -2, -1, 0, 1, 2, 3 and handles toggle behavior", () => {
    const handleChange = vi.fn();
    const { rerender } = render(<ControlBar value={defaultControls} onChange={handleChange} />);

    expect(screen.getByText("MMT 필터")).toBeDefined();
    expect(screen.getByText("-2")).toBeDefined();
    expect(screen.getByText("-1")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();

    // 1. Initial click on "1" from all (null) -> sets [1]
    fireEvent.click(screen.getByText("1"));
    expect(handleChange).toHaveBeenCalledWith({ mmt: [1] });

    // 2. Click "2" when [1] is already selected -> adds 2 -> [1, 2]
    rerender(<ControlBar value={{ ...defaultControls, mmt: [1] }} onChange={handleChange} />);
    fireEvent.click(screen.getByText("2"));
    expect(handleChange).toHaveBeenCalledWith({ mmt: [1, 2] });

    // 3. Click "3" when [1, 2] are selected -> adds 3 -> [1, 2, 3]
    rerender(<ControlBar value={{ ...defaultControls, mmt: [1, 2] }} onChange={handleChange} />);
    fireEvent.click(screen.getByText("3"));
    expect(handleChange).toHaveBeenCalledWith({ mmt: [1, 2, 3] });

    // 4. Click "1" when [1, 2, 3] are selected -> toggles off 1 -> [2, 3]
    rerender(<ControlBar value={{ ...defaultControls, mmt: [1, 2, 3] }} onChange={handleChange} />);
    fireEvent.click(screen.getByText("1"));
    expect(handleChange).toHaveBeenCalledWith({ mmt: [2, 3] });

    // 5. Click "2" when only [2] is selected -> deselects all -> null
    rerender(<ControlBar value={{ ...defaultControls, mmt: [2] }} onChange={handleChange} />);
    fireEvent.click(screen.getByText("2"));
    expect(handleChange).toHaveBeenCalledWith({ mmt: null });

    // 6. Click "전체" when [1, 2] are selected -> resets to null
    rerender(<ControlBar value={{ ...defaultControls, mmt: [1, 2] }} onChange={handleChange} />);
    const mmtContainer = screen.getByText("MMT 필터").closest("div");
    const allBtn = mmtContainer?.querySelectorAll("button")[0];
    expect(allBtn).toBeDefined();
    fireEvent.click(allBtn!);
    expect(handleChange).toHaveBeenCalledWith({ mmt: null });
  });
});

describe("ControlBar Default Actions", () => {
  it("triggers onSaveDefault when '기본값 저장' button is clicked", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <ControlBar
        value={defaultControls}
        onChange={handleChange}
        onSaveDefault={handleSave}
      />
    );

    const saveBtn = screen.getByText("기본값 저장");
    expect(saveBtn).toBeDefined();
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it("triggers onResetDefault when '초기화' button is clicked", () => {
    const handleChange = vi.fn();
    const handleReset = vi.fn();
    render(
      <ControlBar
        value={defaultControls}
        onChange={handleChange}
        onResetDefault={handleReset}
      />
    );

    const resetBtn = screen.getByText("초기화");
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});

