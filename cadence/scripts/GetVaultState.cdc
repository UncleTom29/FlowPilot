// GetVaultState.cdc
// Returns the current state of a FlowPilot vault and its state register.

import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

access(all) struct VaultState {
    access(all) let streamId: String
    access(all) let salaryAccrued: UFix64
    access(all) let yieldPrincipal: UFix64
    access(all) let yieldEarned: UFix64
    access(all) let tokenBalance: UFix64
    access(all) let claimableTotal: UFix64
    access(all) let yieldSplitRatio: UFix64
    access(all) let milestoneDisputed: Bool
    access(all) let yieldLocked: Bool
    access(all) let lastRebalanceTimestamp: UFix64
    access(all) let lastYieldHarvest: UFix64

    init(
        streamId: String,
        salaryAccrued: UFix64,
        yieldPrincipal: UFix64,
        yieldEarned: UFix64,
        tokenBalance: UFix64,
        claimableTotal: UFix64,
        yieldSplitRatio: UFix64,
        milestoneDisputed: Bool,
        yieldLocked: Bool,
        lastRebalanceTimestamp: UFix64,
        lastYieldHarvest: UFix64
    ) {
        self.streamId = streamId
        self.salaryAccrued = salaryAccrued
        self.yieldPrincipal = yieldPrincipal
        self.yieldEarned = yieldEarned
        self.tokenBalance = tokenBalance
        self.claimableTotal = claimableTotal
        self.yieldSplitRatio = yieldSplitRatio
        self.milestoneDisputed = milestoneDisputed
        self.yieldLocked = yieldLocked
        self.lastRebalanceTimestamp = lastRebalanceTimestamp
        self.lastYieldHarvest = lastYieldHarvest
    }
}

access(all) fun main(accountAddress: Address, streamId: String): VaultState {
    let account = getAccount(accountAddress)

    let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!
    let stateStoragePath = StoragePath(identifier: "VaultState_".concat(streamId))!

    // Access vault via public capability
    let vaultCap = account.capabilities.get<&FlowPilotVault.Vault>(
        PublicPath(identifier: "FlowPilotVault_".concat(streamId))!
    )

    var salaryAccrued = 0.0
    var yieldPrincipal = 0.0
    var yieldEarned = 0.0
    var tokenBalance = 0.0
    var claimableTotal = 0.0
    var yieldSplitRatio = 0.8

    if let vault = vaultCap.borrow() {
        salaryAccrued = vault.salaryAccrued
        yieldPrincipal = vault.yieldPrincipal
        yieldEarned = vault.yieldEarned
        tokenBalance = vault.getTokenBalance()
        claimableTotal = vault.getClaimableTotal()
        yieldSplitRatio = vault.yieldSplitRatio
    }

    let stateCap = account.capabilities.get<&VaultStateRegister.StateRegister>(
        PublicPath(identifier: "VaultState_".concat(streamId))!
    )

    var milestoneDisputed = false
    var yieldLocked = false
    var lastRebalanceTimestamp = 0.0
    var lastYieldHarvest = 0.0

    if let state = stateCap.borrow() {
        milestoneDisputed = state.milestoneDisputed
        yieldLocked = state.yieldLocked
        lastRebalanceTimestamp = state.lastRebalanceTimestamp
        lastYieldHarvest = state.lastYieldHarvest
    }

    return VaultState(
        streamId: streamId,
        salaryAccrued: salaryAccrued,
        yieldPrincipal: yieldPrincipal,
        yieldEarned: yieldEarned,
        tokenBalance: tokenBalance,
        claimableTotal: claimableTotal,
        yieldSplitRatio: yieldSplitRatio,
        milestoneDisputed: milestoneDisputed,
        yieldLocked: yieldLocked,
        lastRebalanceTimestamp: lastRebalanceTimestamp,
        lastYieldHarvest: lastYieldHarvest
    )
}
