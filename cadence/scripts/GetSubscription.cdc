// GetSubscription.cdc
// Returns a public view of a subscription resource.

import SubscriptionStream from 0x0000000000000000

access(all) struct SubscriptionView {
    access(all) let subscriptionId: String
    access(all) let subscriber: Address
    access(all) let payee: Address
    access(all) let amount: UFix64
    access(all) let intervalSeconds: UFix64
    access(all) let nextPaymentTimestamp: UFix64
    access(all) let maxPayments: UInt64?
    access(all) let paymentsCompleted: UInt64
    access(all) let active: Bool
    access(all) let description: String
    access(all) let dueNow: Bool

    init(
        subscriptionId: String,
        subscriber: Address,
        payee: Address,
        amount: UFix64,
        intervalSeconds: UFix64,
        nextPaymentTimestamp: UFix64,
        maxPayments: UInt64?,
        paymentsCompleted: UInt64,
        active: Bool,
        description: String,
        dueNow: Bool
    ) {
        self.subscriptionId = subscriptionId
        self.subscriber = subscriber
        self.payee = payee
        self.amount = amount
        self.intervalSeconds = intervalSeconds
        self.nextPaymentTimestamp = nextPaymentTimestamp
        self.maxPayments = maxPayments
        self.paymentsCompleted = paymentsCompleted
        self.active = active
        self.description = description
        self.dueNow = dueNow
    }
}

access(all) fun main(accountAddress: Address, subscriptionId: String): SubscriptionView? {
    let account = getAccount(accountAddress)
    let subCap = account.capabilities.get<&SubscriptionStream.Subscription>(
        PublicPath(identifier: "Subscription_".concat(subscriptionId))!
    )

    if let subscription = subCap.borrow() {
        return SubscriptionView(
            subscriptionId: subscription.subscriptionId,
            subscriber: subscription.subscriber,
            payee: subscription.payee,
            amount: subscription.amount,
            intervalSeconds: subscription.intervalSeconds,
            nextPaymentTimestamp: subscription.nextPaymentTimestamp,
            maxPayments: subscription.maxPayments,
            paymentsCompleted: subscription.paymentsCompleted,
            active: subscription.active,
            description: subscription.description,
            dueNow: subscription.isPaymentDue()
        )
    }

    return nil
}
