/**
 * 128-bit fixed-point arithmetic utilities matching FlowDeFiMathUtils.cdc.
 * Used on the frontend for precise balance interpolation between chain refreshes.
 */

const SCALE = 100_000_000n; // 1e8 — matches UFix64 precision

/**
 * Convert a UFix64 string from chain into a JavaScript number.
 * UFix64 values come as strings like "100.00000000"
 */
export function ufixToNumber(ufixStr: string | number): number {
  if (typeof ufixStr === 'number') return ufixStr;
  return parseFloat(ufixStr);
}

/**
 * Convert a JavaScript number to UFix64-compatible BigInt with 8 decimal places.
 */
export function numberToFixed(n: number): bigint {
  return BigInt(Math.round(n * 1e8));
}

/**
 * Multiply two BigInt scaled values using 128-bit arithmetic.
 * Both a and b should be in 1e8 scale.
 * Returns result in 1e8 scale.
 */
export function mul128(a: bigint, b: bigint): bigint {
  return (a * b) / SCALE;
}

/**
 * Divide two BigInt scaled values.
 * Both a and b in 1e8 scale. Returns result in 1e8 scale.
 */
export function div128(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Division by zero');
  return (a * SCALE) / b;
}

/**
 * Add elapsed seconds to a balance using per-second rate.
 * Uses BigInt math to match chain precision.
 *
 * @param currentBalance  Current balance in number (from chain)
 * @param ratePerSecond   Accrual rate in number (from chain)
 * @param elapsedSeconds  Seconds elapsed since last sync
 * @returns New estimated balance
 */
export function accrueBalance(
  currentBalance: number,
  ratePerSecond: number,
  elapsedSeconds: number
): number {
  const balanceBig = numberToFixed(currentBalance);
  const rateBig = numberToFixed(ratePerSecond);
  const elapsedBig = numberToFixed(elapsedSeconds);

  // accrued = rate * elapsed (both in 1e8 scale → mul then descale)
  const accruedBig = mul128(rateBig, elapsedBig);
  const resultBig = balanceBig + accruedBig;

  return Number(resultBig) / 1e8;
}

/**
 * Compute yield split: returns [workerShare, protocolShare]
 */
export function splitYield(
  rawYield: number,
  splitRatio: number
): [number, number] {
  const rawBig = numberToFixed(rawYield);
  const ratioBig = numberToFixed(splitRatio);
  const workerBig = mul128(rawBig, ratioBig);
  const protocolBig = rawBig - workerBig;
  return [Number(workerBig) / 1e8, Number(protocolBig) / 1e8];
}
