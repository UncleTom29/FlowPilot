import React, { useState } from 'react';
import { formatAddress, formatRelativeTime } from '../utils/formatBalance';

interface GiftCard {
  id: number;
  recipient: string;
  message: string;
  principalAmount: number;
  accruedYield: number;
  targetDate: number | null;
  sender: string;
  redeemed: boolean;
}

interface GiftCardWalletProps {
  userAddress: string;
}

// Mock gift cards for display
const MOCK_CARDS: GiftCard[] = [
  {
    id: 0,
    recipient: '0xfriend1234',
    message: '🎂 Happy Birthday! Your first step into DeFi.',
    principalAmount: 100.0,
    accruedYield: 2.47,
    targetDate: Date.now() / 1000 + 86400 * 7,
    sender: '0xself',
    redeemed: false,
  },
  {
    id: 1,
    recipient: '0xfamily5678',
    message: '🎄 Happy Holidays! This card keeps earning.',
    principalAmount: 250.0,
    accruedYield: 8.12,
    targetDate: null,
    sender: '0xself',
    redeemed: false,
  },
];

const GiftCardWallet: React.FC<GiftCardWalletProps> = ({ userAddress }) => {
  const [cards, setCards] = useState<GiftCard[]>(MOCK_CARDS);
  const [showMintForm, setShowMintForm] = useState(false);
  const [mintForm, setMintForm] = useState({
    recipient: '',
    amount: '',
    message: '',
    unlockDate: '',
  });
  const [minting, setMinting] = useState(false);

  const handleMint = async () => {
    const amount = parseFloat(mintForm.amount);
    if (!mintForm.recipient || isNaN(amount) || amount <= 0 || minting) return;

    setMinting(true);
    try {
      // In production: call MintGiftCard.cdc via FCL
      const newCard: GiftCard = {
        id: cards.length,
        recipient: mintForm.recipient,
        message: mintForm.message || '🎁 A gift for you!',
        principalAmount: amount,
        accruedYield: 0,
        targetDate: mintForm.unlockDate
          ? new Date(mintForm.unlockDate).getTime() / 1000
          : null,
        sender: userAddress,
        redeemed: false,
      };
      setCards((prev) => [...prev, newCard]);
      setMintForm({ recipient: '', amount: '', message: '', unlockDate: '' });
      setShowMintForm(false);
    } catch (err) {
      console.error('Mint failed:', err);
    } finally {
      setMinting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🎁 Gift Card Wallet</h2>
          <p style={styles.subtitle}>
            Yield-bearing NFT gift cards. The money keeps growing until redeemed.
          </p>
        </div>
        <button
          style={styles.mintButton}
          onClick={() => setShowMintForm(!showMintForm)}
        >
          + Send Gift Card
        </button>
      </div>

      {/* Mint form */}
      {showMintForm && (
        <div style={styles.mintForm}>
          <h3 style={styles.mintTitle}>Send a New Gift Card</h3>
          <div style={styles.formGrid}>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Recipient Address</label>
              <input
                style={styles.formInput}
                placeholder="0x... or name.flow"
                value={mintForm.recipient}
                onChange={(e) => setMintForm((p) => ({ ...p, recipient: e.target.value }))}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Amount (FLOW)</label>
              <input
                style={styles.formInput}
                type="number"
                placeholder="100"
                min="1"
                value={mintForm.amount}
                onChange={(e) => setMintForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div style={{ ...styles.formField, gridColumn: 'span 2' as const }}>
              <label style={styles.formLabel}>Message</label>
              <input
                style={styles.formInput}
                placeholder="Happy Birthday! 🎉"
                value={mintForm.message}
                onChange={(e) => setMintForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Unlock Date (optional)</label>
              <input
                style={styles.formInput}
                type="date"
                value={mintForm.unlockDate}
                onChange={(e) => setMintForm((p) => ({ ...p, unlockDate: e.target.value }))}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button
              style={styles.cancelMintButton}
              onClick={() => setShowMintForm(false)}
            >
              Cancel
            </button>
            <button
              style={{ ...styles.confirmMintButton, opacity: minting ? 0.5 : 1 }}
              onClick={handleMint}
              disabled={minting}
            >
              {minting ? 'Minting...' : '✨ Mint Gift Card NFT'}
            </button>
          </div>
        </div>
      )}

      {/* Gift card grid */}
      {cards.length === 0 ? (
        <div style={styles.empty}>
          <p>No gift cards yet. Send your first yield-bearing gift!</p>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {cards.map((card) => (
            <div key={card.id} style={styles.card}>
              {/* Card header */}
              <div style={styles.cardHeader}>
                <span style={styles.cardId}>Gift Card #{card.id}</span>
                <span
                  style={{
                    ...styles.cardStatus,
                    color: card.redeemed ? '#888' : '#00ef8b',
                  }}
                >
                  {card.redeemed ? '✓ Redeemed' : '● Active'}
                </span>
              </div>

              {/* Message */}
              <p style={styles.cardMessage}>{card.message}</p>

              {/* Value display */}
              <div style={styles.valueRow}>
                <div style={styles.valueItem}>
                  <span style={styles.valueLabel}>Principal</span>
                  <span style={styles.valuePrincipal}>
                    {card.principalAmount.toFixed(2)} FLOW
                  </span>
                </div>
                <div style={styles.valueDivider}>+</div>
                <div style={styles.valueItem}>
                  <span style={styles.valueLabel}>Yield Earned</span>
                  <span style={{ ...styles.valuePrincipal, color: '#00ef8b' }}>
                    {card.accruedYield.toFixed(4)} FLOW
                  </span>
                </div>
                <div style={styles.valueDivider}>=</div>
                <div style={styles.valueItem}>
                  <span style={styles.valueLabel}>Total Value</span>
                  <span style={{ ...styles.valuePrincipal, color: '#f7b731' }}>
                    {(card.principalAmount + card.accruedYield).toFixed(4)} FLOW
                  </span>
                </div>
              </div>

              {/* Recipient + maturity */}
              <div style={styles.cardMeta}>
                <span>To: {formatAddress(card.recipient)}</span>
                {card.targetDate && (
                  <span>
                    🔓 {card.targetDate > Date.now() / 1000
                      ? `Unlocks ${formatRelativeTime(card.targetDate)}`
                      : 'Ready to redeem'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 24 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  title: { margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' },
  subtitle: { margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 },
  mintButton: {
    background: '#00ef8b',
    border: 'none',
    borderRadius: 12,
    padding: '12px 24px',
    color: '#000',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  mintForm: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  mintTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  formField: { display: 'flex', flexDirection: 'column', gap: 6 },
  formLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  formInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  formActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelMintButton: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
  },
  confirmMintButton: {
    background: '#00ef8b',
    border: 'none',
    borderRadius: 10,
    padding: '10px 24px',
    color: '#000',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 14,
    transition: 'opacity 0.2s',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '48px 0',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'linear-gradient(135deg, rgba(0,239,139,0.06) 0%, rgba(91,141,238,0.06) 100%)',
    border: '1px solid rgba(0,239,139,0.15)',
    borderRadius: 16,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' },
  cardStatus: { fontSize: 12, fontWeight: 600 },
  cardMessage: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  valueItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  valueLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  valuePrincipal: { fontSize: 16, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' },
  valueDivider: { fontSize: 18, color: 'rgba(255,255,255,0.3)' },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
};

export default GiftCardWallet;
