import { useCallback, useEffect, useState } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

export interface LotteryPoolView {
  poolId: string;
  totalPrincipal: number;
  yieldAccumulated: number;
  totalTickets: number;
  poolBalance: number;
  drawCount: number;
  participantCount: number;
  userPrincipal: number;
  userTickets: number;
  winProbability: number;
}

const GET_LOTTERY_POOL = `
import LotteryPool from 0x0000000000000000

access(all) struct PoolView {
  access(all) let poolId: String
  access(all) let totalPrincipal: UFix64
  access(all) let yieldAccumulated: UFix64
  access(all) let totalTickets: UFix64
  access(all) let poolBalance: UFix64
  access(all) let drawCount: UInt64
  access(all) let participantCount: Int
  access(all) let userPrincipal: UFix64
  access(all) let userTickets: UFix64
  access(all) let winProbability: UFix64

  init(
    poolId: String,
    totalPrincipal: UFix64,
    yieldAccumulated: UFix64,
    totalTickets: UFix64,
    poolBalance: UFix64,
    drawCount: UInt64,
    participantCount: Int,
    userPrincipal: UFix64,
    userTickets: UFix64,
    winProbability: UFix64
  ) {
    self.poolId = poolId
    self.totalPrincipal = totalPrincipal
    self.yieldAccumulated = yieldAccumulated
    self.totalTickets = totalTickets
    self.poolBalance = poolBalance
    self.drawCount = drawCount
    self.participantCount = participantCount
    self.userPrincipal = userPrincipal
    self.userTickets = userTickets
    self.winProbability = winProbability
  }
}

access(all) fun main(accountAddress: Address, poolId: String, viewerAddress: Address): PoolView? {
  let account = getAccount(accountAddress)
  let poolCap = account.capabilities.get<&LotteryPool.Pool>(
    PublicPath(identifier: "LotteryPool_".concat(poolId))!
  )

  if let pool = poolCap.borrow() {
    let userPrincipal = pool.principalDeposits[viewerAddress] ?? 0.0
    let userTickets = pool.ticketWeights[viewerAddress] ?? 0.0
    var winProbability = 0.0
    if pool.totalTickets > 0.0 {
      winProbability = (userTickets / pool.totalTickets) * 100.0
    }

    return PoolView(
      poolId: poolId,
      totalPrincipal: pool.totalPrincipal(),
      yieldAccumulated: pool.yieldAccumulated,
      totalTickets: pool.totalTickets,
      poolBalance: pool.getPoolBalance(),
      drawCount: pool.drawCount,
      participantCount: pool.principalDeposits.length,
      userPrincipal: userPrincipal,
      userTickets: userTickets,
      winProbability: winProbability
    )
  }

  return nil
}
`;

export function useLotteryPool(accountAddress: string, poolId: string) {
  const [state, setState] = useState<{
    data: LotteryPoolView | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  const fetchState = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(accountAddress);
    if (!normalizedAddress || !poolId) {
      return;
    }

    try {
      const result = await fcl.query({
        cadence: withCadenceImports(GET_LOTTERY_POOL),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
          (arg as Function)(poolId, (t as Record<string, Function>).String),
          (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
        ],
      });

      setState({
        data: result
          ? {
              poolId: result.poolId,
              totalPrincipal: parseFloat(result.totalPrincipal ?? '0'),
              yieldAccumulated: parseFloat(result.yieldAccumulated ?? '0'),
              totalTickets: parseFloat(result.totalTickets ?? '0'),
              poolBalance: parseFloat(result.poolBalance ?? '0'),
              drawCount: Number(result.drawCount ?? 0),
              participantCount: Number(result.participantCount ?? 0),
              userPrincipal: parseFloat(result.userPrincipal ?? '0'),
              userTickets: parseFloat(result.userTickets ?? '0'),
              winProbability: parseFloat(result.winProbability ?? '0'),
            }
          : null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load lottery pool',
      });
    }
  }, [accountAddress, poolId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
