import React, { useState, useEffect } from 'react';
import * as fcl from '@onflow/fcl';
import BalanceDashboard from './components/BalanceDashboard';
import LotteryWidget from './components/LotteryWidget';
import GiftCardWallet from './components/GiftCardWallet';
import WorkCredentialCard from './components/WorkCredentialCard';

interface User {
  addr: string | null;
  loggedIn: boolean;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User>({ addr: null, loggedIn: false });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lottery' | 'giftcards' | 'credential'>(
    'dashboard'
  );

  useEffect(() => {
    const unsub = fcl.currentUser.subscribe(setUser);
    return () => unsub();
  }, []);

  const handleLogin = () => fcl.authenticate();
  const handleLogout = () => fcl.unauthenticate();

  if (!user.loggedIn) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.logo}>⚡ FlowPilot</h1>
          <p style={styles.tagline}>
            Set financial rules in plain English.<br />
            FlowPilot executes everything automatically.
          </p>
          <ul style={styles.featureList}>
            <li>💸 Per-second payroll streaming</li>
            <li>📈 Automatic yield optimization</li>
            <li>🔄 DCA investing &amp; auto-save</li>
            <li>🎰 Lossless daily lottery</li>
            <li>🎁 Yield-backed gift cards</li>
            <li>⛽ Zero gas fees, ever</li>
          </ul>
          <button style={styles.loginButton} onClick={handleLogin}>
            Sign in with Email or Passkey
          </button>
          <p style={styles.disclaimer}>Powered by Flow blockchain · No seed phrases required</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.header}>
        <span style={styles.logo}>⚡ FlowPilot</span>
        <nav style={styles.nav}>
          {(['dashboard', 'lottery', 'giftcards', 'credential'] as const).map((tab) => (
            <button
              key={tab}
              style={{
                ...styles.navButton,
                ...(activeTab === tab ? styles.navButtonActive : {}),
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'dashboard' && '🏠 Dashboard'}
              {tab === 'lottery' && '🎰 Lottery'}
              {tab === 'giftcards' && '🎁 Gift Cards'}
              {tab === 'credential' && '🪪 Credential'}
            </button>
          ))}
        </nav>
        <div style={styles.userInfo}>
          <span style={styles.address}>
            {user.addr?.slice(0, 6)}...{user.addr?.slice(-4)}
          </span>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {activeTab === 'dashboard' && (
          <BalanceDashboard userAddress={user.addr ?? ''} streamId="default" />
        )}
        {activeTab === 'lottery' && (
          <LotteryWidget userAddress={user.addr ?? ''} />
        )}
        {activeTab === 'giftcards' && (
          <GiftCardWallet userAddress={user.addr ?? ''} />
        )}
        {activeTab === 'credential' && (
          <WorkCredentialCard userAddress={user.addr ?? ''} streamId="default" />
        )}
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loginContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loginCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: '48px 56px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    color: '#fff',
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: '#00ef8b',
    margin: '0 0 8px',
    letterSpacing: -0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 32px',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 2,
  },
  loginButton: {
    background: '#00ef8b',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    marginBottom: 12,
    transition: 'opacity 0.2s',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    margin: 0,
  },
  appContainer: {
    minHeight: '100vh',
    background: '#0d1117',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(12px)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  nav: {
    display: 'flex',
    gap: 8,
  },
  navButton: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 16px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.2s',
  },
  navButtonActive: {
    background: 'rgba(0,239,139,0.15)',
    borderColor: '#00ef8b',
    color: '#00ef8b',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  address: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'monospace',
  },
  logoutButton: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '6px 14px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 13,
  },
  main: {
    padding: '32px',
    maxWidth: 1200,
    margin: '0 auto',
  },
};

export default App;
