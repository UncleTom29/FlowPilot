// CreateStream.cdc
// Creates a new FlowPilot payroll stream with all associated resources and handlers.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import WorkCredential from 0x0000000000000000
import RuleGraph from 0x0000000000000000

transaction(
    streamId: String,
    workerAddress: Address,
    ratePerSecond: UFix64,
    yieldSplitRatio: UFix64,
    milestoneIntervalDays: UFix64,
    initialFundingAmount: UFix64,
    workerRole: String
) {
    prepare(employer: auth(Storage, Capabilities) &Account) {
        let employerVault = employer.storage
            .borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow employer's FlowToken vault")

        let funding <- employerVault.withdraw(amount: initialFundingAmount) as! @FlowToken.Vault

        let vault <- FlowPilotVault.createVault(
            streamId: streamId,
            employer: employer.address,
            worker: workerAddress,
            yieldSplitRatio: yieldSplitRatio,
            treasury: employer.address,
            initialFunding: <- funding
        )

        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!
        employer.storage.save(<- vault, to: vaultStoragePath)
        let vaultPublicPath = PublicPath(identifier: "FlowPilotVault_".concat(streamId))!
        employer.capabilities.publish(
            employer.capabilities.storage.issue<&FlowPilotVault.Vault>(vaultStoragePath),
            at: vaultPublicPath
        )

        let stateRegister <- VaultStateRegister.createStateRegister(
            streamId: streamId,
            owner: workerAddress
        )
        let stateStoragePath = StoragePath(identifier: "VaultState_".concat(streamId))!
        employer.storage.save(<- stateRegister, to: stateStoragePath)
        let statePublicPath = PublicPath(identifier: "VaultState_".concat(streamId))!
        employer.capabilities.publish(
            employer.capabilities.storage.issue<&VaultStateRegister.StateRegister>(stateStoragePath),
            at: statePublicPath
        )

        let credential <- WorkCredential.createCredential(
            streamId: streamId,
            employer: employer.address,
            worker: workerAddress,
            role: workerRole
        )
        let credStoragePath = StoragePath(identifier: "WorkCred_".concat(streamId))!
        employer.storage.save(<- credential, to: credStoragePath)
        let credPublicPath = PublicPath(identifier: "WorkCred_".concat(streamId))!
        employer.capabilities.publish(
            employer.capabilities.storage.issue<&WorkCredential.Credential>(credStoragePath),
            at: credPublicPath
        )

        let ruleGraph <- RuleGraph.createGraph(graphId: streamId, owner: workerAddress)
        let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
        employer.storage.save(<- ruleGraph, to: graphStoragePath)
        let graphPublicPath = PublicPath(identifier: "RuleGraph_".concat(streamId))!
        employer.capabilities.publish(
            employer.capabilities.storage.issue<&RuleGraph.Graph>(graphStoragePath),
            at: graphPublicPath
        )

        log("Stream created: ".concat(streamId))
        log("Worker: ".concat(workerAddress.toString()))
        log("Rate per second: ".concat(ratePerSecond.toString()))
        log("Milestone interval days: ".concat(milestoneIntervalDays.toString()))
    }
}
