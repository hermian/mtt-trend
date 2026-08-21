import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { StockNameLink } from "../StockNameLink";

describe("StockNameLink", () => {
  it("renders link with stock name and default target=_blank and rel", () => {
    render(<StockNameLink name="한온시스템" />);
    const link = screen.getByRole("link", { name: "한온시스템" });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("href")).toContain("search=%ED%95%9C%EC%98%A8%EC%8B%9C%EC%8A%A4%ED%85%9C");
  });

  it("includes type in href when type is passed", () => {
    render(<StockNameLink name="한온시스템" type="stock" />);
    const link = screen.getByRole("link", { name: "한온시스템" });
    expect(link.getAttribute("href")).toContain("type=stock");
  });

  it("renders custom children when provided", () => {
    render(
      <StockNameLink name="한온시스템" type="stock">
        <span>한온시스템 (018880)</span>
        <span>↗</span>
      </StockNameLink>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("한온시스템 (018880)↗");
  });

  it("stops propagation on click", () => {
    const parentClickHandler = vi.fn();
    render(
      <div onClick={parentClickHandler}>
        <StockNameLink name="한온시스템" />
      </div>
    );
    const link = screen.getByRole("link", { name: "한온시스템" });
    fireEvent.click(link);
    expect(parentClickHandler).not.toHaveBeenCalled();
  });
});
