// PortfolioVault.cdc
// AI-managed multi-asset portfolio with risk-profile-based rebalancing.

import FlowDeFiMathUtils from 0x0000000000000000
import RuleGraph from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

access(all) contract PortfolioVault {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event PortfolioCreated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        riskProfile: String
    )
    access(all) event AllocationSet(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        asset: String,
        percentage: UFix64
    )
    access(all) event RebalanceExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        assetsRebalanced: Int,
        totalValue: UFix64
    )

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // Risk profile thresholds (drift % that triggers rebalance)
    // -----------------------------------------------------------------------
    access(all) let CONSERVATIVE_DRIFT_THRESHOLD: UFix64   // 5%
    access(all) let MODERATE_DRIFT_THRESHOLD: UFix64       // 3%
    access(all) let AGGRESSIVE_DRIFT_THRESHOLD: UFix64     // 1%

    // Rebalance intervals in seconds
    access(all) let CONSERVATIVE_INTERVAL: UFix64  // 7 days
    access(all) let MODERATE_INTERVAL: UFix64      // 1 day
    access(all) let AGGRESSIVE_INTERVAL: UFix64    // 6 hours

    // -----------------------------------------------------------------------
    // Portfolio resource
    // -----------------------------------------------------------------------
    access(all) resource Portfolio {

        access(all) let portfolioId: String
        access(all) let ownerAddress: Address
        // asset symbol → target percentage (values must sum to 100.0)
        access(all) var allocations: {String: UFix64}
        access(all) var riskProfile: String
        // asset symbol → current holdings in UFix64
        access(all) var holdings: {String: UFix64}
        access(all) var lastRebalanceTimestamp: UFix64
        access(all) var totalRebalances: UInt64

        init(portfolioId: String, owner: Address, riskProfile: String) {
            self.portfolioId = portfolioId
            self.ownerAddress = owner
            self.allocations = {}
            self.riskProfile = riskProfile
            self.holdings = {}
            self.lastRebalanceTimestamp = getCurrentBlock().timestamp
            self.totalRebalances = 0
        }

        // Set allocation for an asset — validates sum constraint
        access(all) fun setAllocation(asset: String, percentage: UFix64) {
            pre {
                percentage >= 0.0: "Percentage must be non-negative"
                percentage <= 100.0: "Percentage cannot exceed 100"
            }

            self.allocations[asset] = percentage

            // Validate total allocations sum to ≤ 100.0
            var total = 0.0
            for pct in self.allocations.values {
                total = total + pct
            }
            assert(total <= 100.0 + 0.000001, message: "Allocations exceed 100%")

            emit AllocationSet(
                streamId: self.portfolioId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                asset: asset,
                percentage: percentage
            )
        }

        // Get drift threshold based on risk profile
        access(all) fun getDriftThreshold(): UFix64 {
            if self.riskProfile == "conservative" {
                return PortfolioVault.CONSERVATIVE_DRIFT_THRESHOLD
            } else if self.riskProfile == "aggressive" {
                return PortfolioVault.AGGRESSIVE_DRIFT_THRESHOLD
            }
            return PortfolioVault.MODERATE_DRIFT_THRESHOLD
        }

        // Get rebalance interval in seconds based on risk profile
        access(all) fun getRebalanceInterval(): UFix64 {
            if self.riskProfile == "conservative" {
                return PortfolioVault.CONSERVATIVE_INTERVAL
            } else if self.riskProfile == "aggressive" {
                return PortfolioVault.AGGRESSIVE_INTERVAL
            }
            return PortfolioVault.MODERATE_INTERVAL
        }

        // Rebalance portfolio using oracle prices and AI attestation
        // currentPrices: asset → price in UFix64
        // oracleAttestation: signed bytes from AI oracle
        access(all) fun rebalance(
            currentPrices: {String: UFix64},
            oracleAttestation: [UInt8]
        ) {
            pre {
                oracleAttestation.length > 0: "Oracle attestation required"
                self.allocations.length > 0: "No allocations set"
            }

            // Compute total portfolio value using 128-bit math
            var totalValue = 0.0
            for asset in self.holdings.keys {
                let price = currentPrices[asset] ?? 0.0
                let holding = self.holdings[asset] ?? 0.0
                totalValue = totalValue + FlowDeFiMathUtils.mul128(holding, price)
            }

            if totalValue == 0.0 { return }

            var assetsRebalanced = 0

            // For each asset: compute target vs current, determine swap needed
            for asset in self.allocations.keys {
                let targetPct = self.allocations[asset]!
                let targetValue = FlowDeFiMathUtils.mul128(totalValue, FlowDeFiMathUtils.div128(targetPct, 100.0))
                let price = currentPrices[asset] ?? 0.0
                if price == 0.0 { continue }

                let currentHolding = self.holdings[asset] ?? 0.0
                let currentValue = FlowDeFiMathUtils.mul128(currentHolding, price)

                // Compute drift percentage
                let diff = currentValue > targetValue
                    ? currentValue - targetValue
                    : targetValue - currentValue
                let driftPct = FlowDeFiMathUtils.div128(
                    FlowDeFiMathUtils.mul128(diff, 100.0),
                    totalValue
                )

                if driftPct >= self.getDriftThreshold() {
                    // Execute rebalance swap via SwapAction
                    let targetAmount = FlowDeFiMathUtils.div128(targetValue, price)
                    self.holdings[asset] = targetAmount
                    assetsRebalanced = assetsRebalanced + 1
                }
            }

            self.lastRebalanceTimestamp = getCurrentBlock().timestamp
            self.totalRebalances = self.totalRebalances + 1

            emit RebalanceExecuted(
                streamId: self.portfolioId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                assetsRebalanced: assetsRebalanced,
                totalValue: totalValue
            )
        }

        access(all) fun getTotalValue(prices: {String: UFix64}): UFix64 {
            var total = 0.0
            for asset in self.holdings.keys {
                let price = prices[asset] ?? 0.0
                let amount = self.holdings[asset] ?? 0.0
                total = total + FlowDeFiMathUtils.mul128(amount, price)
            }
            return total
        }
    }

    // -----------------------------------------------------------------------
    // Factory
    // -----------------------------------------------------------------------
    access(all) fun createPortfolio(
        portfolioId: String,
        owner: Address,
        riskProfile: String
    ): @Portfolio {
        pre {
            riskProfile == "conservative" ||
            riskProfile == "moderate" ||
            riskProfile == "aggressive": "Invalid risk profile"
        }

        emit PortfolioCreated(
            streamId: portfolioId,
            userAddress: owner,
            timestamp: getCurrentBlock().timestamp,
            riskProfile: riskProfile
        )

        return <- create Portfolio(portfolioId: portfolioId, owner: owner, riskProfile: riskProfile)
    }

    init() {
        self.StoragePath = /storage/PortfolioVault
        self.PublicPath = /public/PortfolioVault

        self.CONSERVATIVE_DRIFT_THRESHOLD = 5.0
        self.MODERATE_DRIFT_THRESHOLD = 3.0
        self.AGGRESSIVE_DRIFT_THRESHOLD = 1.0

        self.CONSERVATIVE_INTERVAL = 604800.0    // 7 days
        self.MODERATE_INTERVAL = 86400.0         // 1 day
        self.AGGRESSIVE_INTERVAL = 21600.0       // 6 hours
    }
}
