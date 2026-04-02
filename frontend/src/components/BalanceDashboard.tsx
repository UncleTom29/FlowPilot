import React, { useState } from 'react';
import LiveTicker from './LiveTicker';
import RuleCard from './RuleCard';
import AddRuleModal from './AddRuleModal';
import { useVaultState } from '../hooks/useVaultState';
import { useRules } from '../hooks/useRules';
import * as fcl from '@onflow/fcl';
import { withCadenceImports } from '../cadenceConfig';

interface BalanceDashboardProps {
  userAddress: string;
  streamId: string;
  readOnly?: boolean;
}

const BalanceDashboard: React.FC<BalanceDashboardProps> = ({
  userAddress,
  streamId,
  readOnly = false,
}) => {
  const vaultState = useVaultState(userAddress, streamId);
  const { rules, removeRule, refetch: refetchRules, loading: rulesLoading } = useRules(
    userAddress,
    streamId
  );
  const [showAddRule, setShowAddRule] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Per-second rate (derived from salary accrual)
  // In production: fetched from CreateStream event or RuleGraph
  const ratePerSecond = 0.000772;  // ~$2000/month in FLOW

  const handleClaimAll = async () => {
    if (readOnly || claiming || vaultState.claimableTotal <= 0) return;
    setClaiming(true);
    try {
      const txId = await fcl.mutate({
        cadence: withCadenceImports(`
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000

transaction(streamId: String, amount: UFix64) {
  prepare(worker: auth(Storage) &Account) {
    let vaultPath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!
    let vault = worker.storage.borrow<auth(FlowPilotVault.Claim) &FlowPilotVault.Vault>(from: vaultPath)
      ?? panic("Vault not found")
    let claimed <- vault.claim(amount: amount)
    let receiver = worker.storage.borrow<&{FungibleToken.Receiver}>(from: /storage/flowTokenVault)
      ?? panic("Receiver not found")
    receiver.deposit(from: <- claimed)
  }
}`),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(streamId, (t as Record<string, Function>)['String']),
          (arg as Function)(vaultState.claimableTotal.toFixed(8), (t as Record<string, Function>)['UFix64']),
        ],
        limit: 9999,
      });
      await fcl.tx(txId).onceSealed();
      vaultState.refetch();
    } catch (err) {
      console.error('Claim failed:', err);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Main balance display */}
      <div style={styles.balanceCard}>
        <LiveTicker
          balance={vaultState.claimableTotal}
          ratePerSecond={ratePerSecond}
          isLoading={vaultState.loading}
          label="Total Claimable Balance"
          color="#00ef8b"
        />
        <button
          style={{
            ...styles.claimButton,
            opacity: readOnly || claiming || vaultState.claimableTotal <= 0 ? 0.5 : 1,
          }}
          onClick={handleClaimAll}
          disabled={readOnly || claiming || vaultState.claimableTotal <= 0}
        >
          {readOnly ? 'Read-Only Demo' : claiming ? 'Claiming...' : '💸 Withdraw All'}
        </button>
      </div>

      {/* Sub-ledger pills */}
      <div style={styles.pillRow}>
        <div style={{ ...styles.pill, borderColor: '#00ef8b22' }}>
          <span style={styles.pillLabel}>Salary Earned</span>
          <span style={{ ...styles.pillValue, color: '#00ef8b' }}>
            {vaultState.salaryAccrued.toFixed(4)} FLOW
          </span>
        </div>
        <div style={{ ...styles.pill, borderColor: '#f7b73122' }}>
          <span style={styles.pillLabel}>Yield Earned</span>
          <span style={{ ...styles.pillValue, color: '#f7b731' }}>
            {vaultState.yieldEarned.toFixed(4)} FLOW
          </span>
        </div>
        <div style={{ ...styles.pill, borderColor: '#5b8dee22' }}>
          <span style={styles.pillLabel}>Savings Vault</span>
          <span style={{ ...styles.pillValue, color: '#5b8dee' }}>
            {vaultState.yieldPrincipal.toFixed(4)} FLOW
          </span>
        </div>
      </div>

      {/* Status indicators */}
      {vaultState.milestoneDisputed && (
        <div style={styles.warningBanner}>
          ⚠️ Milestone dispute active — yield and DCA paused pending jury resolution
        </div>
      )}

      {readOnly && (
        <div style={styles.infoBanner}>
          Viewing a seeded Flow testnet account. Connect the matching operator account to claim funds or change rules.
        </div>
      )}

      {/* Active rules section */}
      <div style={styles.rulesSection}>
        <div style={styles.rulesSectionHeader}>
          <h3 style={styles.sectionTitle}>Active Rules</h3>
          <span style={styles.ruleCount}>{rules.length} rules</span>
        </div>

        {/* Add rule input */}
        {readOnly ? (
          <div style={styles.readOnlyCard}>
            Rule editing becomes available when the operator signer is connected.
          </div>
        ) : (
          <button
            style={styles.addRuleButton}
            onClick={() => setShowAddRule(true)}
          >
            <span style={styles.addRuleIcon}>+</span>
            Add a rule in plain English...
          </button>
        )}

        {/* Rules list */}
        {rulesLoading && rules.length === 0 ? (
          <p style={styles.loadingText}>Loading rules...</p>
        ) : rules.length === 0 ? (
          <div style={styles.emptyRules}>
            <p>No rules yet. Add your first financial rule above.</p>
            <p style={styles.emptyHint}>
              Try: "save 20% of every paycheck" or "buy $50 FLOW every Friday"
            </p>
          </div>
        ) : (
          <div style={styles.rulesList}>
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                status={vaultState.milestoneDisputed ? 'disputed' : 'active'}
                onDelete={readOnly ? undefined : removeRule}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add rule modal */}
      {showAddRule && !readOnly && (
        <AddRuleModal
          userAddress={userAddress}
          streamId={streamId}
          onClose={() => setShowAddRule(false)}
          onRuleAdded={() => {
            setShowAddRule(false);
            refetchRules();
          }}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  balanceCard: {
    background: 'linear-gradient(135deg, rgba(0,239,139,0.08) 0%, rgba(91,141,238,0.08) 100%)',
    border: '1px solid rgba(0,239,139,0.2)',
    borderRadius: 20,
    padding: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 24,
  },
  claimButton: {
    background: '#00ef8b',
    border: 'none',
    borderRadius: 12,
    padding: '14px 28px',
    color: '#000',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  pillRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  pill: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  pillLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  pillValue: {
    fontSize: 20,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  warningBanner: {
    background: 'rgba(255,107,107,0.1)',
    border: '1px solid rgba(255,107,107,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: '#ff9e9e',
  },
  infoBanner: {
    background: 'rgba(91,141,238,0.12)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: '#bdd0ff',
  },
  rulesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  rulesSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  ruleCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  addRuleButton: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: '16px 20px',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 15,
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    transition: 'all 0.2s',
  },
  addRuleIcon: {
    fontSize: 20,
    color: '#00ef8b',
    lineHeight: 1,
  },
  readOnlyCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '16px 20px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  emptyRules: {
    textAlign: 'center' as const,
    padding: '32px 0',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  emptyHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
};

export default BalanceDashboard;
