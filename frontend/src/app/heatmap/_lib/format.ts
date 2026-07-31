/** 시가총액(억원) → "1,218.9조" / "768억" */
export function formatMarcap(eok: number): string {
  if (eok >= 10000) {
    const jo = eok / 10000;
    const fixed = jo >= 100 ? jo.toFixed(0) : jo.toFixed(1).replace(/\.0$/, "");
    return `${fixed}조`;
  }
  return `${Math.round(eok).toLocaleString("ko-KR")}억`;
}

/** 수익률(%) → "+12.34%" / "-5.23%" / "N/A" */
export function formatReturn(ret: number | null): string {
  if (ret === null) return "N/A";
  const sign = ret > 0 ? "+" : "";
  return `${sign}${ret.toFixed(2)}%`;
}

/** 범례 라벨: 부호 + 소수점 1자리 */
export function formatLegendValue(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}`;
}

const CJK = /[가-힣ㄱ-ㅎㅏ-ㅣ\u3000-\u303F\uFF00-\uFFEF]/;

/** 텍스트 추정 폭 (CJK=fontSize, 그 외=0.55배). */
export function textWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += CJK.test(ch) ? fontSize : fontSize * 0.55;
  return w;
}

/** 픽셀 예산(maxW) 안에 맞게 텍스트를 줄임 (… 생략). */
export function truncate(text: string, maxW: number, fontSize: number): string {
  let w = 0;
  let out = "";
  for (const ch of text) {
    const cw = CJK.test(ch) ? fontSize : fontSize * 0.55;
    if (w + cw > maxW - fontSize * 0.8) return `${out}…`;
    w += cw;
    out += ch;
  }
  return out;
}
