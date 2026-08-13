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
