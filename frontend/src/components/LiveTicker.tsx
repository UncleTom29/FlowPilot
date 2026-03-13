import React from 'react';
import { useLiveTicker } from '../hooks/useLiveTicker';
import { formatBalance } from '../utils/formatBalance';

interface LiveTickerProps {
  balance: number;
  ratePerSecond: number;
  isLoading?: boolean;
  label?: string;
  color?: string;
}

const LiveTicker: React.FC<LiveTickerProps> = ({
  balance,
  ratePerSecond,
  isLoading = false,
  label = 'Live Balance',
  color = '#00ef8b',
}) => {
  const { displayBalance } = useLiveTicker(balance, ratePerSecond, isLoading);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <span style={styles.label}>{label}</span>
        <span style={{ ...styles.amount, color: 'rgba(255,255,255,0.3)' }}>
          Loading...
        </span>
      </div>
    );
  }

  // Format with 6 decimal places and animate with CSS
  const formatted = formatBalance(displayBalance);
  const [intPart, decPart] = formatted.split('.');

  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <div style={styles.amountRow}>
        <span style={{ ...styles.amount, color }}>
          {intPart}
          <span style={styles.decimal}>.{decPart}</span>
        </span>
        <span style={styles.ticker}>FLOW</span>
      </div>
      {ratePerSecond > 0 && (
        <span style={styles.rate}>
          +{(ratePerSecond * 3600).toFixed(6)} / hr
        </span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -1,
    transition: 'color 0.3s',
  },
  decimal: {
    fontSize: 24,
    fontWeight: 500,
    opacity: 0.8,
  },
  ticker: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
    marginLeft: 4,
  },
  rate: {
    fontSize: 13,
    color: '#00ef8b',
    fontFamily: 'monospace',
  },
};

export default LiveTicker;
