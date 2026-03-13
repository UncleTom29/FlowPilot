// SubscriptionHandler.cdc
// Scheduler handler for recurring subscription payment execution.

import SubscriptionStream from 0x0000000000000000
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7

access(all) contract SubscriptionHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event SubscriptionPaymentProcessed(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        subscriptionId: String,
        payee: Address,
        amount: UFix64,
        paymentsCompleted: UInt64
    )
    access(all) event SubscriptionPaymentSkipped(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        subscriptionId: String,
        reason: String
    )
    access(all) event HandlerReRegistered(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        nextFireTime: UFix64
    )

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    access(all) let CHAIN_ID: String

    // -----------------------------------------------------------------------
    // Handler execution
    // -----------------------------------------------------------------------
    access(all) fun executeHandler(
        subscriptionId: String,
        subscriber: Address,
        subscription: auth(SubscriptionStream.Subscription) &SubscriptionStream.Subscription,
        vaultRef: auth(FlowPilotVault.Claim) &FlowPilotVault.Vault,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        payeeReceiverCap: Capability<&{FungibleToken.Receiver}>
    ) {
        // 1. Check conflicts
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            emit SubscriptionPaymentSkipped(
                streamId: subscriptionId,
                userAddress: subscriber,
                timestamp: getCurrentBlock().timestamp,
                subscriptionId: subscriptionId,
                reason: "Conflict detected"
            )
            return
        }

        // 2. Check subscription is active
        if !subscription.active {
            emit SubscriptionPaymentSkipped(
                streamId: subscriptionId,
                userAddress: subscriber,
                timestamp: getCurrentBlock().timestamp,
                subscriptionId: subscriptionId,
                reason: "Subscription not active"
            )
            return
        }

        // 3. Check sufficient balance (at schedule time, as per spec)
        if vaultRef.getClaimableTotal() < subscription.amount {
            emit SubscriptionPaymentSkipped(
                streamId: subscriptionId,
                userAddress: subscriber,
                timestamp: getCurrentBlock().timestamp,
                subscriptionId: subscriptionId,
                reason: "Insufficient balance"
            )
            // Re-register to retry at next interval
            self.reRegister(
                subscriptionId: subscriptionId,
                subscriber: subscriber,
                intervalSeconds: subscription.intervalSeconds
            )
            return
        }

        // 4. Lock chain
        stateRegister.lockChain(chainId: self.CHAIN_ID)

        // 5. Execute payment
        let payment <- vaultRef.claim(amount: subscription.amount)
        subscription.paymentsCompleted = subscription.paymentsCompleted + 1

        // 6. Transfer to payee
        payeeReceiverCap.borrow()!.deposit(from: <- payment)

        emit SubscriptionPaymentProcessed(
            streamId: subscriptionId,
            userAddress: subscriber,
            timestamp: getCurrentBlock().timestamp,
            subscriptionId: subscriptionId,
            payee: subscription.payee,
            amount: subscription.amount,
            paymentsCompleted: subscription.paymentsCompleted
        )

        // 7. Check if max payments reached
        if let max = subscription.maxPayments {
            if subscription.paymentsCompleted >= max {
                subscription.cancel()
                stateRegister.unlockChain(chainId: self.CHAIN_ID)
                return
            }
        }

        // 8. Unlock chain
        stateRegister.unlockChain(chainId: self.CHAIN_ID)

        // 9. Re-register for next payment
        self.reRegister(
            subscriptionId: subscriptionId,
            subscriber: subscriber,
            intervalSeconds: subscription.intervalSeconds
        )
    }

    access(self) fun reRegister(
        subscriptionId: String,
        subscriber: Address,
        intervalSeconds: UFix64
    ) {
        let nextFireTime = getCurrentBlock().timestamp + intervalSeconds
        emit HandlerReRegistered(
            streamId: subscriptionId,
            userAddress: subscriber,
            timestamp: getCurrentBlock().timestamp,
            nextFireTime: nextFireTime
        )
        // FlowTransactionScheduler.schedule(handler: self, delay: intervalSeconds)
    }

    init() {
        self.CHAIN_ID = "subscription"
    }
}
