// VaultStateRegister.cdc
// Shared coordination state for all FlowPilot scheduler chains.
// Prevents conflicting operations across concurrent handlers.

access(all) contract VaultStateRegister {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event ConflictDetected(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        chainId: String,
        reason: String
    )
    access(all) event ChainLocked(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        chainId: String
    )
    access(all) event ChainUnlocked(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        chainId: String
    )

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // StateRegister resource
    // -----------------------------------------------------------------------
    access(all) resource StateRegister {

        access(all) var milestoneDisputed: Bool
        access(all) var yieldLocked: Bool
        // chainId → currently running
        access(all) var activeChains: {String: Bool}
        access(all) var lastRebalanceTimestamp: UFix64
        access(all) var lastYieldHarvest: UFix64
        access(all) let streamId: String
        access(all) let ownerAddress: Address

        init(streamId: String, owner: Address) {
            self.streamId = streamId
            self.ownerAddress = owner
            self.milestoneDisputed = false
            self.yieldLocked = false
            self.activeChains = {}
            self.lastRebalanceTimestamp = 0.0
            self.lastYieldHarvest = 0.0
        }

        // Returns true if a conflict exists for the given chainId.
        // Any handler must call this and return early (not panic) if true.
        access(all) fun checkConflict(chainId: String): Bool {
            // Conflict if another chain is already running
            if self.activeChains[chainId] == true {
                emit ConflictDetected(
                    streamId: self.streamId,
                    userAddress: self.ownerAddress,
                    timestamp: getCurrentBlock().timestamp,
                    chainId: chainId,
                    reason: "Chain already active"
                )
                return true
            }
            // Conflict if milestone is disputed (blocks yield/DCA)
            if chainId == "yield" || chainId == "dca" {
                if self.milestoneDisputed {
                    emit ConflictDetected(
                        streamId: self.streamId,
                        userAddress: self.ownerAddress,
                        timestamp: getCurrentBlock().timestamp,
                        chainId: chainId,
                        reason: "Milestone dispute active"
                    )
                    return true
                }
            }
            // Conflict if yield is locked during rebalance
            if chainId == "dca" && self.yieldLocked {
                emit ConflictDetected(
                    streamId: self.streamId,
                    userAddress: self.ownerAddress,
                    timestamp: getCurrentBlock().timestamp,
                    chainId: chainId,
                    reason: "Yield locked during rebalance"
                )
                return true
            }
            return false
        }

        // Lock a chain as active — requires Lock entitlement
        access(all) fun lockChain(chainId: String) {
            self.activeChains[chainId] = true
            emit ChainLocked(
                streamId: self.streamId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                chainId: chainId
            )
        }

        // Unlock a chain — requires Lock entitlement
        access(all) fun unlockChain(chainId: String) {
            self.activeChains[chainId] = false
            emit ChainUnlocked(
                streamId: self.streamId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                chainId: chainId
            )
        }

        // Set yieldLocked — requires Lock entitlement
        access(all) fun setYieldLocked(_ locked: Bool) {
            self.yieldLocked = locked
        }

        // Set milestoneDisputed — requires Lock entitlement
        access(all) fun setMilestoneDisputed(_ disputed: Bool) {
            self.milestoneDisputed = disputed
        }

        // Update last rebalance timestamp
        access(all) fun updateRebalanceTimestamp() {
            self.lastRebalanceTimestamp = getCurrentBlock().timestamp
        }

        // Update last yield harvest timestamp
        access(all) fun updateYieldHarvestTimestamp() {
            self.lastYieldHarvest = getCurrentBlock().timestamp
        }
    }

    // -----------------------------------------------------------------------
    // Factory function
    // -----------------------------------------------------------------------
    access(all) fun createStateRegister(streamId: String, owner: Address): @StateRegister {
        return <- create StateRegister(streamId: streamId, owner: owner)
    }

    init() {
        self.StoragePath = /storage/VaultStateRegister
        self.PublicPath = /public/VaultStateRegister
    }
}
