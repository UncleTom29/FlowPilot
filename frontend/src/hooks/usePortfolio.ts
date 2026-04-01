import { useCallback, useEffect, useState } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

export interface PortfolioView {
  portfolioId: string;
  riskProfile: string;
  allocations: Record<string, string>;
  holdings: Record<string, string>;
  lastRebalanceTimestamp: number;
  totalRebalances: number;
}

const GET_PORTFOLIO = `
import PortfolioVault from 0x0000000000000000

access(all) struct PortfolioView {
  access(all) let portfolioId: String
  access(all) let riskProfile: String
  access(all) let allocations: {String: UFix64}
  access(all) let holdings: {String: UFix64}
  access(all) let lastRebalanceTimestamp: UFix64
  access(all) let totalRebalances: UInt64

  init(portfolioId: String, riskProfile: String, allocations: {String: UFix64}, holdings: {String: UFix64}, lastRebalanceTimestamp: UFix64, totalRebalances: UInt64) {
    self.portfolioId = portfolioId
    self.riskProfile = riskProfile
    self.allocations = allocations
    self.holdings = holdings
    self.lastRebalanceTimestamp = lastRebalanceTimestamp
    self.totalRebalances = totalRebalances
  }
}

access(all) fun main(accountAddress: Address, portfolioId: String): PortfolioView? {
  let account = getAccount(accountAddress)
  let portfolioCap = account.capabilities.get<&PortfolioVault.Portfolio>(
    PublicPath(identifier: "Portfolio_".concat(portfolioId))!
  )

  if let portfolio = portfolioCap.borrow() {
    var allocations: {String: UFix64} = {}
    for asset in portfolio.allocations.keys {
      allocations[asset] = portfolio.allocations[asset]!
    }

    var holdings: {String: UFix64} = {}
    for asset in portfolio.holdings.keys {
      holdings[asset] = portfolio.holdings[asset]!
    }

    return PortfolioView(
      portfolioId: portfolio.portfolioId,
      riskProfile: portfolio.riskProfile,
      allocations: allocations,
      holdings: holdings,
      lastRebalanceTimestamp: portfolio.lastRebalanceTimestamp,
      totalRebalances: portfolio.totalRebalances
    )
  }

  return nil
}
`;

export function usePortfolio(accountAddress: string, portfolioId: string) {
  const [state, setState] = useState<{
    data: PortfolioView | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  const fetchState = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(accountAddress);
    if (!normalizedAddress || !portfolioId) {
      return;
    }

    try {
      const result = await fcl.query({
        cadence: withCadenceImports(GET_PORTFOLIO),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
          (arg as Function)(portfolioId, (t as Record<string, Function>).String),
        ],
      });

      setState({
        data: result
          ? {
              portfolioId: result.portfolioId,
              riskProfile: result.riskProfile,
              allocations: result.allocations ?? {},
              holdings: result.holdings ?? {},
              lastRebalanceTimestamp: parseFloat(result.lastRebalanceTimestamp ?? '0'),
              totalRebalances: Number(result.totalRebalances ?? 0),
            }
          : null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load portfolio',
      });
    }
  }, [accountAddress, portfolioId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
