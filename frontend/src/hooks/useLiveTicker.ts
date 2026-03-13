import { useState, useEffect, useRef, useCallback } from 'react';
import { accrueBalance } from '../utils/fixedPoint';

interface LiveTickerState {
  displayBalance: number;
  lastSyncBalance: number;
  lastSyncTime: number;
  ratePerSecond: number;
}

/**
 * Provides a live-updating balance that interpolates between chain refreshes.
 * - Updates every 500ms using local interpolation
 * - Re-syncs from chain every 10 seconds
 * - Uses 128-bit fixed-point math matching chain precision
 */
export function useLiveTicker(
  chainBalance: number,
  ratePerSecond: number,
  isLoading: boolean
) {
  const [state, setState] = useState<LiveTickerState>({
    displayBalance: chainBalance,
    lastSyncBalance: chainBalance,
    lastSyncTime: Date.now() / 1000,
    ratePerSecond,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // When chain balance updates, sync the anchor point
  useEffect(() => {
    if (!isLoading && chainBalance > 0) {
      setState({
        displayBalance: chainBalance,
        lastSyncBalance: chainBalance,
        lastSyncTime: Date.now() / 1000,
        ratePerSecond,
      });
    }
  }, [chainBalance, ratePerSecond, isLoading]);

  // Tick every 500ms — add rate * 0.5 to display balance
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.ratePerSecond <= 0) return prev;
        // Interpolate from anchor point to prevent drift accumulation
        const now = Date.now() / 1000;
        const elapsed = now - prev.lastSyncTime;
        const newBalance = accrueBalance(prev.lastSyncBalance, prev.ratePerSecond, elapsed);
        return { ...prev, displayBalance: newBalance };
      });
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    displayBalance: state.displayBalance,
    ratePerSecond: state.ratePerSecond,
  };
}
