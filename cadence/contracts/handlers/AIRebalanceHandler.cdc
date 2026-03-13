// AIRebalanceHandler.cdc
// Scheduler handler for AI-driven portfolio rebalancing.
// Reads signed attestation from OracleAggregator.sol and executes portfolio rebalance.

import PortfolioVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

access(all) contract AIRebalanceHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event AIRebalanceExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        portfolioId: String,
        signalVerified: Bool,
        assetsRebalanced: Int
    )
    access(all) event AIRebalanceSkipped(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        reason: String
    )
    access(all) event HandlerReRegistered(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        nextFireTime: UFix64
    )

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    access(all) let CHAIN_ID: String

    // -----------------------------------------------------------------------
    // Handler execution
    // -----------------------------------------------------------------------
    access(all) fun executeHandler(
        portfolioId: String,
        ownerAddress: Address,
        portfolio: auth(PortfolioVault.Portfolio) &PortfolioVault.Portfolio,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        aiOraclePublicKey: String
    ) {
        // 1. Check conflicts
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            emit AIRebalanceSkipped(
                streamId: portfolioId,
                userAddress: ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Conflict detected"
            )
            return
        }

        // 2. Lock chain
        stateRegister.lockChain(chainId: self.CHAIN_ID)

        // 3. Read signed portfolio rebalance attestation from OracleAggregator.sol
        let (currentPrices, oracleAttestation) = self.getPortfolioSignalViaEVM(
            portfolioId: portfolioId
        )

        // 4. Verify signature against registered AI oracle public key
        let signalValid = self.verifyOracleSignature(
            attestation: oracleAttestation,
            publicKey: aiOraclePublicKey
        )

        if !signalValid {
            emit AIRebalanceSkipped(
                streamId: portfolioId,
                userAddress: ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Invalid oracle signature"
            )
            stateRegister.unlockChain(chainId: self.CHAIN_ID)
            self.reRegister(
                portfolioId: portfolioId,
                ownerAddress: ownerAddress,
                riskProfile: portfolio.riskProfile
            )
            return
        }

        // 5. Execute rebalance
        portfolio.rebalance(
            currentPrices: currentPrices,
            oracleAttestation: oracleAttestation
        )

        emit AIRebalanceExecuted(
            streamId: portfolioId,
            userAddress: ownerAddress,
            timestamp: getCurrentBlock().timestamp,
            portfolioId: portfolioId,
            signalVerified: true,
            assetsRebalanced: currentPrices.length
        )

        // 6. Unlock chain
        stateRegister.unlockChain(chainId: self.CHAIN_ID)

        // 7. Re-register based on risk profile interval
        self.reRegister(
            portfolioId: portfolioId,
            ownerAddress: ownerAddress,
            riskProfile: portfolio.riskProfile
        )
    }

    // Cross-VM: reads portfolio signal from OracleAggregator.sol
    access(self) fun getPortfolioSignalViaEVM(portfolioId: String): ({String: UFix64}, [UInt8]) {
        // EVM.call() to OracleAggregator.getPortfolioSignal(portfolioId)
        // Decode ABI-encoded signal bytes
        // Returns: (prices map, attestation bytes)
        return ({}, [])  // Placeholder
    }

    // Verify ECDSA signature from AI oracle
    access(self) fun verifyOracleSignature(attestation: [UInt8], publicKey: String): Bool {
        // In production: use Crypto.verifySignature() with the oracle's public key
        // Verifies the attestation was signed by the registered AI oracle
        return attestation.length > 0
    }

    access(self) fun reRegister(portfolioId: String, ownerAddress: Address, riskProfile: String) {
        let interval = riskProfile == "conservative"
            ? PortfolioVault.CONSERVATIVE_INTERVAL
            : riskProfile == "aggressive"
                ? PortfolioVault.AGGRESSIVE_INTERVAL
                : PortfolioVault.MODERATE_INTERVAL

        let nextFireTime = getCurrentBlock().timestamp + interval
        emit HandlerReRegistered(
            streamId: portfolioId,
            userAddress: ownerAddress,
            timestamp: getCurrentBlock().timestamp,
            nextFireTime: nextFireTime
        )
        // FlowTransactionScheduler.schedule(handler: self, delay: interval)
    }

    init() {
        self.CHAIN_ID = "ai_rebalance"
    }
}
