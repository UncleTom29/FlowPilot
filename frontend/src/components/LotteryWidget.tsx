import React, { useState, useEffect } from 'react';
import { formatBalance, formatCountdown, formatAddress } from '../utils/formatBalance';

interface LotteryWidgetProps {
  userAddress: string;
}

interface PoolState {
  totalPrincipal: number;
  yieldAccumulated: number;
  totalTickets: number;
  participantCount: number;
  drawCount: number;
  userTickets: number;
  nextDrawIn: number;  // seconds
}

interface DrawHistory {
  winner: string;
  prize: number;
  timestamp: number;
}

const MOCK_HISTORY: DrawHistory[] = [
  { winner: '0xabcd1234', prize: 12.45, timestamp: Date.now() / 1000 - 86400 },
  { winner: '0xef567890', prize: 8.32, timestamp: Date.now() / 1000 - 172800 },
  { winner: '0x11223344', prize: 15.10, timestamp: Date.now() / 1000 - 259200 },
  { winner: '0x55667788', prize: 6.77, timestamp: Date.now() / 1000 - 345600 },
  { winner: '0x99aabbcc', prize: 9.91, timestamp: Date.now() / 1000 - 432000 },
];

const LotteryWidget: React.FC<LotteryWidgetProps> = ({ userAddress }) => {
  const [poolState, setPoolState] = useState<PoolState>({
    totalPrincipal: 15420.0,
    yieldAccumulated: 24.37,
    totalTickets: 15420.0,
    participantCount: 47,
    drawCount: 23,
    userTickets: 100.0,
    nextDrawIn: 43200,  // 12 hours
  });
  const [entryAmount, setEntryAmount] = useState('100');
  const [entering, setEntering] = useState(false);
  const [countdown, setCountdown] = useState(poolState.nextDrawIn);

  // Live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 86400));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const userTicketPct =
    poolState.totalTickets > 0
      ? ((poolState.userTickets / poolState.totalTickets) * 100).toFixed(2)
      : '0.00';

  const handleEnterLottery = async () => {
    const amount = parseFloat(entryAmount);
    if (isNaN(amount) || amount <= 0 || entering) return;
    setEntering(true);
    try {
      // In production: call LotteryPool.deposit via FCL
      // const txId = await fcl.mutate({ cadence: DEPOSIT_CADENCE, ... })
      // For now, optimistically update
      setPoolState((prev) => ({
        ...prev,
        totalPrincipal: prev.totalPrincipal + amount,
        totalTickets: prev.totalTickets + amount,
        userTickets: prev.userTickets + amount,
      }));
      setEntryAmount('100');
    } catch (err) {
      console.error('Lottery entry failed:', err);
    } finally {
      setEntering(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎰 Lossless Daily Lottery</h2>
      <p style={styles.subtitle}>
        Your principal is always safe — only accumulated yield is distributed as prizes.
      </p>

      {/* Pool stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Prize Pool (Yield)</span>
          <span style={{ ...styles.statValue, color: '#f7b731' }}>
            {formatBalance(poolState.yieldAccumulated)} FLOW
          </span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Principal Locked</span>
          <span style={styles.statValue}>
            {poolState.totalPrincipal.toFixed(2)} FLOW
          </span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Participants</span>
          <span style={styles.statValue}>{poolState.participantCount}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Next Draw</span>
          <span style={{ ...styles.statValue, color: '#00ef8b', fontFamily: 'monospace' }}>
            {formatCountdown(countdown)}
          </span>
        </div>
      </div>

      {/* User position */}
      <div style={styles.positionCard}>
        <div style={styles.positionRow}>
          <span style={styles.positionLabel}>Your Tickets</span>
          <span style={styles.positionValue}>{poolState.userTickets.toFixed(2)} FLOW</span>
        </div>
        <div style={styles.positionRow}>
          <span style={styles.positionLabel}>Win Probability</span>
          <span style={{ ...styles.positionValue, color: '#00ef8b' }}>
            {userTicketPct}%
          </span>
        </div>
        {/* Ticket weight bar */}
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.min(parseFloat(userTicketPct), 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Enter lottery */}
      <div style={styles.enterCard}>
        <h3 style={styles.enterTitle}>Enter Lottery</h3>
        <p style={styles.enterDesc}>
          Deposit FLOW to earn tickets. Your principal is always withdrawable.
        </p>
        <div style={styles.inputRow}>
          <input
            style={styles.amountInput}
            type="number"
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
            min="1"
            step="1"
            placeholder="Amount in FLOW"
          />
          <button
            style={{ ...styles.enterButton, opacity: entering ? 0.5 : 1 }}
            onClick={handleEnterLottery}
            disabled={entering}
          >
            {entering ? 'Entering...' : '🎟 Enter Lottery'}
          </button>
        </div>
      </div>

      {/* Draw history */}
      <div style={styles.historySection}>
        <h3 style={styles.historyTitle}>Recent Winners</h3>
        <div style={styles.historyList}>
          {MOCK_HISTORY.map((draw, i) => (
            <div key={i} style={styles.historyItem}>
              <span style={styles.historyWinner}>{formatAddress(draw.winner)}</span>
              <span style={{ ...styles.historyPrize, color: '#f7b731' }}>
                +{draw.prize.toFixed(4)} FLOW
              </span>
              <span style={styles.historyTime}>
                {Math.floor((Date.now() / 1000 - draw.timestamp) / 86400)}d ago
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#fff',
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  },
  positionCard: {
    background: 'rgba(0,239,139,0.05)',
    border: '1px solid rgba(0,239,139,0.15)',
    borderRadius: 16,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  positionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  positionValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  progressBar: {
    height: 6,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    background: '#00ef8b',
    borderRadius: 3,
    transition: 'width 0.5s ease',
  },
  enterCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  enterTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
  },
  enterDesc: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
  },
  inputRow: {
    display: 'flex',
    gap: 12,
  },
  amountInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
  },
  enterButton: {
    background: '#f7b731',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    color: '#000',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'opacity 0.2s',
  },
  historySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  historyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  historyWinner: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'monospace',
  },
  historyPrize: {
    fontSize: 14,
    fontWeight: 600,
  },
  historyTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
};

export default LotteryWidget;
