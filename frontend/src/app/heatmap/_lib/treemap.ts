/**
 * Squarified treemap 레이아웃 (Bruls, Huizing, van Wijk).
 * 순수 함수 — 테스트 가능. weight > 0 항목만 배치되며 면적은 weight에 비례한다.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Positioned<T> {
  item: T;
  rect: Rect;
}

interface Entry<T> {
  item: T;
  area: number;
}

function worstRatio(row: Entry<unknown>[], side: number): number {
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const r of row) {
    sum += r.area;
    if (r.area > max) max = r.area;
    if (r.area < min) min = r.area;
  }
  if (sum <= 0 || side <= 0) return Infinity;
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

export function squarify<T extends { weight: number }>(
  items: T[],
  rect: Rect
): Positioned<T>[] {
  const out: Positioned<T>[] = [];
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out;

  const scale = (rect.w * rect.h) / total;
  const entries: Entry<T>[] = items
    .filter((i) => i.weight > 0)
    .map((item) => ({ item, area: item.weight * scale }))
    .sort((a, b) => b.area - a.area);

  let { x, y, w, h } = rect;

  const layoutRow = (row: Entry<T>[], vertical: boolean) => {
    const rowArea = row.reduce((s, r) => s + r.area, 0);
    if (vertical) {
      // 왼쪽 가장자리를 따라 세로 스트립
      const rowW = rowArea / h;
      let cy = y;
      for (const r of row) {
        const rh = r.area / rowW;
        out.push({ item: r.item, rect: { x, y: cy, w: rowW, h: rh } });
        cy += rh;
      }
      x += rowW;
      w -= rowW;
    } else {
      // 위쪽 가장자리를 따라 가로 스트립
      const rowH = rowArea / w;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rowH;
        out.push({ item: r.item, rect: { x: cx, y, w: rw, h: rowH } });
        cx += rw;
      }
      y += rowH;
      h -= rowH;
    }
  };

  let i = 0;
  while (i < entries.length && w > 0.01 && h > 0.01) {
    const vertical = h < w; // 짧은 변을 따라 배치
    const side = Math.min(w, h);
    let row: Entry<T>[] = [entries[i]];
    let worst = worstRatio(row, side);
    let j = i + 1;
    while (j < entries.length) {
      const candidate = [...row, entries[j]];
      const cw = worstRatio(candidate, side);
      if (cw <= worst) {
        row = candidate;
        worst = cw;
        j += 1;
      } else {
        break;
      }
    }
    layoutRow(row, vertical);
    i = j;
  }

  return out;
}
