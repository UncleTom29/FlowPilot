import React, { useState } from 'react';
import { formatAddress, formatAPY, formatBalance } from '../utils/formatBalance';

interface WorkCredentialCardProps {
  userAddress: string;
  streamId: string;
}

interface CredentialData {
  streamId: string;
  employer: string;
  workerAddress: string;
  role: string;
  startTimestamp: number;
  endTimestamp: number | null;
  totalEarned: number;
  totalYieldEarned: number;
  milestonesCompleted: number;
  disputesRaised: number;
  creditScore: number;
  averageAPY: number;
}

// Mock credential for display
const MOCK_CREDENTIAL: CredentialData = {
  streamId: 'stream_001',
  employer: '0xemployer1234',
  workerAddress: '0xworker5678',
  role: 'Senior Protocol Engineer',
  startTimestamp: Date.now() / 1000 - 86400 * 90,
  endTimestamp: null,
  totalEarned: 18420.0,
  totalYieldEarned: 724.88,
  milestonesCompleted: 9,
  disputesRaised: 0,
  creditScore: 941.48,
  averageAPY: 0.0512,
};

const WorkCredentialCard: React.FC<WorkCredentialCardProps> = ({ userAddress, streamId }) => {
  const [credential] = useState<CredentialData>(MOCK_CREDENTIAL);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const durationDays = credential.endTimestamp
    ? Math.floor((credential.endTimestamp - credential.startTimestamp) / 86400)
    : Math.floor((Date.now() / 1000 - credential.startTimestamp) / 86400);

  const progressPercent = Math.min((credential.milestonesCompleted / 12) * 100, 100);

  const creditScoreColor =
    credential.creditScore >= 800
      ? '#00ef8b'
      : credential.creditScore >= 600
      ? '#f7b731'
      : '#ff6b6b';

  const handleShare = async () => {
    setShareLoading(true);
    try {
      // In production: generate signed attestation URL via backend
      // const res = await fetch('/api/credential/attest', { ... })
      const mockUrl = `https://flowpilot.app/credential/${streamId}?sig=mock_sig_${Date.now()}`;
      setShareUrl(mockUrl);
      await navigator.clipboard.writeText(mockUrl);
    } catch {
      // Clipboard API may fail in some contexts
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🪪 Work Credential</h2>
      <p style={styles.subtitle}>
        Your soul-bound employment and financial identity. Non-transferable, on-chain.
      </p>

      {/* Main credential card */}
      <div style={styles.credCard}>
        {/* Header */}
        <div style={styles.credHeader}>
          <div>
            <div style={styles.credRole}>{credential.role}</div>
            <div style={styles.credEmployer}>@ {formatAddress(credential.employer)}</div>
          </div>
          <div style={styles.soulBoundBadge}>⚡ Soul-Bound</div>
        </div>

        {/* Address */}
        <div style={styles.addressRow}>
          <span style={styles.addressLabel}>Worker</span>
          <span style={styles.address}>{credential.workerAddress}</span>
        </div>

        {/* Duration bar */}
        <div style={styles.durationSection}>
          <div style={styles.durationHeader}>
            <span style={styles.durationLabel}>Employment Duration</span>
            <span style={styles.durationValue}>{durationDays} days</span>
          </div>
          <div style={styles.durationBar}>
            <div style={{ ...styles.durationFill, width: `${Math.min(durationDays / 365, 1) * 100}%` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={styles.statsGrid}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Total Earned</span>
            <span style={{ ...styles.statValue, color: '#00ef8b' }}>
              {formatBalance(credential.totalEarned)} FLOW
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Yield Earned</span>
            <span style={{ ...styles.statValue, color: '#f7b731' }}>
              {formatBalance(credential.totalYieldEarned)} FLOW
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Avg APY</span>
            <span style={{ ...styles.statValue, color: '#5b8dee' }}>
              {formatAPY(credential.averageAPY)}
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Milestones</span>
            <span style={styles.statValue}>{credential.milestonesCompleted}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Disputes</span>
            <span style={{
              ...styles.statValue,
              color: credential.disputesRaised > 0 ? '#ff6b6b' : '#00ef8b',
            }}>
              {credential.disputesRaised}
            </span>
          </div>
        </div>

        {/* Milestone progress */}
        <div style={styles.milestoneSection}>
          <div style={styles.milestoneHeader}>
            <span style={styles.milestoneLabel}>Milestones Completed</span>
            <span style={styles.milestoneCount}>
              {credential.milestonesCompleted} / 12
            </span>
          </div>
          <div style={styles.milestoneBar}>
            <div style={{ ...styles.milestoneFill, width: `${progressPercent}%` }} />
          </div>
          <div style={styles.milestoneDots}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.milestoneDot,
                  background: i < credential.milestonesCompleted ? '#00ef8b' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Credit score */}
        <div style={styles.creditSection}>
          <div style={styles.creditLabel}>FlowPilot Credit Score</div>
          <div style={{ ...styles.creditScore, color: creditScoreColor }}>
            {credential.creditScore.toFixed(0)}
          </div>
          <div style={styles.creditDesc}>
            Based on milestones × 10 + yield / 100, divided by (disputes + 1)
          </div>
        </div>
      </div>

      {/* Share button */}
      <div style={styles.shareSection}>
        <button
          style={{ ...styles.shareButton, opacity: shareLoading ? 0.5 : 1 }}
          onClick={handleShare}
          disabled={shareLoading}
        >
          {shareLoading ? 'Generating...' : '🔗 Share Credential Attestation'}
        </button>
        {shareUrl && (
          <div style={styles.shareUrlBox}>
            <span style={styles.shareUrlLabel}>✓ Copied to clipboard:</span>
            <span style={styles.shareUrl}>{shareUrl}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' },
  subtitle: { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 },
  credCard: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #12172a 100%)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 20,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    maxWidth: 600,
  },
  credHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  credRole: { fontSize: 20, fontWeight: 800, color: '#fff' },
  credEmployer: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  soulBoundBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: '#5b8dee',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 6,
    padding: '4px 10px',
  },
  addressRow: { display: 'flex', alignItems: 'center', gap: 8 },
  addressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  address: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' },
  durationSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  durationHeader: { display: 'flex', justifyContent: 'space-between' },
  durationLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  durationValue: { fontSize: 13, color: '#fff', fontWeight: 600 },
  durationBar: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' as const },
  durationFill: { height: '100%', background: '#5b8dee', borderRadius: 2 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  stat: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  statValue: { fontSize: 16, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' },
  milestoneSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  milestoneHeader: { display: 'flex', justifyContent: 'space-between' },
  milestoneLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  milestoneCount: { fontSize: 13, fontWeight: 700, color: '#00ef8b' },
  milestoneBar: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' as const },
  milestoneFill: { height: '100%', background: '#00ef8b', borderRadius: 2, transition: 'width 0.5s' },
  milestoneDots: { display: 'flex', gap: 4 },
  milestoneDot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.3s' },
  creditSection: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center' as const,
  },
  creditLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
  creditScore: { fontSize: 48, fontWeight: 900, letterSpacing: -2, lineHeight: 1 },
  creditDesc: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, lineHeight: 1.4 },
  shareSection: { display: 'flex', flexDirection: 'column', gap: 12 },
  shareButton: {
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 12,
    padding: '12px 24px',
    color: '#5b8dee',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    width: 'fit-content' as const,
    transition: 'opacity 0.2s',
  },
  shareUrlBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 14px',
    background: 'rgba(0,239,139,0.05)',
    border: '1px solid rgba(0,239,139,0.15)',
    borderRadius: 8,
  },
  shareUrlLabel: { fontSize: 12, color: '#00ef8b' },
  shareUrl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', wordBreak: 'break-all' as const },
};

export default WorkCredentialCard;
