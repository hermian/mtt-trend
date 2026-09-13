import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately and the updated value after the delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 180), {
      initialProps: { v: "a" },
    });
    expect(result.current).toBe("a");

    rerender({ v: "b" });
    // 지연 전에는 아직 이전 값
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(result.current).toBe("b");
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defers the call until the delay has elapsed", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(spy, 200));

    act(() => {
      result.current.run("kospi", "005930");
    });
    // 즉시 호출되지 않는다
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("kospi", "005930");
  });

  it("collapses a burst of hovers into a single call for the last target", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(spy, 200));

    // 마우스가 30행을 빠르게 훑는 상황을 흉내낸다
    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.run("kospi", `code-${i}`);
        vi.advanceTimersByTime(10);
      }
    });
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 30건이 아니라 마지막 1건만 나간다
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("kospi", "code-29");
  });

  it("cancels the pending call (mouse left before the delay)", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(spy, 200));

    act(() => {
      result.current.run("kospi", "005930");
      result.current.cancel();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("drops the pending timer on unmount", () => {
    const spy = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(spy, 200));

    act(() => {
      result.current.run("kospi", "005930");
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("invokes the latest callback rather than a stale closure", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useDebouncedCallback(cb, 200),
      { initialProps: { cb: first } }
    );

    act(() => {
      result.current.run("kospi", "005930");
    });
    // 타이머가 도는 사이에 콜백이 교체된다 (예: interval 변경)
    rerender({ cb: second });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("kospi", "005930");
  });
});
