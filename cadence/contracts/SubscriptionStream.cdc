// SubscriptionStream.cdc
// Recurring payment protocol for FlowPilot.
// Integrates with FlowTransactionScheduler for automated payments.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000

access(all) contract SubscriptionStream {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event SubscriptionCreated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        subscriptionId: String,
        payee: Address,
        amount: UFix64,
        intervalSeconds: UFix64
    )
    access(all) event PaymentExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        subscriptionId: String,
        payee: Address,
        amount: UFix64,
        paymentsCompleted: UInt64
    )
    access(all) event SubscriptionCancelled(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        subscriptionId: String
    )

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // Subscription resource
    // -----------------------------------------------------------------------
    access(all) resource Subscription {

        access(all) let subscriptionId: String
        access(all) let subscriber: Address
        access(all) var payee: Address
        access(all) var amount: UFix64
        access(all) var intervalSeconds: UFix64
        access(all) var nextPaymentTimestamp: UFix64
        access(all) var maxPayments: UInt64?
        access(all) var paymentsCompleted: UInt64
        access(all) var active: Bool
        access(all) var description: String

        init(
            subscriptionId: String,
            subscriber: Address,
            payee: Address,
            amount: UFix64,
            intervalSeconds: UFix64,
            maxPayments: UInt64?,
            description: String
        ) {
            self.subscriptionId = subscriptionId
            self.subscriber = subscriber
            self.payee = payee
            self.amount = amount
            self.intervalSeconds = intervalSeconds
            self.nextPaymentTimestamp = getCurrentBlock().timestamp + intervalSeconds
            self.maxPayments = maxPayments
            self.paymentsCompleted = 0
            self.active = true
            self.description = description
        }

        // Schedule next payment with FlowTransactionScheduler
        access(all) fun scheduleNext() {
            assert(self.active, message: "Subscription is not active")
            self.nextPaymentTimestamp = getCurrentBlock().timestamp + self.intervalSeconds
            // FlowTransactionScheduler.schedule(...) would be called here
            // with SubscriptionHandler capability
        }

        // Execute payment — called by SubscriptionHandler
        access(all) fun executePayment(vaultRef: &FlowPilotVault.Vault): @FlowToken.Vault {
            assert(self.active, message: "Subscription cancelled")
            assert(vaultRef.getClaimableTotal() >= self.amount, message: "Insufficient balance")
            assert(getCurrentBlock().timestamp >= self.nextPaymentTimestamp, message: "Payment not yet due")

            let payment <- vaultRef.claim(amount: self.amount)
            self.paymentsCompleted = self.paymentsCompleted + 1

            emit PaymentExecuted(
                streamId: self.subscriptionId,
                userAddress: self.subscriber,
                timestamp: getCurrentBlock().timestamp,
                subscriptionId: self.subscriptionId,
                payee: self.payee,
                amount: self.amount,
                paymentsCompleted: self.paymentsCompleted
            )

            // Check if max payments reached
            if let max = self.maxPayments {
                if self.paymentsCompleted >= max {
                    self.active = false
                    emit SubscriptionCancelled(
                        streamId: self.subscriptionId,
                        userAddress: self.subscriber,
                        timestamp: getCurrentBlock().timestamp,
                        subscriptionId: self.subscriptionId
                    )
                    return <- payment
                }
            }

            // Schedule next payment
            self.scheduleNext()

            return <- payment
        }

        // Cancel the subscription
        access(all) fun cancel() {
            self.active = false
            // Revoke scheduled handler capability here
            emit SubscriptionCancelled(
                streamId: self.subscriptionId,
                userAddress: self.subscriber,
                timestamp: getCurrentBlock().timestamp,
                subscriptionId: self.subscriptionId
            )
        }

        access(all) fun isPaymentDue(): Bool {
            return self.active && getCurrentBlock().timestamp >= self.nextPaymentTimestamp
        }
    }

    // -----------------------------------------------------------------------
    // Factory
    // -----------------------------------------------------------------------
    access(all) fun createSubscription(
        subscriptionId: String,
        subscriber: Address,
        payee: Address,
        amount: UFix64,
        intervalSeconds: UFix64,
        maxPayments: UInt64?,
        description: String
    ): @Subscription {
        let sub <- create Subscription(
            subscriptionId: subscriptionId,
            subscriber: subscriber,
            payee: payee,
            amount: amount,
            intervalSeconds: intervalSeconds,
            maxPayments: maxPayments,
            description: description
        )
        emit SubscriptionCreated(
            streamId: subscriptionId,
            userAddress: subscriber,
            timestamp: getCurrentBlock().timestamp,
            subscriptionId: subscriptionId,
            payee: payee,
            amount: amount,
            intervalSeconds: intervalSeconds
        )
        return <- sub
    }

    init() {
        self.StoragePath = /storage/SubscriptionStream
        self.PublicPath = /public/SubscriptionStream
    }
}
