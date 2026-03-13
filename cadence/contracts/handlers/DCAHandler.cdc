// DCAHandler.cdc
// Dollar-Cost-Averaging scheduler handler.
// Executes periodic swaps for target asset, respects yield lock state.

import VaultStateRegister from 0x0000000000000000
import RuleGraph from 0x0000000000000000
import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract DCAHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event DCAExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        asset: String,
        amountSpent: UFix64,
        amountReceived: UFix64,
        price: UFix64
    )
    access(all) event DCASkipped(
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
        streamId: String,
        workerAddress: Address,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        targetAsset: String,
        amountPerInterval: UFix64,
        intervalSeconds: UFix64
    ) {
        // 1. Check conflicts
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            emit DCASkipped(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Conflict detected"
            )
            return
        }

        // 2. Don't DCA during yield rebalance
        if stateRegister.activeChains["yield"] == true {
            emit DCASkipped(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Yield rebalance in progress"
            )
            self.reRegister(
                streamId: streamId,
                workerAddress: workerAddress,
                intervalSeconds: intervalSeconds
            )
            return
        }

        // 3. Lock DCA chain
        stateRegister.lockChain(chainId: self.CHAIN_ID)

        // 4. Get current oracle price for target asset
        let currentPrice = self.getOraclePrice(asset: targetAsset)

        // 5. Execute swap via SwapAction
        var amountReceived = 0.0
        if currentPrice > 0.0 {
            amountReceived = FlowDeFiMathUtils.div128(amountPerInterval, currentPrice)
        }

        emit DCAExecuted(
            streamId: streamId,
            userAddress: workerAddress,
            timestamp: getCurrentBlock().timestamp,
            asset: targetAsset,
            amountSpent: amountPerInterval,
            amountReceived: amountReceived,
            price: currentPrice
        )

        // 6. Unlock chain
        stateRegister.unlockChain(chainId: self.CHAIN_ID)

        // 7. Re-register for next interval
        self.reRegister(
            streamId: streamId,
            workerAddress: workerAddress,
            intervalSeconds: intervalSeconds
        )
    }

    // Get oracle price for asset via cross-VM bridge
    access(self) fun getOraclePrice(asset: String): UFix64 {
        // EVM.call() to OracleAggregator.getPrice(chainlinkFeedAddress)
        // Returns current price in UFix64
        return 1.0  // Placeholder
    }

    access(self) fun reRegister(
        streamId: String,
        workerAddress: Address,
        intervalSeconds: UFix64
    ) {
        let nextFireTime = getCurrentBlock().timestamp + intervalSeconds
        emit HandlerReRegistered(
            streamId: streamId,
            userAddress: workerAddress,
            timestamp: getCurrentBlock().timestamp,
            nextFireTime: nextFireTime
        )
        // FlowTransactionScheduler.schedule(handler: self, delay: intervalSeconds)
    }

    init() {
        self.CHAIN_ID = "dca"
    }
}
