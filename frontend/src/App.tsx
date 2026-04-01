import React, { useEffect, useMemo, useState } from 'react';
import './app.css';
import {
  getDashboardStreamId,
  getDemoDashboardAccount,
  safeNormalizeFlowAddress,
} from './cadenceConfig';
import { useVaultState } from './hooks/useVaultState';
import { useRules } from './hooks/useRules';
import { useDeploymentState, type ActivityItem } from './hooks/useDeploymentState';
import { useLotteryPool } from './hooks/useLotteryPool';
import { useGiftCards } from './hooks/useGiftCards';
import { useWorkCredential } from './hooks/useWorkCredential';
import { usePortfolio } from './hooks/usePortfolio';
import { useSubscriptions } from './hooks/useSubscriptions';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

type ViewKey =
  | 'dashboard'
  | 'stream'
  | 'rules'
  | 'yield'
  | 'dca'
  | 'portfolio'
  | 'subscriptions'
  | 'lottery'
  | 'giftcards'
  | 'credential';

type ToastState = {
  kind: 'success' | 'error';
  message: string;
} | null;

type NavItem = {
  key: ViewKey;
  label: string;
  section: string;
  badge?: string;
  badgeTone?: 'amber' | 'blue' | 'purple';
  icon: React.ReactNode;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function formatFlow(value: number, digits = 2): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} FLOW`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function shortAddress(value: string): string {
  return value ? `${value.slice(0, 8)}...${value.slice(-4)}` : 'Unavailable';
}

function relativeTime(timestamp: string): string {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload as T;
}

function icon(path: string) {
  return (
    <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d={path} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', section: 'Overview', badge: 'Live', icon: icon('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z') },
  { key: 'stream', label: 'Stream', section: 'Overview', icon: icon('M12 2v20M2 12h20M7 7l10 10M17 7L7 17') },
  { key: 'rules', label: 'Rules', section: 'Autopilot Rules', badge: 'Live', icon: icon('M4 7h16M4 12h16M4 17h16') },
  { key: 'yield', label: 'Yield', section: 'Autopilot Rules', icon: icon('M4 16l5-5 4 4 7-8') },
  { key: 'dca', label: 'DCA', section: 'Autopilot Rules', icon: icon('M12 6v6l4 2M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Z') },
  { key: 'portfolio', label: 'Portfolio', section: 'Autopilot Rules', icon: icon('M12 2 2 7l10 5 10-5-10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5') },
  { key: 'subscriptions', label: 'Subscriptions', section: 'Features', icon: icon('M2 7h20v10H2zM2 11h20') },
  { key: 'lottery', label: 'Lottery', section: 'Features', badge: 'Draw soon', badgeTone: 'amber', icon: icon('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 13-3-3 1.5-1.5L11 12l4.5-4.5L17 9Z') },
  { key: 'giftcards', label: 'Gift Cards', section: 'Features', icon: icon('M20 12v10H4V12M22 7H2v5h20V7M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z') },
  { key: 'credential', label: 'Credential', section: 'Features', icon: icon('M2 7h20v14H2zM7 3h10v4H7zM12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z') },
];

const PAGE_COPY: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Your autonomous finance overview on Flow testnet' },
  stream: { title: 'Stream', subtitle: 'Real-time payroll, yield float, and treasury health' },
  rules: { title: 'Rules', subtitle: 'Natural-language automation deployed to RuleGraph' },
  yield: { title: 'Yield Engine', subtitle: 'How float capital compounds and routes across autopilots' },
  dca: { title: 'DCA Autopilot', subtitle: 'Recurring allocation rules running from your managed treasury' },
  portfolio: { title: 'AI Portfolio', subtitle: 'Risk-managed treasury allocations with oracle-backed context' },
  subscriptions: { title: 'Subscriptions', subtitle: 'Recurring payouts published as live Cadence resources' },
  lottery: { title: 'Lottery', subtitle: 'Lossless prize pool seeded from real testnet activity' },
  giftcards: { title: 'Gift Cards', subtitle: 'Yield-bearing cards minted from the treasury vault' },
  credential: { title: 'Credential', subtitle: 'Your non-transferable on-chain work and finance identity' },
};

const App: React.FC = () => {
  const deployment = useDeploymentState();
  const seededAccount = safeNormalizeFlowAddress(
    deployment.data?.cadence?.accountAddress ?? getDemoDashboardAccount()
  );
  const streamId = deployment.data?.cadence?.streamId ?? getDashboardStreamId();
  const poolId = deployment.data?.cadence?.poolId ?? (import.meta.env.VITE_FLOW_DASHBOARD_LOTTERY_ID ?? 'primary-pool');
  const portfolioId = deployment.data?.cadence?.portfolioId ?? (import.meta.env.VITE_FLOW_DASHBOARD_PORTFOLIO_ID ?? 'core-portfolio');
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [toast, setToast] = useState<ToastState>(null);
  const [now, setNow] = useState(Date.now());
  const [claimOpen, setClaimOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState('25');
  const [ruleText, setRuleText] = useState('Buy $50 of FLOW every week from stablecoin reserves.');
  const [giftRecipient, setGiftRecipient] = useState(seededAccount);
  const [giftAmount, setGiftAmount] = useState('15');
  const [giftMessage, setGiftMessage] = useState('Treasury bonus unlocked');
  const [subscriptionPayee, setSubscriptionPayee] = useState(seededAccount);
  const [subscriptionAmount, setSubscriptionAmount] = useState('12');
  const [subscriptionInterval, setSubscriptionInterval] = useState('2592000');
  const [subscriptionDescription, setSubscriptionDescription] = useState('Protocol membership');
  const [lotteryAmount, setLotteryAmount] = useState('10');
  const [localActivity, setLocalActivity] = useState<ActivityItem[]>([]);
  const [subscriptionIds, setSubscriptionIds] = useState<string[]>([]);
  const [rulePreview, setRulePreview] = useState<Record<string, unknown> | null>(null);
  const [rulePreviewLoading, setRulePreviewLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const vault = useVaultState(seededAccount, streamId);
  const rules = useRules(seededAccount, streamId);
  const lottery = useLotteryPool(seededAccount, poolId);
  const giftCards = useGiftCards(seededAccount);
  const credential = useWorkCredential(seededAccount, streamId);
  const portfolio = usePortfolio(seededAccount, portfolioId);
  const subscriptions = useSubscriptions(seededAccount, subscriptionIds);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [toast]);

  useEffect(() => {
    if (seededAccount) {
      setGiftRecipient((current) => current || seededAccount);
      setSubscriptionPayee((current) => current || seededAccount);
    }
  }, [seededAccount]);

  useEffect(() => {
    const seededSubscriptionId = deployment.data?.cadence?.subscriptionId;
    if (seededSubscriptionId) {
      setSubscriptionIds((current) => (current.includes(seededSubscriptionId) ? current : [seededSubscriptionId, ...current]));
    }
  }, [deployment.data?.cadence?.subscriptionId]);

  useEffect(() => {
    if (!ruleOpen || !ruleText.trim()) {
      setRulePreview(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setRulePreviewLoading(true);
        const preview = await rules.parseRule(ruleText);
        setRulePreview(preview);
      } catch {
        setRulePreview(null);
      } finally {
        setRulePreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [ruleOpen, ruleText, rules.parseRule]);

  const mergedActivity = useMemo(() => {
    const persisted = deployment.data?.cadence?.activity ?? [];
    return [...localActivity, ...persisted].sort(
      (left, right) => new Date(String(right.timestamp)).getTime() - new Date(String(left.timestamp)).getTime()
    );
  }, [deployment.data?.cadence?.activity, localActivity]);

  const salaryPerSecond = parseFloat(import.meta.env.VITE_FLOW_DASHBOARD_SALARY_RATE ?? '0.000772');
  const yieldPerSecond = credential.data ? credential.data.totalYieldEarned / Math.max(credential.data.durationSeconds, 1) : 0;
  const totalPerSecond = salaryPerSecond + yieldPerSecond;
  const savingsShare = clamp((vault.yieldPrincipal / Math.max(vault.tokenBalance, 1)) * 100);
  const liquidShare = clamp((vault.claimableTotal / Math.max(vault.tokenBalance, 1)) * 100);
  const yieldShare = clamp((vault.yieldEarned / Math.max(vault.tokenBalance, 1)) * 100);
  const activeRules = rules.rules;
  const dcaRules = activeRules.filter((rule) => rule.type === 'dca');
  const subscriptionRules = activeRules.filter((rule) => rule.type === 'subscription');
  const featureRules = activeRules.filter((rule) => ['portfolio', 'roundup', 'giftcard', 'lottery_entry', 'savings_split'].includes(rule.type));
  const lotteryDrawActivity = mergedActivity.find(
    (item) => item.category === 'lottery' && String(item.title).toLowerCase().includes('closed')
  );
  const nextDrawAt = (lotteryDrawActivity ? new Date(String(lotteryDrawActivity.timestamp)).getTime() : now) + 24 * 60 * 60 * 1000;
  const countdownMillis = Math.max(0, nextDrawAt - now);
  const countdown = {
    hours: String(Math.floor(countdownMillis / 3_600_000)).padStart(2, '0'),
    minutes: String(Math.floor((countdownMillis % 3_600_000) / 60_000)).padStart(2, '0'),
    seconds: String(Math.floor((countdownMillis % 60_000) / 1_000)).padStart(2, '0'),
  };
  const workProof = deployment.data?.evm?.seedData?.workProof as Record<string, unknown> | undefined;
  const oraclePortfolioId = deployment.data?.evm?.seedData?.portfolioId as string | undefined;

  function pushActivity(title: string, category: string, txId?: string | null, extra: Record<string, unknown> = {}) {
    setLocalActivity((current) => [
      {
        title,
        category,
        txId: txId ?? null,
        explorerUrl: txId ? `https://testnet.flowscan.io/transaction/${txId}` : null,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      ...current,
    ]);
  }

  function showError(error: unknown) {
    setToast({
      kind: 'error',
      message: error instanceof Error ? error.message : 'Request failed',
    });
  }

  async function handleClaim() {
    try {
      setActionBusy('claim');
      const payload = await postJson<{ transactionId: string }>('/api/claim-balance', {
        streamId,
        amount: Number(claimAmount),
      });
      pushActivity('Claimed streamed earnings', 'claim', payload.transactionId, { amount: claimAmount });
      await Promise.all([vault.refetch(), credential.refetch()]);
      setClaimOpen(false);
      setToast({ kind: 'success', message: 'Claim sent through the managed Flow testnet signer.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateRule() {
    try {
      setActionBusy('rule');
      const payload = await rules.createRule(ruleText);
      const relayResults = (payload as { relayResults?: Array<{ transactionId?: string }> }).relayResults ?? [];
      pushActivity('Deployed new natural-language automation', 'rule', relayResults[0]?.transactionId ?? null, {
        text: ruleText,
      });
      setRuleOpen(false);
      await rules.refetch();
      setToast({ kind: 'success', message: 'Rule compiled and deployed to RuleGraph.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleLotteryDeposit() {
    try {
      setActionBusy('lottery-deposit');
      const payload = await postJson<{ transactionId: string }>('/api/lottery/deposit', {
        poolId,
        amount: Number(lotteryAmount),
      });
      pushActivity('Deposited FLOW into the live lottery pool', 'lottery', payload.transactionId, {
        amount: lotteryAmount,
      });
      await lottery.refetch();
      setToast({ kind: 'success', message: 'Lottery pool deposit sent.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleLotteryDraw() {
    try {
      setActionBusy('lottery-draw');
      const payload = await postJson<{ transactionId: string }>('/api/lottery/draw', { poolId });
      pushActivity('Triggered a live lottery draw', 'lottery', payload.transactionId, { poolId });
      await lottery.refetch();
      setToast({ kind: 'success', message: 'Lottery draw transaction sent.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleMintGiftCard() {
    try {
      setActionBusy('gift-mint');
      const payload = await postJson<{ transactionId: string }>('/api/giftcards/mint', {
        vaultId: streamId,
        recipientAddress: giftRecipient,
        message: giftMessage,
        principalAmount: Number(giftAmount),
        targetDate: 0,
      });
      pushActivity('Minted a yield-bearing gift card', 'giftcard', payload.transactionId, { amount: giftAmount });
      await giftCards.refetch();
      setToast({ kind: 'success', message: 'Gift card minted on Flow testnet.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRedeemGiftCard(cardId: number) {
    try {
      setActionBusy(`gift-${cardId}`);
      const payload = await postJson<{ transactionId: string }>('/api/giftcards/redeem', {
        cardId,
        streamId,
      });
      pushActivity('Redeemed a yield-bearing gift card', 'giftcard', payload.transactionId, { cardId });
      await Promise.all([giftCards.refetch(), vault.refetch()]);
      setToast({ kind: 'success', message: 'Gift card redemption sent.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateSubscription() {
    const nextId = `subscription_${Date.now()}`;
    try {
      setActionBusy('subscription');
      const payload = await postJson<{ transactionId: string }>('/api/subscriptions/create', {
        subscriptionId: nextId,
        payeeAddress: subscriptionPayee,
        amount: Number(subscriptionAmount),
        intervalSeconds: Number(subscriptionInterval),
        description: subscriptionDescription,
        vaultId: streamId,
        maxPayments: 12,
      });
      setSubscriptionIds((current) => [nextId, ...current]);
      pushActivity('Created a recurring treasury subscription', 'subscription', payload.transactionId, {
        subscriptionId: nextId,
      });
      setToast({ kind: 'success', message: 'Subscription resource created.' });
    } catch (error) {
      showError(error);
    } finally {
      setActionBusy(null);
    }
  }

  if (!seededAccount) {
    return (
      <div className="setup-shell">
        <div className="setup-card">
          <div className="kicker">FLOWPILOT TESTNET BOOTSTRAP REQUIRED</div>
          <h1>Deploy the managed Flow testnet environment first.</h1>
          <p>
            The frontend now reads live Cadence state and managed deployment metadata. It expects the
            bootstrap flow to publish public capabilities, seed the dashboard, and write local runtime
            config.
          </p>
          <div className="setup-list">
            <div className="setup-step">1. Run <span className="mono">npm run deploy:testnet</span></div>
            <div className="setup-step">2. Start the backend with <span className="mono">npm run dev -w backend</span></div>
            <div className="setup-step">3. Start the frontend with <span className="mono">npm run dev -w frontend</span></div>
          </div>
          <p className="small-note">The bootstrap uses the local flow-tester.private.json credentials.</p>
        </div>
      </div>
    );
  }

  const page = PAGE_COPY[activeView];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <path d="M4 12h7l-2 8 11-12h-7l2-8-11 12Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="logo-text">FlowPilot</div>
              <div className="logo-sub">v2.0 · TESTNET</div>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">FP</div>
          <div className="user-info">
            <div className="user-name">Managed Flow Operator</div>
            <div className="user-addr">{shortAddress(seededAccount)}</div>
          </div>
          <div className="status-dot" title="Live testnet session" />
        </div>

        <nav className="sidebar-nav">
          {['Overview', 'Autopilot Rules', 'Features'].map((section) => (
            <React.Fragment key={section}>
              <div className="nav-section-label">{section}</div>
              {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
                <button
                  key={item.key}
                  className={`nav-item ${activeView === item.key ? 'active' : ''}`}
                  onClick={() => setActiveView(item.key)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className={`nav-badge ${item.badgeTone ?? ''}`.trim()}>{item.badge}</span>
                  ) : null}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="gas-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2v6m0 8v6m10-10h-6M8 12H2m17.657-5.657-4.243 4.243M8.586 15.414l-4.243 4.243m0-13.314 4.243 4.243m6.828 6.828 4.243 4.243" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="gas-text">
              <strong>Gas-free</strong> — all transactions sponsored by FlowPilot
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="page-title">{page.title}</div>
            <div className="page-subtitle">{page.subtitle}</div>
          </div>
          <div className="topbar-right">
            <button className="btn btn-ghost" onClick={() => setClaimOpen(true)}>
              Withdraw Earnings
            </button>
            <button className="btn btn-primary" onClick={() => setRuleOpen(true)}>
              Add Rule
            </button>
          </div>
        </div>

        <div className="content">
          <div className="view-stack">
            {activeView === 'dashboard' ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card green">
                    <div className="stat-label">Total Balance</div>
                    <div className="stat-value green">{formatFlow(vault.tokenBalance)}</div>
                    <div className="stat-sub up">Claimable + savings + live yield</div>
                  </div>
                  <div className="stat-card amber">
                    <div className="stat-label">Yield Earned</div>
                    <div className="stat-value amber">{formatFlow(vault.yieldEarned)}</div>
                    <div className="stat-sub">{formatPercent(credential.data?.averageAPY ?? 8.4)} average APY</div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-label">Active Rules</div>
                    <div className="stat-value blue">{activeRules.length}</div>
                    <div className="stat-sub up">RuleGraph is live on testnet</div>
                  </div>
                  <div className="stat-card purple">
                    <div className="stat-label">Savings Vault</div>
                    <div className="stat-value purple">{formatFlow(vault.yieldPrincipal)}</div>
                    <div className="stat-sub">Treasury float routed by autopilot</div>
                  </div>
                </div>

                <div className="two-col">
                  <div className="card">
                    <div className="card-body">
                      <div className="ticker-display">
                        <div className="ticker-label">Earning right now</div>
                        <div className="ticker-value">{formatFlow(totalPerSecond, 4)}</div>
                        <div className="ticker-rate">{formatFlow(salaryPerSecond, 6)}/sec salary + {formatFlow(yieldPerSecond, 6)}/sec yield</div>
                        <div className="ticker-pills">
                          <div className="ticker-pill">
                            <div className="tp-label">Salary</div>
                            <div className="tp-val green">{formatFlow(vault.salaryAccrued)}</div>
                          </div>
                          <div className="ticker-pill">
                            <div className="tp-label">Yield</div>
                            <div className="tp-val amber">{formatFlow(vault.yieldEarned)}</div>
                          </div>
                          <div className="ticker-pill">
                            <div className="tp-label">Savings</div>
                            <div className="tp-val blue">{formatFlow(vault.yieldPrincipal)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-header">
                          <div className="card-title">Active Rules</div>
                          <button className="btn btn-ghost" onClick={() => setActiveView('rules')}>View all</button>
                        </div>
                        <div className="card-body compact">
                          <div className="rules-list">
                            {activeRules.slice(0, 4).map((rule) => (
                              <div className="rule-item" key={rule.id}>
                                <div className="rule-copy">
                                  <div className="rule-title">{rule.rawText ?? rule.type}</div>
                                  <div className="rule-text">{rule.type} · {Object.keys(rule.params).length} configured params</div>
                                </div>
                                <span className="rule-status rs-active"><span className="rs-dot" />Live</span>
                              </div>
                            ))}
                            {!activeRules.length ? <div className="empty-state">No rules deployed yet.</div> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="view-stack">
                    <div className="card">
                      <div className="card-header">
                        <div className="card-title">Stream Status</div>
                        <span className="rule-status rs-active"><span className="rs-dot" />Streaming</span>
                      </div>
                      <div className="card-body">
                        <div>
                          <div className="metric-row">
                            <div className="metric-title">Liquid balance</div>
                            <div className="metric-value green">{formatPercent(liquidShare)}</div>
                          </div>
                          <div className="progress-bar"><div className="progress-fill pf-green" style={{ width: `${liquidShare}%` }} /></div>
                        </div>
                        <div>
                          <div className="metric-row">
                            <div className="metric-title">Savings reserve</div>
                            <div className="metric-value blue">{formatPercent(savingsShare)}</div>
                          </div>
                          <div className="progress-bar"><div className="progress-fill pf-blue" style={{ width: `${savingsShare}%` }} /></div>
                        </div>
                        <div>
                          <div className="metric-row">
                            <div className="metric-title">Unlocked yield</div>
                            <div className="metric-value amber">{formatPercent(yieldShare)}</div>
                          </div>
                          <div className="progress-bar"><div className="progress-fill pf-amber" style={{ width: `${yieldShare}%` }} /></div>
                        </div>
                        <div className="key-value-list">
                          <div className="key-value-row"><span>Last rebalance</span><span>{vault.lastRebalanceTimestamp ? new Date(vault.lastRebalanceTimestamp * 1000).toLocaleString() : 'Not yet'}</span></div>
                          <div className="key-value-row"><span>Yield harvest lock</span><span>{vault.yieldLocked ? 'Locked' : 'Open'}</span></div>
                          <div className="key-value-row"><span>Milestone dispute</span><span>{vault.milestoneDisputed ? 'Raised' : 'Clear'}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="lottery-hero">
                      <div className="stat-label">Lossless Lottery Pool</div>
                      <div className="lottery-jackpot">{formatFlow(lottery.data?.yieldAccumulated ?? 0)}</div>
                      <div className="lottery-apy"><span className="apy-badge">{formatPercent(credential.data?.averageAPY ?? 8.4)}</span>funding the next prize draw</div>
                      <div className="countdown">
                        <div className="cd-block"><div className="cd-num">{countdown.hours}</div><div className="cd-unit">hrs</div></div>
                        <div className="cd-block"><div className="cd-num">{countdown.minutes}</div><div className="cd-unit">min</div></div>
                        <div className="cd-block"><div className="cd-num">{countdown.seconds}</div><div className="cd-unit">sec</div></div>
                      </div>
                      <button className="btn btn-primary btn-block" onClick={() => setActiveView('lottery')}>Open Lottery Control</button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">On-chain Activity</div>
                    <span className="badge blue">{mergedActivity.length} events</span>
                  </div>
                  <div className="card-body compact">
                    <div className="activity-list">
                      {mergedActivity.slice(0, 8).map((item, index) => (
                        <div className="activity-item" key={`${item.title}-${index}-${item.timestamp}`}>
                          <div className="activity-copy">
                            <div className="activity-title">{item.title}</div>
                            <div className="activity-meta">{item.category} · {relativeTime(String(item.timestamp))}</div>
                          </div>
                          {item.explorerUrl ? <a className="link" href={String(item.explorerUrl)} target="_blank" rel="noreferrer">View tx</a> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeView === 'stream' ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card green"><div className="stat-label">Salary Accrued</div><div className="stat-value green">{formatFlow(vault.salaryAccrued)}</div><div className="stat-sub up">{formatFlow(salaryPerSecond, 6)}/sec</div></div>
                  <div className="stat-card amber"><div className="stat-label">Yield on Float</div><div className="stat-value amber">{formatFlow(vault.yieldEarned)}</div><div className="stat-sub">{formatPercent(vault.yieldSplitRatio * 100)} routed to the operator</div></div>
                  <div className="stat-card blue"><div className="stat-label">Stream Health</div><div className="stat-value blue">{vault.milestoneDisputed ? '82%' : '100%'}</div><div className="stat-sub up">No capability read issues</div></div>
                  <div className="stat-card purple"><div className="stat-label">Milestones</div><div className="stat-value purple">{credential.data?.milestonesCompleted ?? 0}</div><div className="stat-sub">Invisible security, visible auditability</div></div>
                </div>

                <div className="two-col">
                  <div className="card">
                    <div className="card-header"><div className="card-title">Stream Timeline</div><span className="rule-status rs-active"><span className="rs-dot" />Managed</span></div>
                    <div className="card-body">
                      <div className="timeline">
                        {mergedActivity.filter((item) => ['stream', 'yield', 'claim'].includes(item.category)).slice(0, 6).map((item, index) => (
                          <div className="timeline-item" key={`${item.title}-${index}`}>
                            <div className="activity-copy">
                              <div className="activity-title">{item.title}</div>
                              <div className="activity-meta">{new Date(String(item.timestamp)).toLocaleString()}</div>
                            </div>
                            <span className="badge blue">{item.category}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="view-stack">
                    <div className="card">
                      <div className="card-header"><div className="card-title">Tri-Ledger Breakdown</div></div>
                      <div className="card-body">
                        <div>
                          <div className="metric-row"><span>Salary accrual</span><span>{formatFlow(vault.salaryAccrued)}</span></div>
                          <div className="progress-bar"><div className="progress-fill pf-green" style={{ width: `${clamp((vault.salaryAccrued / Math.max(vault.tokenBalance, 1)) * 100)}%` }} /></div>
                        </div>
                        <div>
                          <div className="metric-row"><span>Savings reserve</span><span>{formatFlow(vault.yieldPrincipal)}</span></div>
                          <div className="progress-bar"><div className="progress-fill pf-blue" style={{ width: `${savingsShare}%` }} /></div>
                        </div>
                        <div>
                          <div className="metric-row"><span>Unlocked yield</span><span>{formatFlow(vault.yieldEarned)}</span></div>
                          <div className="progress-bar"><div className="progress-fill pf-amber" style={{ width: `${yieldShare}%` }} /></div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header"><div className="card-title">Work Proof Oracle</div></div>
                      <div className="card-body">
                        <div className="key-value-list">
                          <div className="key-value-row"><span>Verifier</span><span className="mono">{shortAddress(String(deployment.data?.evm?.contracts?.WorkProofVerifier ?? ''))}</span></div>
                          <div className="key-value-row"><span>Milestone ID</span><span className="mono">{shortAddress(String(workProof?.milestoneId ?? ''))}</span></div>
                          <div className="key-value-row"><span>Worker</span><span className="mono">{shortAddress(String(workProof?.worker ?? ''))}</span></div>
                          <div className="key-value-row"><span>Status</span><span>{workProof?.verified ? 'Verified' : 'Pending'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeView === 'rules' ? (
              <div className="two-col">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Active Rules ({activeRules.length})</div>
                    <button className="btn btn-primary" onClick={() => setRuleOpen(true)}>+ Add Rule</button>
                  </div>
                  <div className="card-body compact">
                    <div className="rules-list">
                      {activeRules.map((rule) => (
                        <div className="rule-item" key={rule.id}>
                          <div className="rule-copy">
                            <div className="rule-title">{rule.rawText ?? rule.type}</div>
                            <div className="rule-text">{rule.type} · {JSON.stringify(rule.params)}</div>
                          </div>
                          <span className="rule-status rs-active"><span className="rs-dot" />On-chain</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">NL Compiler</div></div>
                  <div className="card-body">
                    <textarea className="textarea" value={ruleText} onChange={(event) => setRuleText(event.target.value)} />
                    {rulePreviewLoading ? <div className="empty-state">Parsing rule preview…</div> : null}
                    {rulePreview && !rulePreviewLoading ? (
                      <div className="feature-card">
                        <div className="metric-title">Compiler preview</div>
                        <div className="metric-sub">{String(rulePreview.description ?? 'Structured output ready')}</div>
                        <div className="small-note">{JSON.stringify(rulePreview.rule ?? {}, null, 2)}</div>
                      </div>
                    ) : null}
                    <button className="btn btn-primary btn-block" onClick={() => setRuleOpen(true)}>Deploy This Rule</button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'yield' ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card amber"><div className="stat-label">Operator APY</div><div className="stat-value amber">{formatPercent(credential.data?.averageAPY ?? 0)}</div><div className="stat-sub">Derived from live credential history</div></div>
                  <div className="stat-card blue"><div className="stat-label">Yield Principal</div><div className="stat-value blue">{formatFlow(vault.yieldPrincipal)}</div><div className="stat-sub">Float routed into reserve strategies</div></div>
                  <div className="stat-card green"><div className="stat-label">Yield Earned</div><div className="stat-value green">{formatFlow(vault.yieldEarned)}</div><div className="stat-sub">Unlocked and available to claim</div></div>
                  <div className="stat-card purple"><div className="stat-label">Treasury Efficiency</div><div className="stat-value purple">{formatPercent(clamp((vault.yieldEarned / Math.max(vault.yieldPrincipal, 1)) * 100, 0, 1000))}</div><div className="stat-sub">Yield versus principal buffer</div></div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <div className="card-header"><div className="card-title">Capital Routing</div></div>
                    <div className="card-body">
                      <div className="feature-grid">
                        {featureRules.map((rule) => (
                          <div className="feature-card" key={rule.id}>
                            <div className="metric-title">{rule.rawText ?? rule.type}</div>
                            <div className="metric-sub">{JSON.stringify(rule.params)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><div className="card-title">Flow-native Guarantees</div></div>
                    <div className="card-body">
                      <div className="feature-grid">
                        {Object.entries(deployment.data?.cadence?.surfacedFeatures ?? {}).map(([feature, enabled]) => (
                          <div className="feature-card" key={feature}>
                            <div className="metric-title">{feature}</div>
                            <div className="metric-sub">{enabled ? 'Enabled in the managed testnet environment' : 'Disabled'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeView === 'dca' ? (
              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><div className="card-title">Recurring Buy Rules</div></div>
                  <div className="card-body compact">
                    <div className="rules-list">
                      {dcaRules.map((rule) => (
                        <div className="rule-item" key={rule.id}>
                          <div className="rule-copy">
                            <div className="rule-title">{rule.rawText ?? 'DCA rule'}</div>
                            <div className="rule-text">Amount: {String(rule.params.amount ?? '0')} · Asset: {String(rule.params.toAsset ?? 'FLOW')}</div>
                          </div>
                          <span className="badge blue">weekly</span>
                        </div>
                      ))}
                      {!dcaRules.length ? <div className="empty-state">No DCA rules found yet.</div> : null}
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><div className="card-title">Monthly Projection</div></div>
                  <div className="card-body">
                    <div className="metric-card">
                      <div className="metric-title">Estimated recurring FLOW allocation</div>
                      <div className="metric-value blue">
                        {formatFlow(
                          dcaRules.reduce((sum, rule) => sum + Number(rule.params.amount ?? 0) * 4, 0)
                        )}
                      </div>
                      <div className="metric-sub">Assumes weekly cadence for the currently deployed DCA rules.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'portfolio' ? (
              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><div className="card-title">Live Allocation Targets</div><span className="badge purple">{portfolio.data?.riskProfile ?? 'unavailable'}</span></div>
                  <div className="card-body compact">
                    <div className="asset-list">
                      {Object.entries(portfolio.data?.allocations ?? {}).map(([asset, percentage]) => (
                        <div className="asset-row" key={asset}>
                          <div className="asset-copy">
                            <div className="asset-title">{asset}</div>
                            <div className="asset-meta">Target allocation</div>
                          </div>
                          <div style={{ minWidth: 160 }}>
                            <div className="metric-row"><span>{percentage}</span><span>{portfolio.data?.holdings?.[asset] ?? '0.0'} held</span></div>
                            <div className="progress-bar"><div className="progress-fill pf-purple" style={{ width: `${clamp(parseFloat(String(percentage)))}%` }} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Oracle Context</div></div>
                  <div className="card-body">
                    <div className="key-value-list">
                      <div className="key-value-row"><span>OracleAggregator</span><span className="mono">{shortAddress(String(deployment.data?.evm?.contracts?.OracleAggregator ?? ''))}</span></div>
                      <div className="key-value-row"><span>Portfolio signal</span><span className="mono">{shortAddress(String(oraclePortfolioId ?? ''))}</span></div>
                      <div className="key-value-row"><span>Rebalances</span><span>{portfolio.data?.totalRebalances ?? 0}</span></div>
                      <div className="key-value-row"><span>Last rebalance</span><span>{portfolio.data?.lastRebalanceTimestamp ? new Date(portfolio.data.lastRebalanceTimestamp * 1000).toLocaleString() : 'Not yet'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'subscriptions' ? (
              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><div className="card-title">Recurring Payouts</div><span className="badge blue">{subscriptions.subscriptions.length}</span></div>
                  <div className="card-body compact">
                    <div className="subscription-list">
                      {subscriptions.subscriptions.map((subscription) => (
                        <div className="subscription-item" key={subscription.subscriptionId}>
                          <div className="subscription-copy">
                            <div className="subscription-title">{subscription.description}</div>
                            <div className="subscription-meta">{formatFlow(subscription.amount)} every {Math.round(subscription.intervalSeconds / 86400)} days · payee {shortAddress(subscription.payee)}</div>
                          </div>
                          <span className={`badge ${subscription.dueNow ? 'amber' : 'blue'}`}>{subscription.dueNow ? 'Due' : 'Active'}</span>
                        </div>
                      ))}
                      {!subscriptions.subscriptions.length ? <div className="empty-state">No live subscriptions published yet.</div> : null}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Create Subscription</div></div>
                  <div className="card-body">
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="label">Payee</span>
                        <input className="input" value={subscriptionPayee} onChange={(event) => setSubscriptionPayee(event.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="label">Amount</span>
                        <input className="input" value={subscriptionAmount} onChange={(event) => setSubscriptionAmount(event.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="label">Interval Seconds</span>
                        <input className="input" value={subscriptionInterval} onChange={(event) => setSubscriptionInterval(event.target.value)} />
                      </label>
                      <label className="form-field full">
                        <span className="label">Description</span>
                        <input className="input" value={subscriptionDescription} onChange={(event) => setSubscriptionDescription(event.target.value)} />
                      </label>
                    </div>
                    <button className="btn btn-primary btn-block" disabled={actionBusy === 'subscription'} onClick={handleCreateSubscription}>Create recurring payment</button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'lottery' ? (
              <div className="grid-2">
                <div className="view-stack">
                  <div className="lottery-hero">
                    <div className="stat-label">Prize Pool</div>
                    <div className="lottery-jackpot">{formatFlow(lottery.data?.yieldAccumulated ?? 0)}</div>
                    <div className="hero-support">{formatFlow(lottery.data?.totalPrincipal ?? 0)} principal contributing {formatCompact(lottery.data?.totalTickets ?? 0)} tickets.</div>
                    <div className="countdown">
                      <div className="cd-block"><div className="cd-num">{countdown.hours}</div><div className="cd-unit">hrs</div></div>
                      <div className="cd-block"><div className="cd-num">{countdown.minutes}</div><div className="cd-unit">min</div></div>
                      <div className="cd-block"><div className="cd-num">{countdown.seconds}</div><div className="cd-unit">sec</div></div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><div className="card-title">Manage Position</div></div>
                    <div className="card-body">
                      <div className="kpi-strip">
                        <div className="metric-card"><div className="metric-title">Your deposit</div><div className="metric-value blue">{formatFlow(lottery.data?.userPrincipal ?? 0)}</div></div>
                        <div className="metric-card"><div className="metric-title">Your tickets</div><div className="metric-value amber">{formatCompact(lottery.data?.userTickets ?? 0)}</div></div>
                        <div className="metric-card"><div className="metric-title">Win probability</div><div className="metric-value green">{formatPercent(lottery.data?.winProbability ?? 0)}</div></div>
                      </div>
                      <div className="inline-actions">
                        <input className="input" value={lotteryAmount} onChange={(event) => setLotteryAmount(event.target.value)} />
                        <button className="btn btn-primary" disabled={actionBusy === 'lottery-deposit'} onClick={handleLotteryDeposit}>Deposit</button>
                        <button className="btn btn-ghost" disabled={actionBusy === 'lottery-draw'} onClick={handleLotteryDraw}>Draw now</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Lottery Activity</div></div>
                  <div className="card-body compact">
                    <div className="activity-list">
                      {mergedActivity.filter((item) => item.category === 'lottery').slice(0, 8).map((item, index) => (
                        <div className="activity-item" key={`${item.title}-${index}`}>
                          <div className="activity-copy">
                            <div className="activity-title">{item.title}</div>
                            <div className="activity-meta">{relativeTime(String(item.timestamp))}</div>
                          </div>
                          {item.explorerUrl ? <a className="link" href={String(item.explorerUrl)} target="_blank" rel="noreferrer">View tx</a> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'giftcards' ? (
              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><div className="card-title">Mint Yield Card</div></div>
                  <div className="card-body">
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="label">Recipient</span>
                        <input className="input" value={giftRecipient} onChange={(event) => setGiftRecipient(event.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="label">Principal</span>
                        <input className="input" value={giftAmount} onChange={(event) => setGiftAmount(event.target.value)} />
                      </label>
                      <label className="form-field full">
                        <span className="label">Message</span>
                        <textarea className="textarea" value={giftMessage} onChange={(event) => setGiftMessage(event.target.value)} />
                      </label>
                    </div>
                    <button className="btn btn-primary btn-block" disabled={actionBusy === 'gift-mint'} onClick={handleMintGiftCard}>Mint gift card</button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Gift Card Wallet</div><span className="badge purple">{giftCards.cards.length} cards</span></div>
                  <div className="card-body compact">
                    <div className="gift-grid">
                      {giftCards.cards.map((card) => (
                        <div className="gift-card" key={card.id}>
                          <div className="gift-copy">
                            <div className="gift-title">#{card.id} · {card.message}</div>
                            <div className="gift-meta">Principal {formatFlow(card.principalAmount)} · Total {formatFlow(card.totalValue)} · Recipient {shortAddress(card.recipient)}</div>
                          </div>
                          <button className="btn btn-ghost" disabled={actionBusy === `gift-${card.id}`} onClick={() => handleRedeemGiftCard(card.id)}>Redeem</button>
                        </div>
                      ))}
                      {!giftCards.cards.length ? <div className="empty-state">No gift cards found in the managed collection yet.</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'credential' ? (
              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><div className="card-title">Work Credential</div><span className="badge blue">Soul-bound</span></div>
                  <div className="card-body">
                    <div className="stats-grid">
                      <div className="metric-card"><div className="metric-title">Credit score</div><div className="metric-value green">{formatCompact(credential.data?.creditScore ?? 0)}</div></div>
                      <div className="metric-card"><div className="metric-title">Total earned</div><div className="metric-value blue">{formatFlow(credential.data?.totalEarned ?? 0)}</div></div>
                      <div className="metric-card"><div className="metric-title">Yield tracked</div><div className="metric-value amber">{formatFlow(credential.data?.totalYieldEarned ?? 0)}</div></div>
                      <div className="metric-card"><div className="metric-title">Duration</div><div className="metric-value purple">{formatCompact((credential.data?.durationSeconds ?? 0) / 86400)}d</div></div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Identity Snapshot</div></div>
                  <div className="card-body">
                    <div className="key-value-list">
                      <div className="key-value-row"><span>Role</span><span>{credential.data?.role ?? 'Autonomous operator'}</span></div>
                      <div className="key-value-row"><span>Employer</span><span className="mono">{shortAddress(credential.data?.employer ?? '')}</span></div>
                      <div className="key-value-row"><span>Worker</span><span className="mono">{shortAddress(credential.data?.workerAddress ?? '')}</span></div>
                      <div className="key-value-row"><span>Milestones</span><span>{credential.data?.milestonesCompleted ?? 0}</span></div>
                      <div className="key-value-row"><span>Disputes</span><span>{credential.data?.disputesRaised ?? 0}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {claimOpen ? (
        <div className="modal-backdrop" onClick={() => setClaimOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div className="card-title">Withdraw earnings</div><button className="btn btn-ghost" onClick={() => setClaimOpen(false)}>Close</button></div>
            <div className="modal-body">
              <label className="form-field">
                <span className="label">Amount</span>
                <input className="input" value={claimAmount} onChange={(event) => setClaimAmount(event.target.value)} />
              </label>
              <div className="empty-state">Managed signer mode is active. This will submit a sponsored testnet transaction from the seeded account.</div>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" disabled={actionBusy === 'claim'} onClick={handleClaim}>Submit claim</button></div>
          </div>
        </div>
      ) : null}

      {ruleOpen ? (
        <div className="modal-backdrop" onClick={() => setRuleOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div className="card-title">Add natural-language rule</div><button className="btn btn-ghost" onClick={() => setRuleOpen(false)}>Close</button></div>
            <div className="modal-body">
              <label className="form-field">
                <span className="label">Rule</span>
                <textarea className="textarea" value={ruleText} onChange={(event) => setRuleText(event.target.value)} />
              </label>
              {rulePreviewLoading ? <div className="empty-state">Compiling rule preview…</div> : null}
              {rulePreview && !rulePreviewLoading ? (
                <div className="feature-card">
                  <div className="metric-title">Preview</div>
                  <div className="metric-sub">{String(rulePreview.description ?? 'Ready to deploy')}</div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer"><button className="btn btn-primary" disabled={actionBusy === 'rule'} onClick={handleCreateRule}>Deploy rule</button></div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
  );
};

export default App;
