/**
 * Balance formatting utilities for FlowPilot UI.
 */

/**
 * Format a FLOW balance with 6 decimal places for live ticker display.
 */
export function formatBalance(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

/**
 * Format a FLOW balance for compact display (2 decimal places).
 */
export function formatBalanceCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2) + 'M';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(2) + 'K';
  }
  return amount.toFixed(2);
}

/**
 * Format a currency amount as USD string.
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a UFix64 string from chain.
 * Chain returns values like "100.00000000" — strip trailing zeros for display.
 */
export function formatUFix64(ufixStr: string): string {
  const num = parseFloat(ufixStr);
  if (isNaN(num)) return '0.000000';
  return formatBalance(num);
}

/**
 * Format a countdown timer as HH:MM:SS.
 */
export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return '00:00:00';
  const h = Math.floor(secondsRemaining / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  const s = Math.floor(secondsRemaining % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Format a timestamp as a relative time string ("2 hours ago", "in 3 days").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const isFuture = diff > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';

  if (absDiff < 60) return `${prefix}${Math.floor(absDiff)}s${suffix}`;
  if (absDiff < 3600) return `${prefix}${Math.floor(absDiff / 60)}m${suffix}`;
  if (absDiff < 86400) return `${prefix}${Math.floor(absDiff / 3600)}h${suffix}`;
  return `${prefix}${Math.floor(absDiff / 86400)}d${suffix}`;
}

/**
 * Format a Flow address for display.
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format APY as a percentage string.
 */
export function formatAPY(apy: number): string {
  return (apy * 100).toFixed(2) + '% APY';
}
