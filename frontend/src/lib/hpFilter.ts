/**
 * Hodrick-Prescott (호드릭-프레스콧) 필터
 *
 * y_t = τ_t + c_t 로 분해. τ는 장기 추세, c는 순환(단기 변동).
 * FinJump DSTOA005001은 주간 시계열 + λ=1600.
 * 일봉에서는 Ravn–Uhlig 규칙(주간 대비 ~5배 빈도)으로 λ ≈ 1600×5⁴ = 1_000_000 을 기본값으로 사용.
 */

/** 일봉 기본 평활화 계수 (FinJump 주간 λ=1600에 대응) */
export const HP_LAMBDA_DAILY = 1_000_000;

/** FinJump 주간 관행값 */
export const HP_LAMBDA_WEEKLY = 1_600;

/** 월봉 평활화 계수 (Ravn-Uhlig 월간 표준) */
export const HP_LAMBDA_MONTHLY = 14_400;

/** 연봉 평활화 계수 (Hodrick-Prescott 연간 표준) */
export const HP_LAMBDA_YEARLY = 100;

/**
 * 차트 주기(interval)에 적합한 HP 평활화 계수(lambda) 반환
 */
export function getHpLambdaForInterval(interval?: string): number {
  switch (interval) {
    case "1W":
      return HP_LAMBDA_WEEKLY;
    case "1M":
      return HP_LAMBDA_MONTHLY;
    case "1Y":
      return HP_LAMBDA_YEARLY;
    case "1D":
    default:
      return HP_LAMBDA_DAILY;
  }
}

export interface HpResult {
  trend: number[];
  cycle: number[];
}

/**
 * (I + λ D'D) τ = y 를 대역폭 2 밴드 Cholesky로 풀어 추세를 구한다.
 */
export function hpFilter(y: number[], lambda: number = HP_LAMBDA_DAILY): HpResult {
  const n = y.length;
  if (n === 0) return { trend: [], cycle: [] };
  if (n < 4 || lambda < 0 || !Number.isFinite(lambda)) {
    return { trend: [...y], cycle: y.map(() => 0) };
  }

  const trend = solveHpTrend(y, lambda);
  const cycle = y.map((v, i) => v - trend[i]);
  return { trend, cycle };
}

/**
 * FinJump DSTOA006001 스타일 이탈도: (지수 / 추세) × 100
 * 100 = 추세와 일치, >100 상회, <100 하회
 */
export function hpDeviationPercent(y: number[], trend: number[]): number[] {
  const n = Math.min(y.length, trend.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = trend[i];
    out.push(t === 0 || !Number.isFinite(t) ? 100 : (y[i] / t) * 100);
  }
  return out;
}

/** TimePoint 시계열에 HP를 적용해 추세·이탈 TimePoint를 반환 */
export function hpFilterSeries(
  data: { time: string; value: number }[],
  lambda: number = HP_LAMBDA_DAILY,
): {
  trend: { time: string; value: number }[];
  deviation: { time: string; value: number }[];
} {
  if (data.length < 4) {
    return {
      trend: data.map((d) => ({ ...d })),
      deviation: data.map((d) => ({ time: d.time, value: 100 })),
    };
  }
  const y = data.map((d) => d.value);
  const { trend } = hpFilter(y, lambda);
  const deviation = hpDeviationPercent(y, trend);
  return {
    trend: data.map((d, i) => ({ time: d.time, value: trend[i] })),
    deviation: data.map((d, i) => ({ time: d.time, value: deviation[i] })),
  };
}

function solveHpTrend(y: number[], lambda: number): number[] {
  const n = y.length;
  // A = I + λ D'D 의 하삼각 대각 (대칭이므로 하삼각만 저장)
  // a0[i]=A[i,i], a1[i]=A[i,i-1], a2[i]=A[i,i-2]
  const a0 = new Array<number>(n).fill(1);
  const a1 = new Array<number>(n).fill(0);
  const a2 = new Array<number>(n).fill(0);

  for (let i = 0; i < n - 2; i++) {
    const pos = [i, i + 1, i + 2] as const;
    const coef = [1, -2, 1] as const;
    for (let p = 0; p < 3; p++) {
      for (let q = 0; q < 3; q++) {
        const val = lambda * coef[p] * coef[q];
        const row = pos[p];
        const col = pos[q];
        const off = col - row;
        if (off === 0) a0[row] += val;
        else if (off === -1) a1[row] += val;
        else if (off === -2) a2[row] += val;
        // 상삼각은 대칭으로 하삼각에만 누적하면 됨 (off>0는 건너뜀)
      }
    }
  }

  // 밴드 Cholesky: A = L Lᵀ, L은 대각·sub1·sub2만 가짐
  const L0 = new Array<number>(n).fill(0);
  const L1 = new Array<number>(n).fill(0);
  const L2 = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    let s2 = a2[i];
    if (i >= 2) {
      L2[i] = s2 / L0[i - 2];
    }

    let s1 = a1[i];
    if (i >= 1) {
      if (i >= 2) s1 -= L2[i] * L1[i - 1];
      L1[i] = s1 / L0[i - 1];
    }

    let s0 = a0[i];
    if (i >= 1) s0 -= L1[i] * L1[i];
    if (i >= 2) s0 -= L2[i] * L2[i];
    if (s0 <= 0) s0 = 1e-12;
    L0[i] = Math.sqrt(s0);
  }

  // L z = y
  const z = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = y[i];
    if (i >= 1) s -= L1[i] * z[i - 1];
    if (i >= 2) s -= L2[i] * z[i - 2];
    z[i] = s / L0[i];
  }

  // Lᵀ x = z
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    if (i + 1 < n) s -= L1[i + 1] * x[i + 1];
    if (i + 2 < n) s -= L2[i + 2] * x[i + 2];
    x[i] = s / L0[i];
  }
  return x;
}
