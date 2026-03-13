// GetClaimableBalance.cdc
// Returns the claimable balance and per-second accrual rate for live ticker display.

import FlowPilotVault from 0x0000000000000000

access(all) struct ClaimableBalance {
    access(all) let streamId: String
    access(all) let salaryAccrued: UFix64
    access(all) let yieldEarned: UFix64
    access(all) let total: UFix64
    access(all) let ratePerSecond: UFix64
    access(all) let timestamp: UFix64

    init(
        streamId: String,
        salaryAccrued: UFix64,
        yieldEarned: UFix64,
        total: UFix64,
        ratePerSecond: UFix64,
        timestamp: UFix64
    ) {
        self.streamId = streamId
        self.salaryAccrued = salaryAccrued
        self.yieldEarned = yieldEarned
        self.total = total
        self.ratePerSecond = ratePerSecond
        self.timestamp = timestamp
    }
}

access(all) fun main(accountAddress: Address, streamId: String, ratePerSecond: UFix64): ClaimableBalance {
    let account = getAccount(accountAddress)

    let vaultCap = account.capabilities.get<&FlowPilotVault.Vault>(
        PublicPath(identifier: "FlowPilotVault_".concat(streamId))!
    )

    var salaryAccrued = 0.0
    var yieldEarned = 0.0
    var total = 0.0

    if let vault = vaultCap.borrow() {
        salaryAccrued = vault.salaryAccrued
        yieldEarned = vault.yieldEarned
        total = vault.getClaimableTotal()
    }

    return ClaimableBalance(
        streamId: streamId,
        salaryAccrued: salaryAccrued,
        yieldEarned: yieldEarned,
        total: total,
        ratePerSecond: ratePerSecond,
        timestamp: getCurrentBlock().timestamp
    )
}
