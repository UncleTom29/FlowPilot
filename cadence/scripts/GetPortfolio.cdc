// GetPortfolio.cdc
// Returns a public view of a managed portfolio.

import PortfolioVault from 0x0000000000000000

access(all) struct PortfolioView {
    access(all) let portfolioId: String
    access(all) let riskProfile: String
    access(all) let allocations: {String: UFix64}
    access(all) let holdings: {String: UFix64}
    access(all) let lastRebalanceTimestamp: UFix64
    access(all) let totalRebalances: UInt64

    init(
        portfolioId: String,
        riskProfile: String,
        allocations: {String: UFix64},
        holdings: {String: UFix64},
        lastRebalanceTimestamp: UFix64,
        totalRebalances: UInt64
    ) {
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