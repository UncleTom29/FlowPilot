import { useCallback, useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

export interface ActivityItem {
  title: string;
  category: string;
  txId?: string | null;
  explorerUrl?: string | null;
  timestamp: string;
  [key: string]: unknown;
}

export interface DeploymentState {
  cadence: {
    accountAddress: string;
    contractAddress: string;
    streamId: string;
    poolId?: string;
    portfolioId?: string;
    subscriptionId?: string;
    activity?: ActivityItem[];
    surfacedFeatures?: Record<string, boolean>;
    verification?: Record<string, unknown>;
  } | null;
  evm: {
    seedData?: Record<string, unknown>;
    contracts?: Record<string, string>;
  } | null;
  signer: string;
  ready: boolean;
}

export function useDeploymentState() {
  const [state, setState] = useState<{
    data: DeploymentState | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/deployment-state`);
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error ?? 'Failed to load deployment state');
      }
      setState({ data: payload.state as DeploymentState, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load deployment state',
      });
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return {
    ...state,
    refetch: fetchState,
  };
}
