import { useCallback, useEffect, useState } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

export interface WorkCredentialView {
  streamId: string;
  employer: string;
  workerAddress: string;
  role: string;
  startTimestamp: number;
  totalEarned: number;
  totalYieldEarned: number;
  milestonesCompleted: number;
  disputesRaised: number;
  creditScore: number;
  averageAPY: number;
  durationSeconds: number;
}

const GET_WORK_CREDENTIAL = `
import WorkCredential from 0x0000000000000000

access(all) struct CredentialView {
  access(all) let streamId: String
  access(all) let employer: Address
  access(all) let workerAddress: Address
  access(all) let role: String
  access(all) let startTimestamp: UFix64
  access(all) let endTimestamp: UFix64?
  access(all) let totalEarned: UFix64
  access(all) let totalYieldEarned: UFix64
  access(all) let milestonesCompleted: UInt64
  access(all) let disputesRaised: UInt64
  access(all) let creditScore: UFix64
  access(all) let averageAPY: UFix64
  access(all) let durationSeconds: UFix64

  init(streamId: String, employer: Address, workerAddress: Address, role: String, startTimestamp: UFix64, endTimestamp: UFix64?, totalEarned: UFix64, totalYieldEarned: UFix64, milestonesCompleted: UInt64, disputesRaised: UInt64, creditScore: UFix64, averageAPY: UFix64, durationSeconds: UFix64) {
    self.streamId = streamId
    self.employer = employer
    self.workerAddress = workerAddress
    self.role = role
    self.startTimestamp = startTimestamp
    self.endTimestamp = endTimestamp
    self.totalEarned = totalEarned
    self.totalYieldEarned = totalYieldEarned
    self.milestonesCompleted = milestonesCompleted
    self.disputesRaised = disputesRaised
    self.creditScore = creditScore
    self.averageAPY = averageAPY
    self.durationSeconds = durationSeconds
  }
}

access(all) fun main(accountAddress: Address, streamId: String): CredentialView? {
  let account = getAccount(accountAddress)
  let credCap = account.capabilities.get<&WorkCredential.Credential>(
    PublicPath(identifier: "WorkCred_".concat(streamId))!
  )

  if let cred = credCap.borrow() {
    return CredentialView(
      streamId: cred.streamId,
      employer: cred.employer,
      workerAddress: cred.workerAddress,
      role: cred.role,
      startTimestamp: cred.startTimestamp,
      endTimestamp: cred.endTimestamp,
      totalEarned: cred.totalEarned,
      totalYieldEarned: cred.totalYieldEarned,
      milestonesCompleted: cred.milestonesCompleted,
      disputesRaised: cred.disputesRaised,
      creditScore: cred.creditScore(),
      averageAPY: cred.yieldProfile.averageAPY,
      durationSeconds: cred.getDurationSeconds()
    )
  }

  return nil
}
`;

export function useWorkCredential(accountAddress: string, streamId: string) {
  const [state, setState] = useState<{
    data: WorkCredentialView | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  const fetchState = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(accountAddress);
    if (!normalizedAddress || !streamId) {
      return;
    }

    try {
      const result = await fcl.query({
        cadence: withCadenceImports(GET_WORK_CREDENTIAL),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
          (arg as Function)(streamId, (t as Record<string, Function>).String),
        ],
      });

      setState({
        data: result
          ? {
              streamId: result.streamId,
              employer: result.employer,
              workerAddress: result.workerAddress,
              role: result.role,
              startTimestamp: parseFloat(result.startTimestamp ?? '0'),
              totalEarned: parseFloat(result.totalEarned ?? '0'),
              totalYieldEarned: parseFloat(result.totalYieldEarned ?? '0'),
              milestonesCompleted: Number(result.milestonesCompleted ?? 0),
              disputesRaised: Number(result.disputesRaised ?? 0),
              creditScore: parseFloat(result.creditScore ?? '0'),
              averageAPY: parseFloat(result.averageAPY ?? '0'),
              durationSeconds: parseFloat(result.durationSeconds ?? '0'),
            }
          : null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load credential',
      });
    }
  }, [accountAddress, streamId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
