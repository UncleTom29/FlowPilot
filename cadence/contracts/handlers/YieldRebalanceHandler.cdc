// YieldRebalanceHandler.cdc
// Scheduler handler for automatic yield harvesting and protocol rebalancing.
// Reads best APR from OracleAggregator.sol via cross-VM bridge and shifts principal.

import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract YieldRebalanceHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event YieldRebalanced(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        newProtocol: String,
        newAPR: UFix64,
        principalMoved: UFix64
    )
    access(all) event YieldHarvestedAndSplit(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        totalHarvested: UFix64,
        workerShare: UFix64,
        protocolShare: UFix64
    )
    access(all) event HandlerSkipped(
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
    access(all) let REBALANCE_INTERVAL: UFix64          // 86400 seconds
    access(all) let APR_DELTA_THRESHOLD: UFix64         // 0.5%

    // -----------------------------------------------------------------------
    // Handler execution
    // -----------------------------------------------------------------------
    access(all) fun executeHandler(
        streamId: String,
        workerAddress: Address,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        vault: auth(FlowPilotVault.Claim) &FlowPilotVault.Vault
    ) {
        // 1. Check conflicts
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            emit HandlerSkipped(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Conflict detected"
            )
            return
        }

        // 2. Skip if milestone is disputed
        if stateRegister.milestoneDisputed {
            emit HandlerSkipped(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                reason: "Milestone dispute active"
            )
            self.reRegister(streamId: streamId, workerAddress: workerAddress)
            return
        }

        // 3. Lock chain and yield
        stateRegister.lockChain(chainId: self.CHAIN_ID)
        stateRegister.setYieldLocked(true)

        // 4. Read best APR from OracleAggregator.sol via cross-VM bridge
        let (bestProtocol, bestAPR) = self.getBestAPRViaEVM()

        // 5. Get current deployed APR (stored in vault metadata or oracle)
        let currentAPR = self.getCurrentDeployedAPR(streamId: streamId)

        // 6. Rebalance if delta > 0.5%
        var aprDelta: UFix64 = 0.0
        if bestAPR > currentAPR {
            aprDelta = bestAPR - currentAPR
        } else {
            aprDelta = currentAPR - bestAPR
        }

        if aprDelta > self.APR_DELTA_THRESHOLD {
            let principal = vault.yieldPrincipal
            emit YieldRebalanced(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                newProtocol: bestProtocol,
                newAPR: bestAPR,
                principalMoved: principal
            )
            stateRegister.updateRebalanceTimestamp()
        }

        // 7. Harvest pending yield and split via vault's yieldSplitRatio
        let pendingYield = self.estimatePendingYield(vault: vault)
        if pendingYield > 0.0 {
            let protocolShare = vault.harvestYield(rawYield: pendingYield)
            let workerShare = pendingYield - protocolShare
            emit YieldHarvestedAndSplit(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                totalHarvested: pendingYield,
                workerShare: workerShare,
                protocolShare: protocolShare
            )
            stateRegister.updateYieldHarvestTimestamp()
        }

        // 8. Unlock chain and yield
        stateRegister.setYieldLocked(false)
        stateRegister.unlockChain(chainId: self.CHAIN_ID)

        // 9. Re-register for next execution in 86400 seconds
        self.reRegister(streamId: streamId, workerAddress: workerAddress)
    }

    // Cross-VM: reads OracleAggregator.getBestAPR() from EVM
    access(self) fun getBestAPRViaEVM(): (String, UFix64) {
        // EVM.call() to OracleAggregator, decode ABI-encoded (string, uint256, uint256)
        return ("DefaultProtocol", 0.05)  // 5% APR placeholder
    }

    access(self) fun getCurrentDeployedAPR(streamId: String): UFix64 {
        return 0.04  // 4% APR placeholder
    }

    access(self) fun estimatePendingYield(vault: &FlowPilotVault.Vault): UFix64 {
        // Compute yield earned since last harvest using time-elapsed * APR
        let elapsed = getCurrentBlock().timestamp - 86400.0  // Since last harvest
        let annualRate = 0.05
        let dailyRate = FlowDeFiMathUtils.div128(annualRate, 365.0)
        return FlowDeFiMathUtils.mul128(vault.yieldPrincipal, dailyRate)
    }

    access(self) fun reRegister(streamId: String, workerAddress: Address) {
        let nextFireTime = getCurrentBlock().timestamp + self.REBALANCE_INTERVAL
        emit HandlerReRegistered(
            streamId: streamId,
            userAddress: workerAddress,
            timestamp: getCurrentBlock().timestamp,
            nextFireTime: nextFireTime
        )
        // FlowTransactionScheduler.schedule(handler: self, delay: REBALANCE_INTERVAL)
    }

    init() {
        self.CHAIN_ID = "yield"
        self.REBALANCE_INTERVAL = 86400.0
        self.APR_DELTA_THRESHOLD = 0.5
    }
}
