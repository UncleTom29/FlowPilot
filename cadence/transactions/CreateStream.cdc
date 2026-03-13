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
    let employerVault: &FlowToken.Vault
    let employer: Address

    prepare(employer: auth(Storage, Capabilities) &Account) {
        self.employer = employer.address
        self.employerVault = employer.storage
            .borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow employer's FlowToken vault")
    }

    execute {
        // 1. Withdraw initial funding from employer's account
        let funding <- self.employerVault.withdraw(amount: initialFundingAmount) as! @FlowToken.Vault

        // 2. Create the FlowPilot Vault resource
        let vault <- FlowPilotVault.createVault(
            streamId: streamId,
            employer: self.employer,
            worker: workerAddress,
            yieldSplitRatio: yieldSplitRatio,
            treasury: self.employer,
            initialFunding: <- funding
        )

        // 3. Store vault in worker's account (via capability)
        // In production: this would be done via a capability grant to the worker's account
        // For now we store in employer's storage as a demonstration
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!
        let signer = getAuthAccount<auth(Storage, Capabilities) &Account>(self.employer)

        signer.storage.save(<- vault, to: vaultStoragePath)

        // 4. Create VaultStateRegister
        let stateRegister <- VaultStateRegister.createStateRegister(
            streamId: streamId,
            owner: workerAddress
        )
        let stateStoragePath = StoragePath(identifier: "VaultState_".concat(streamId))!
        signer.storage.save(<- stateRegister, to: stateStoragePath)

        // 5. Create WorkCredential for the worker
        let credential <- WorkCredential.createCredential(
            streamId: streamId,
            employer: self.employer,
            worker: workerAddress,
            role: workerRole
        )
        let credStoragePath = StoragePath(identifier: "WorkCred_".concat(streamId))!
        signer.storage.save(<- credential, to: credStoragePath)

        // 6. Create RuleGraph for this stream
        let ruleGraph <- RuleGraph.createGraph(graphId: streamId, owner: workerAddress)
        let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
        signer.storage.save(<- ruleGraph, to: graphStoragePath)

        // 7. Register MilestoneHandler with FlowTransactionScheduler
        // FlowTransactionScheduler.schedule(
        //   handler: MilestoneHandler,
        //   delay: milestoneIntervalDays * 86400.0
        // )

        // 8. Register YieldRebalanceHandler at 86400 seconds
        // FlowTransactionScheduler.schedule(
        //   handler: YieldRebalanceHandler,
        //   delay: 86400.0
        // )

        log("Stream created: ".concat(streamId))
        log("Worker: ".concat(workerAddress.toString()))
        log("Rate per second: ".concat(ratePerSecond.toString()))
    }
}
