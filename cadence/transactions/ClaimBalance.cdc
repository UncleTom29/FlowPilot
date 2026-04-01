// ClaimBalance.cdc
// Claims earned salary and yield from the worker's FlowPilot vault.
// Gasless via fee delegation — worker pays no gas.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000
import WorkCredential from 0x0000000000000000

transaction(streamId: String, amount: UFix64) {

    prepare(worker: auth(Storage) &Account) {
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(streamId))!

        let vault = worker.storage.borrow<&FlowPilotVault.Vault>(
            from: vaultStoragePath
        ) ?? panic("FlowPilot vault not found for stream: ".concat(streamId))

        // Verify sufficient balance
        let claimable = vault.getClaimableTotal()
        assert(amount <= claimable, message: "Requested amount exceeds claimable balance")

        // Claim from vault
        let claimed <- vault.claim(amount: amount)
        let claimedAmount = claimed.balance

        // Deposit to worker's FlowToken receiver
        let receiver = worker.storage.borrow<&{FungibleToken.Receiver}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow worker's FlowToken receiver")

        receiver.deposit(from: <- claimed)

        // Update WorkCredential with cumulative earned
        let credStoragePath = StoragePath(identifier: "WorkCred_".concat(streamId))!
        if let cred = worker.storage.borrow<&WorkCredential.Credential>(
            from: credStoragePath
        ) {
            cred.update(
                earnedDelta: claimedAmount,
                yieldDelta: 0.0,
                milestoneDelta: 0,
                disputeDelta: 0
            )
        }

        log("Claimed: ".concat(claimedAmount.toString()).concat(" FLOW"))
    }
}
