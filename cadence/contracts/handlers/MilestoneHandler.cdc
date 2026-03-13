// MilestoneHandler.cdc
// Scheduler handler for salary milestone verification via cross-VM oracle.
// Validates work proofs, manages dispute process, and re-registers on completion.

import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import WorkCredential from 0x0000000000000000

access(all) contract MilestoneHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event MilestoneVerified(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        milestoneIndex: UInt64,
        nextMilestoneDue: UFix64
    )
    access(all) event MilestoneDisputeOpened(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        milestoneIndex: UInt64,
        reason: String
    )
    access(all) event JurySelected(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        jurors: [Address]
    )
    access(all) event HandlerReRegistered(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        nextFireTime: UFix64
    )

    // -----------------------------------------------------------------------
    // Handler configuration
    // -----------------------------------------------------------------------
    access(all) let CHAIN_ID: String
    access(all) let DEFAULT_MILESTONE_INTERVAL: UFix64  // 30 days in seconds

    // -----------------------------------------------------------------------
    // Handler execution — implements FlowTransactionScheduler.TransactionHandler
    // -----------------------------------------------------------------------
    access(all) fun executeHandler(
        streamId: String,
        workerAddress: Address,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        milestoneIntervalSeconds: UFix64,
        milestoneIndex: UInt64
    ) {
        // 1. Check for conflicts before acting
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            return
        }

        // 2. Lock the chain
        stateRegister.lockChain(chainId: self.CHAIN_ID)

        // 3. Read work proof from WorkProofVerifier.sol via cross-VM bridge
        let proofValid = self.verifyWorkProofViaEVM(
            streamId: streamId,
            workerAddress: workerAddress,
            milestoneIndex: milestoneIndex
        )

        if proofValid {
            // 4a. Valid proof: resume accrual and re-register next milestone
            stateRegister.setMilestoneDisputed(false)

            let nextFireTime = getCurrentBlock().timestamp + milestoneIntervalSeconds

            emit MilestoneVerified(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                milestoneIndex: milestoneIndex,
                nextMilestoneDue: nextFireTime
            )

            emit HandlerReRegistered(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                nextFireTime: nextFireTime
            )
        } else {
            // 4b. Invalid proof: open dispute, suspend yield chain, select jury
            stateRegister.setMilestoneDisputed(true)

            emit MilestoneDisputeOpened(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                milestoneIndex: milestoneIndex,
                reason: "Work proof verification failed"
            )

            // Select jury of 5 via VRF from staker registry
            let jurors = self.selectJuryViaVRF(streamId: streamId, count: 5)

            emit JurySelected(
                streamId: streamId,
                userAddress: workerAddress,
                timestamp: getCurrentBlock().timestamp,
                jurors: jurors
            )
        }

        // 5. Unlock chain
        stateRegister.unlockChain(chainId: self.CHAIN_ID)
    }

    // Cross-VM bridge call to WorkProofVerifier.sol
    access(self) fun verifyWorkProofViaEVM(
        streamId: String,
        workerAddress: Address,
        milestoneIndex: UInt64
    ): Bool {
        // EVM.call() to WorkProofVerifier.isVerified(milestoneId)
        // In production: encode ABI call, call EVM contract, decode bool result
        // Returns true if proof is verified on-chain in WorkProofVerifier.sol
        return true // Placeholder: real implementation uses EVM.call() builtin
    }

    // VRF-based jury selection from staker registry
    access(self) fun selectJuryViaVRF(streamId: String, count: Int): [Address] {
        // In production: calls FlowVRF.getRandomBytes(32), samples from staker registry
        // Returns array of juror addresses
        return []
    }

    init() {
        self.CHAIN_ID = "milestone"
        self.DEFAULT_MILESTONE_INTERVAL = 2592000.0  // 30 days
    }
}
