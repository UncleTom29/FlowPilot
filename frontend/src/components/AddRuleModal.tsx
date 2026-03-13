import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRules } from '../hooks/useRules';

interface AddRuleModalProps {
  userAddress: string;
  streamId: string;
  onClose: () => void;
  onRuleAdded: () => void;
}

interface ParsePreview {
  success: boolean;
  description?: string;
  rule?: Record<string, unknown>;
  error?: { message: string; suggestion?: string };
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

const EXAMPLE_RULES = [
  'save 20% of every paycheck',
  'buy $50 FLOW every Friday',
  'pay $1200 to landlord.flow on the 1st',
  'round up every withdrawal to nearest $1',
  'keep portfolio 60% FLOW, 40% USDC, rebalance weekly',
  'enter $100 into the daily lottery',
];

const AddRuleModal: React.FC<AddRuleModalProps> = ({
  userAddress,
  streamId,
  onClose,
  onRuleAdded,
}) => {
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { createRule } = useRules(userAddress, streamId);

  // Debounced preview fetch as user types
  const fetchPreview = useCallback(async (text: string) => {
    if (!text.trim() || text.length < 5) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/parse-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(inputText), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, fetchPreview]);

  const handleConfirm = async () => {
    if (!preview?.success || !inputText.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createRule(inputText);
      if (result.success) {
        onRuleAdded();
        onClose();
      } else {
        setCreateError(result.error?.message ?? 'Failed to create rule');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Add a Financial Rule</h2>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <p style={styles.subtitle}>
          Describe your rule in plain English. FlowPilot will compile and automate it.
        </p>

        {/* Text input */}
        <textarea
          style={styles.input}
          placeholder='e.g. "save 20% of every paycheck" or "buy $50 FLOW every Friday"'
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={3}
          autoFocus
        />

        {/* Live preview */}
        <div style={styles.previewContainer}>
          {previewLoading && (
            <div style={styles.previewLoading}>Analyzing rule...</div>
          )}
          {!previewLoading && preview?.success && preview.description && (
            <div style={styles.previewSuccess}>
              <span style={styles.previewCheckmark}>✓</span>
              <span>I understood: <strong>{preview.description}</strong></span>
            </div>
          )}
          {!previewLoading && preview && !preview.success && (
            <div style={styles.previewError}>
              <span>⚠ {preview.error?.message}</span>
              {preview.error?.suggestion && (
                <button
                  style={styles.suggestionButton}
                  onClick={() => setInputText(preview.error!.suggestion!)}
                >
                  Try: "{preview.error.suggestion}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* Example rules */}
        <div style={styles.examples}>
          <p style={styles.examplesLabel}>Examples:</p>
          <div style={styles.exampleTags}>
            {EXAMPLE_RULES.map((example) => (
              <button
                key={example}
                style={styles.exampleTag}
                onClick={() => setInputText(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {createError && (
          <div style={styles.createError}>{createError}</div>
        )}

        {/* Action buttons */}
        <div style={styles.modalFooter}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...styles.confirmButton,
              opacity: !preview?.success || creating ? 0.5 : 1,
            }}
            onClick={handleConfirm}
            disabled={!preview?.success || creating}
          >
            {creating ? 'Creating...' : '✓ Confirm & Deploy Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#1a1f2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  subtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: '16px',
    color: '#fff',
    fontSize: 15,
    fontFamily: 'inherit',
    resize: 'none' as const,
    outline: 'none',
    lineHeight: 1.6,
  },
  previewContainer: {
    minHeight: 48,
  },
  previewLoading: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  previewSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#00ef8b',
    background: 'rgba(0,239,139,0.08)',
    border: '1px solid rgba(0,239,139,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
  },
  previewCheckmark: {
    fontSize: 16,
    fontWeight: 700,
  },
  previewError: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 14,
    color: '#ff6b6b',
    background: 'rgba(255,107,107,0.08)',
    border: '1px solid rgba(255,107,107,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
  },
  suggestionButton: {
    background: 'rgba(255,107,107,0.15)',
    border: '1px solid rgba(255,107,107,0.3)',
    borderRadius: 6,
    padding: '4px 10px',
    color: '#ff9e9e',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left' as const,
  },
  examples: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  examplesLabel: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exampleTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  exampleTag: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '4px 10px',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    fontSize: 12,
    transition: 'all 0.2s',
  },
  createError: {
    fontSize: 14,
    color: '#ff6b6b',
    background: 'rgba(255,107,107,0.08)',
    borderRadius: 8,
    padding: '10px 14px',
  },
  modalFooter: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  cancelButton: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
  },
  confirmButton: {
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
};

export default AddRuleModal;
