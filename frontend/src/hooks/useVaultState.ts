import { useState, useEffect, useCallback } from 'react';
import * as fcl from '@onflow/fcl';

export interface VaultState {
  streamId: string;
  salaryAccrued: number;
  yieldPrincipal: number;
  yieldEarned: number;
  tokenBalance: number;
  claimableTotal: number;
  yieldSplitRatio: number;
  milestoneDisputed: boolean;
  yieldLocked: boolean;
  lastRebalanceTimestamp: number;
  lastYieldHarvest: number;
  loading: boolean;
  error: string | null;
}

const GET_VAULT_STATE = `
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

access(all) fun main(accountAddress: Address, streamId: String): {String: AnyStruct} {
  let result: {String: AnyStruct} = {}

  let vaultCap = getAccount(accountAddress).capabilities.get<&FlowPilotVault.Vault>(
    PublicPath(identifier: "FlowPilotVault_".concat(streamId))!
  )

  if let vault = vaultCap.borrow() {
    result["salaryAccrued"] = vault.salaryAccrued
    result["yieldPrincipal"] = vault.yieldPrincipal
    result["yieldEarned"] = vault.yieldEarned
    result["tokenBalance"] = vault.getTokenBalance()
    result["claimableTotal"] = vault.getClaimableTotal()
    result["yieldSplitRatio"] = vault.yieldSplitRatio
  } else {
    result["salaryAccrued"] = 0.0
    result["yieldPrincipal"] = 0.0
    result["yieldEarned"] = 0.0
    result["tokenBalance"] = 0.0
    result["claimableTotal"] = 0.0
    result["yieldSplitRatio"] = 0.8
  }

  let stateCap = getAccount(accountAddress).capabilities.get<&VaultStateRegister.StateRegister>(
    PublicPath(identifier: "VaultState_".concat(streamId))!
  )

  if let state = stateCap.borrow() {
    result["milestoneDisputed"] = state.milestoneDisputed
    result["yieldLocked"] = state.yieldLocked
    result["lastRebalanceTimestamp"] = state.lastRebalanceTimestamp
    result["lastYieldHarvest"] = state.lastYieldHarvest
  } else {
    result["milestoneDisputed"] = false
    result["yieldLocked"] = false
    result["lastRebalanceTimestamp"] = 0.0
    result["lastYieldHarvest"] = 0.0
  }

  return result
}
`;

export function useVaultState(userAddress: string, streamId: string) {
  const [state, setState] = useState<VaultState>({
    streamId,
    salaryAccrued: 0,
    yieldPrincipal: 0,
    yieldEarned: 0,
    tokenBalance: 0,
    claimableTotal: 0,
    yieldSplitRatio: 0.8,
    milestoneDisputed: false,
    yieldLocked: false,
    lastRebalanceTimestamp: 0,
    lastYieldHarvest: 0,
    loading: true,
    error: null,
  });

  const fetchState = useCallback(async () => {
    if (!userAddress) return;

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await fcl.query({
        cadence: GET_VAULT_STATE,
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(userAddress, (t as Record<string, Function>)['Address']()),
          (arg as Function)(streamId, (t as Record<string, Function>)['String']()),
        ],
      });

      if (result) {
        setState({
          streamId,
          salaryAccrued: parseFloat(result.salaryAccrued ?? '0'),
          yieldPrincipal: parseFloat(result.yieldPrincipal ?? '0'),
          yieldEarned: parseFloat(result.yieldEarned ?? '0'),
          tokenBalance: parseFloat(result.tokenBalance ?? '0'),
          claimableTotal: parseFloat(result.claimableTotal ?? '0'),
          yieldSplitRatio: parseFloat(result.yieldSplitRatio ?? '0.8'),
          milestoneDisputed: result.milestoneDisputed ?? false,
          yieldLocked: result.yieldLocked ?? false,
          lastRebalanceTimestamp: parseFloat(result.lastRebalanceTimestamp ?? '0'),
          lastYieldHarvest: parseFloat(result.lastYieldHarvest ?? '0'),
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch vault state',
      }));
    }
  }, [userAddress, streamId]);

  useEffect(() => {
    fetchState();
    // Refresh every 10 seconds to sync with chain
    const interval = setInterval(fetchState, 10_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
