// InitVault.cdc
// Initializes a standalone FlowPilot vault (without payroll stream).
// Used for savings and DCA rules that don't have an employer.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import RuleGraph from 0x0000000000000000

transaction(vaultId: String, initialDepositAmount: UFix64, yieldSplitRatio: UFix64) {

    prepare(user: auth(Storage, Capabilities) &Account) {
        // Check vault doesn't already exist
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(vaultId))!
        assert(
            user.storage.borrow<&FlowPilotVault.Vault>(from: vaultStoragePath) == nil,
            message: "Vault already exists"
        )

        // Withdraw initial deposit
        let userFlowVault = user.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow user's FlowToken vault")

        let deposit <- userFlowVault.withdraw(amount: initialDepositAmount) as! @FlowToken.Vault

        // Create vault
        let vault <- FlowPilotVault.createVault(
            streamId: vaultId,
            employer: user.address,
            worker: user.address,
            yieldSplitRatio: yieldSplitRatio,
            treasury: user.address,
            initialFunding: <- deposit
        )

        user.storage.save(<- vault, to: vaultStoragePath)
        let vaultPublicPath = PublicPath(identifier: "FlowPilotVault_".concat(vaultId))!
        user.capabilities.publish(
            user.capabilities.storage.issue<&FlowPilotVault.Vault>(vaultStoragePath),
            at: vaultPublicPath
        )

        // Create state register
        let stateStoragePath = StoragePath(identifier: "VaultState_".concat(vaultId))!
        let stateRegister <- VaultStateRegister.createStateRegister(
            streamId: vaultId,
            owner: user.address
        )
        user.storage.save(<- stateRegister, to: stateStoragePath)
        let statePublicPath = PublicPath(identifier: "VaultState_".concat(vaultId))!
        user.capabilities.publish(
            user.capabilities.storage.issue<&VaultStateRegister.StateRegister>(stateStoragePath),
            at: statePublicPath
        )

        // Create rule graph
        let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(vaultId))!
        let graph <- RuleGraph.createGraph(graphId: vaultId, owner: user.address)
        user.storage.save(<- graph, to: graphStoragePath)
        let graphPublicPath = PublicPath(identifier: "RuleGraph_".concat(vaultId))!
        user.capabilities.publish(
            user.capabilities.storage.issue<&RuleGraph.Graph>(graphStoragePath),
            at: graphPublicPath
        )

        log("Vault initialized: ".concat(vaultId))
    }
}
