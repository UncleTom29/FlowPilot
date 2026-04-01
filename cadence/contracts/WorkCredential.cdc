// WorkCredential.cdc
// Soul-bound employment and financial identity resource for FlowPilot.
// Non-transferable — represents a worker's complete financial history.

import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract WorkCredential {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event CredentialCreated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        employer: Address,
        role: String
    )
    access(all) event CredentialUpdated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        totalEarned: UFix64,
        milestonesCompleted: UInt64
    )
    access(all) event MilestoneCompleted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        milestoneIndex: UInt64
    )

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // YieldProfile struct
    // -----------------------------------------------------------------------
    access(all) struct YieldProfile {
        access(all) var averageAPY: UFix64
        access(all) var totalYieldEarned: UFix64
        access(all) var streaksCompleted: UInt64

        init() {
            self.averageAPY = 0.0
            self.totalYieldEarned = 0.0
            self.streaksCompleted = 0
        }

        access(all) fun updateAPY(newYield: UFix64, elapsedDays: UFix64) {
            if elapsedDays > 0.0 {
                // Rolling average APY
                let periodAPY = FlowDeFiMathUtils.mul128(
                    FlowDeFiMathUtils.div128(newYield, self.totalYieldEarned + 1.0),
                    365.0
                )
                self.averageAPY = FlowDeFiMathUtils.div128(
                    self.averageAPY + periodAPY,
                    2.0
                )
            }
            self.totalYieldEarned = self.totalYieldEarned + newYield
        }
    }

    // -----------------------------------------------------------------------
    // WorkCredential resource — soul-bound, non-transferable
    // -----------------------------------------------------------------------
    access(all) resource Credential {

        access(all) let employer: Address
        access(all) let workerAddress: Address
        access(all) var role: String
        access(all) let startTimestamp: UFix64
        access(all) var endTimestamp: UFix64?
        access(all) var totalEarned: UFix64
        access(all) var totalYieldEarned: UFix64
        access(all) var milestonesCompleted: UInt64
        access(all) var disputesRaised: UInt64
        access(all) var yieldProfile: YieldProfile
        access(all) let streamId: String

        init(
            streamId: String,
            employer: Address,
            worker: Address,
            role: String
        ) {
            self.streamId = streamId
            self.employer = employer
            self.workerAddress = worker
            self.role = role
            self.startTimestamp = getCurrentBlock().timestamp
            self.endTimestamp = nil
            self.totalEarned = 0.0
            self.totalYieldEarned = 0.0
            self.milestonesCompleted = 0
            self.disputesRaised = 0
            self.yieldProfile = YieldProfile()
        }

        // Credit score computation — called externally for display
        access(all) fun creditScore(): UFix64 {
            let milestonePoints = UFix64(self.milestonesCompleted) * 10.0
            let yieldPoints = FlowDeFiMathUtils.div128(self.totalYieldEarned, 100.0)
            let numerator = milestonePoints + yieldPoints
            let denominator = UFix64(self.disputesRaised) + 1.0
            return FlowDeFiMathUtils.div128(numerator, denominator)
        }

        // Update credential — only callable by SettlementAuthority (Write entitlement)
        access(all) fun update(
            earnedDelta: UFix64,
            yieldDelta: UFix64,
            milestoneDelta: UInt64,
            disputeDelta: UInt64
        ) {
            self.totalEarned = self.totalEarned + earnedDelta
            self.totalYieldEarned = self.totalYieldEarned + yieldDelta
            self.milestonesCompleted = self.milestonesCompleted + milestoneDelta
            self.disputesRaised = self.disputesRaised + disputeDelta
            if yieldDelta > 0.0 {
                self.yieldProfile.updateAPY(newYield: yieldDelta, elapsedDays: 30.0)
            }
            emit CredentialUpdated(
                streamId: self.streamId,
                userAddress: self.workerAddress,
                timestamp: getCurrentBlock().timestamp,
                totalEarned: self.totalEarned,
                milestonesCompleted: self.milestonesCompleted
            )
        }

        // Complete a milestone — Write entitlement required
        access(all) fun completeMilestone() {
            self.milestonesCompleted = self.milestonesCompleted + 1
            emit MilestoneCompleted(
                streamId: self.streamId,
                userAddress: self.workerAddress,
                timestamp: getCurrentBlock().timestamp,
                milestoneIndex: self.milestonesCompleted
            )
        }

        // Raise a dispute — Write entitlement required
        access(all) fun raiseDispute() {
            self.disputesRaised = self.disputesRaised + 1
        }

        // Close the credential when employment ends
        access(all) fun close() {
            self.endTimestamp = getCurrentBlock().timestamp
        }

        // Get duration of employment in seconds
        access(all) fun getDurationSeconds(): UFix64 {
            let end = self.endTimestamp ?? getCurrentBlock().timestamp
            return end - self.startTimestamp
        }
    }

    // -----------------------------------------------------------------------
    // Factory
    // -----------------------------------------------------------------------
    access(all) fun createCredential(
        streamId: String,
        employer: Address,
        worker: Address,
        role: String
    ): @Credential {
        let cred <- create Credential(
            streamId: streamId,
            employer: employer,
            worker: worker,
            role: role
        )
        emit CredentialCreated(
            streamId: streamId,
            userAddress: worker,
            timestamp: getCurrentBlock().timestamp,
            employer: employer,
            role: role
        )
        return <- cred
    }

    init() {
        self.StoragePath = /storage/WorkCredential
        self.PublicPath = /public/WorkCredential
    }
}
