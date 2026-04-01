// SeedDashboardState.cdc
// Populates a FlowPilot vault with demo balances for the seeded dashboard.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

transaction(
    streamId: String,
    additionalPrincipalAmount: UFix64,
    salaryRate: UFix64,
    elapsedSeconds: UFix64,
    harvestedYield: UFix64
) {
    prepare(user: auth(Storage) &Account) {
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!
        let vault = user.storage.borrow<&FlowPilotVault.Vault>(
            from: vaultStoragePath
        ) ?? panic("FlowPilot vault not found: ".concat(streamId))

        if additionalPrincipalAmount > 0.0 {
            let userFlowVault = user.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
                ?? panic("Could not borrow user's FlowToken vault")
            let principal <- userFlowVault.withdraw(amount: additionalPrincipalAmount) as! @FlowToken.Vault
            vault.deposit(from: <- principal)
        }

        if salaryRate > 0.0 && elapsedSeconds > 0.0 {
            vault.accruePerSecond(rate: salaryRate, elapsed: elapsedSeconds)
        }

        if harvestedYield > 0.0 {
            let protocolShare = vault.harvestYield(rawYield: harvestedYield)
            log("Protocol treasury share: ".concat(protocolShare.toString()))
        }

        let stateStoragePath = StoragePath(identifier: "VaultState_".concat(streamId))!
        if let state = user.storage.borrow<&VaultStateRegister.StateRegister>(
            from: stateStoragePath
        ) {
            state.updateRebalanceTimestamp()
            state.updateYieldHarvestTimestamp()
        }

        log("Dashboard seed complete for: ".concat(streamId))
    }
}
