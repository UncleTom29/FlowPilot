import React from 'react';
import { RuleDefinition } from '../hooks/useRules';
import { formatRelativeTime } from '../utils/formatBalance';

interface RuleCardProps {
  rule: RuleDefinition;
  status: 'active' | 'pending' | 'disputed';
  onPause?: (ruleId: string) => void;
  onDelete?: (ruleId: string) => void;
  nextExecutionTime?: number;
  lastExecutionResult?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  savings_split: { label: 'Auto-Save', color: '#00ef8b', emoji: '💰' },
  dca: { label: 'DCA Invest', color: '#5b8dee', emoji: '📈' },
  subscription: { label: 'Subscription', color: '#f7b731', emoji: '🔄' },
  roundup: { label: 'Round-Up', color: '#fd9644', emoji: '🪙' },
  portfolio: { label: 'AI Portfolio', color: '#a55eea', emoji: '🤖' },
  giftcard: { label: 'Gift Card', color: '#ff6b6b', emoji: '🎁' },
  lottery_entry: { label: 'Lottery', color: '#26de81', emoji: '🎰' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: '#00ef8b', dot: '🟢' },
  pending: { label: 'Pending', color: '#f7b731', dot: '🟡' },
  disputed: { label: 'Disputed', color: '#ff6b6b', dot: '🔴' },
};

const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  status,
  onPause,
  onDelete,
  nextExecutionTime,
  lastExecutionResult,
}) => {
  const typeConfig = TYPE_CONFIG[rule.type] ?? { label: rule.type, color: '#888', emoji: '⚙️' };
  const statusConfig = STATUS_CONFIG[status];

  const buildRuleDescription = (): string => {
    if (rule.rawText) return rule.rawText;
    const p = rule.params;
    switch (rule.type) {
      case 'savings_split':
        return `Save ${((p.ratio as number) * 100).toFixed(0)}% of every paycheck`;
      case 'dca':
        return `Buy $${p.amount} ${p.asset} ${p.intervalText || 'weekly'}`;
      case 'subscription':
        return `Pay $${p.amount} to ${p.payee} monthly`;
      case 'roundup':
        return `Round up withdrawals to nearest $${p.bucketSize}`;
      case 'portfolio':
        return `AI Portfolio • ${p.riskProfile} risk`;
      case 'giftcard':
        return `Gift card $${p.amount} → ${p.recipient}`;
      case 'lottery_entry':
        return `Daily lottery entry $${p.amount}`;
      default:
        return rule.id;
    }
  };

  return (
    <div style={styles.card}>
      {/* Type badge + status */}
      <div style={styles.header}>
        <span style={{ ...styles.typeBadge, background: typeConfig.color + '22', color: typeConfig.color }}>
          {typeConfig.emoji} {typeConfig.label}
        </span>
        <span style={{ ...styles.statusBadge, color: statusConfig.color }}>
          {statusConfig.dot} {statusConfig.label}
        </span>
      </div>

      {/* Rule description */}
      <p style={styles.description}>{buildRuleDescription()}</p>

      {/* Metadata */}
      <div style={styles.meta}>
        {nextExecutionTime && (
          <span style={styles.metaItem}>
            ⏱ Next: {formatRelativeTime(nextExecutionTime)}
          </span>
        )}
        {lastExecutionResult && (
          <span style={styles.metaItem}>
            ✓ {lastExecutionResult}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {onPause && (
          <button
            style={styles.actionButton}
            onClick={() => onPause(rule.id)}
            disabled={status === 'disputed'}
          >
            ⏸ Pause
          </button>
        )}
        {onDelete && (
          <button
            style={{ ...styles.actionButton, ...styles.deleteButton }}
            onClick={() => onDelete(rule.id)}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    transition: 'border-color 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 6,
    padding: '4px 10px',
    letterSpacing: 0.3,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 600,
  },
  description: {
    margin: 0,
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  meta: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  actionButton: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '6px 14px',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'all 0.2s',
  },
  deleteButton: {
    color: '#ff6b6b',
    borderColor: 'rgba(255,107,107,0.3)',
    background: 'rgba(255,107,107,0.06)',
  },
};

export default RuleCard;
