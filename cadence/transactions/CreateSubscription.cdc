// CreateSubscription.cdc
// Creates a recurring subscription payment from the user's FlowPilot vault.

import SubscriptionStream from 0x0000000000000000
import FlowPilotVault from 0x0000000000000000

transaction(
    subscriptionId: String,
    payeeAddress: Address,
    amount: UFix64,
    intervalSeconds: UFix64,
    maxPayments: UInt64,
    description: String,
    vaultId: String
) {
    prepare(subscriber: auth(Storage, Capabilities) &Account) {
        // Verify subscriber has sufficient balance
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(vaultId))!
        let vault = subscriber.storage.borrow<&FlowPilotVault.Vault>(
            from: vaultStoragePath
        ) ?? panic("FlowPilot vault not found: ".concat(vaultId))

        assert(
            vault.getClaimableTotal() >= amount,
            message: "Insufficient balance for first payment"
        )

        var effectiveMaxPayments: UInt64? = nil
        if maxPayments > 0 {
            effectiveMaxPayments = maxPayments
        }

        // Create subscription resource
        let subscription <- SubscriptionStream.createSubscription(
            subscriptionId: subscriptionId,
            subscriber: subscriber.address,
            payee: payeeAddress,
            amount: amount,
            intervalSeconds: intervalSeconds,
            maxPayments: effectiveMaxPayments,
            description: description
        )

        // Store subscription
        let subStoragePath = StoragePath(identifier: "Subscription_".concat(subscriptionId))!
        subscriber.storage.save(<- subscription, to: subStoragePath)
        let subPublicPath = PublicPath(identifier: "Subscription_".concat(subscriptionId))!
        subscriber.capabilities.publish(
            subscriber.capabilities.storage.issue<&SubscriptionStream.Subscription>(subStoragePath),
            at: subPublicPath
        )

        // Register SubscriptionHandler with FlowTransactionScheduler
        // FlowTransactionScheduler.schedule(
        //   handler: SubscriptionHandler,
        //   delay: intervalSeconds
        // )

        log("Subscription created: ".concat(subscriptionId))
        log("Payee: ".concat(payeeAddress.toString()))
        log("Amount: ".concat(amount.toString()).concat(" FLOW every ").concat(intervalSeconds.toString()).concat(" seconds"))
    }
}
