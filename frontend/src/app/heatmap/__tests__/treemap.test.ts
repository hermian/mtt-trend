import { describe, expect, it } from "vitest";
import { squarify, type Rect } from "../_lib/treemap";

function overlaps(a: Rect, b: Rect): boolean {
  const eps = 1e-6;
  return (
    a.x < b.x + b.w - eps &&
    a.x + a.w > b.x + eps &&
    a.y < b.y + b.h - eps &&
    a.y + a.h > b.y + eps
  );
}

describe("squarify", () => {
  const rect: Rect = { x: 0, y: 0, w: 1000, h: 600 };

  it("면적은 weight에 비례한다", () => {
    const items = [
      { id: "a", weight: 60 },
      { id: "b", weight: 30 },
      { id: "c", weight: 10 },
    ];
    const out = squarify(items, rect);
    const totalArea = rect.w * rect.h;
    for (const { item, rect: r } of out) {
      const expected = (item.weight / 100) * totalArea;
      expect(r.w * r.h).toBeCloseTo(expected, 3);
    }
  });

  it("전체 영역을 빈틈없이 채운다 (무작위 입력)", () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      weight: ((i * 37) % 97) + 1,
    }));
    const out = squarify(items, rect);
    const covered = out.reduce((s, { rect: r }) => s + r.w * r.h, 0);
    expect(covered).toBeCloseTo(rect.w * rect.h, 0);
  });

  it("박스끼리 겹치지 않고 경계 안에 있다", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      weight: ((i * 53) % 89) + 1,
    }));
    const out = squarify(items, rect);
    for (const { rect: r } of out) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.y).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(rect.w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(rect.h + 1e-6);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(overlaps(out[i].rect, out[j].rect)).toBe(false);
      }
    }
  });

  it("weight 0 이하 항목은 배치하지 않는다", () => {
    const items = [
      { id: "a", weight: 10 },
      { id: "b", weight: 0 },
      { id: "c", weight: -5 },
    ];
    const out = squarify(items, rect);
    expect(out).toHaveLength(1);
    expect(out[0].item.id).toBe("a");
  });

  it("빈 입력·0 크기 사각형은 빈 결과", () => {
    expect(squarify([], rect)).toEqual([]);
    expect(squarify([{ weight: 1 }], { x: 0, y: 0, w: 0, h: 100 })).toEqual([]);
  });

  it("균등 weight는 비교적 정사각형에 가까운 셀을 만든다", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      weight: 10,
    }));
    const out = squarify(items, { x: 0, y: 0, w: 900, h: 900 });
    for (const { rect: r } of out) {
      const ratio = Math.max(r.w / r.h, r.h / r.w);
      expect(ratio).toBeLessThan(2);
    }
  });
});
