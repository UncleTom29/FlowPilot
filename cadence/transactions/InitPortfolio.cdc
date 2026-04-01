// InitPortfolio.cdc
// Initializes an AI-managed portfolio vault with risk profile and initial allocations.

import PortfolioVault from 0x0000000000000000

transaction(
    portfolioId: String,
    riskProfile: String,
    assetAllocations: {String: UFix64}
) {
    prepare(user: auth(Storage, Capabilities) &Account) {
        let storagePath = StoragePath(identifier: "Portfolio_".concat(portfolioId))!

        assert(
            user.storage.borrow<&PortfolioVault.Portfolio>(from: storagePath) == nil,
            message: "Portfolio already exists"
        )

        // Validate allocation sum
        var total = 0.0
        for pct in assetAllocations.values {
            total = total + pct
        }
        assert(total <= 100.0 + 0.000001, message: "Allocations must sum to 100% or less")

        // Create portfolio
        let portfolio <- PortfolioVault.createPortfolio(
            portfolioId: portfolioId,
            owner: user.address,
            riskProfile: riskProfile
        )

        // Set allocations
        for asset in assetAllocations.keys {
            portfolio.setAllocation(asset: asset, percentage: assetAllocations[asset]!)
        }

        user.storage.save(<- portfolio, to: storagePath)
        let publicPath = PublicPath(identifier: "Portfolio_".concat(portfolioId))!
        user.capabilities.publish(
            user.capabilities.storage.issue<&PortfolioVault.Portfolio>(storagePath),
            at: publicPath
        )

        // Register AIRebalanceHandler with FlowTransactionScheduler
        // Interval depends on risk profile:
        //   conservative: 7 days, moderate: 1 day, aggressive: 6 hours
        // FlowTransactionScheduler.schedule(handler: AIRebalanceHandler, delay: interval)

        log("Portfolio initialized: ".concat(portfolioId))
        log("Risk profile: ".concat(riskProfile))
    }
}
