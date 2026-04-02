import { useCallback, useEffect, useState } from 'react';
import {
  DEPLOYMENT_SNAPSHOT_STATE,
  type DeploymentSource,
  type DeploymentState,
} from '../lib/deploymentState';
import { getApiUrl, hasConfiguredBackend } from '../lib/runtimeConfig';

type HookState = {
  data: DeploymentState | null;
  loading: boolean;
  error: string | null;
  source: DeploymentSource | null;
  relayAvailable: boolean;
  backendError: string | null;
};

function createSnapshotData(): DeploymentState | null {
  if (!DEPLOYMENT_SNAPSHOT_STATE.ready) {
    return null;
  }

  return {
    ...DEPLOYMENT_SNAPSHOT_STATE,
    cadence: DEPLOYMENT_SNAPSHOT_STATE.cadence
      ? {
          accountAddress: DEPLOYMENT_SNAPSHOT_STATE.cadence.accountAddress,
          contractAddress: DEPLOYMENT_SNAPSHOT_STATE.cadence.contractAddress,
          streamId: DEPLOYMENT_SNAPSHOT_STATE.cadence.streamId,
          poolId: DEPLOYMENT_SNAPSHOT_STATE.cadence.poolId,
          portfolioId: DEPLOYMENT_SNAPSHOT_STATE.cadence.portfolioId,
          subscriptionId: DEPLOYMENT_SNAPSHOT_STATE.cadence.subscriptionId,
          verificationSummary: DEPLOYMENT_SNAPSHOT_STATE.cadence.verificationSummary ?? {},
        }
      : null,
    evm: DEPLOYMENT_SNAPSHOT_STATE.evm
      ? {
          contracts: DEPLOYMENT_SNAPSHOT_STATE.evm.contracts ?? {},
        }
      : null,
    relayReady: false,
  };
}

function createSnapshotState(backendError: string | null = null): HookState {
  return {
    data: createSnapshotData(),
    loading: false,
    error: DEPLOYMENT_SNAPSHOT_STATE.ready ? null : backendError,
    source: DEPLOYMENT_SNAPSHOT_STATE.ready ? 'snapshot' : null,
    relayAvailable: false,
    backendError,
  };
}

export function useDeploymentState() {
  const [state, setState] = useState<HookState>(() =>
    hasConfiguredBackend() ? {
      data: null,
      loading: true,
      error: null,
      source: null,
      relayAvailable: false,
      backendError: null,
    } : createSnapshotState()
  );

  const fetchState = useCallback(async () => {
    if (!hasConfiguredBackend()) {
      setState(createSnapshotState());
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/deployment-state'));
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to load deployment state');
      }

      setState({
        data: payload.state as DeploymentState,
        loading: false,
        error: null,
        source: 'backend',
        relayAvailable: Boolean((payload.state as DeploymentState).relayReady ?? true),
        backendError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load deployment state';
      setState((current) => {
        if (current.data && current.source === 'backend') {
          return {
            ...current,
            loading: false,
            relayAvailable: false,
            backendError: message,
          };
        }

        return createSnapshotState(message);
      });
    }
  }, []);

  useEffect(() => {
    fetchState();

    if (!hasConfiguredBackend()) {
      return undefined;
    }

    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return {
    ...state,
    refetch: fetchState,
  };
}
