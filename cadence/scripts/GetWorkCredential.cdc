// GetWorkCredential.cdc
// Returns the worker's soul-bound credential data.

import WorkCredential from 0x0000000000000000

access(all) struct CredentialView {
    access(all) let streamId: String
    access(all) let employer: Address
    access(all) let workerAddress: Address
    access(all) let role: String
    access(all) let startTimestamp: UFix64
    access(all) let endTimestamp: UFix64?
    access(all) let totalEarned: UFix64
    access(all) let totalYieldEarned: UFix64
    access(all) let milestonesCompleted: UInt64
    access(all) let disputesRaised: UInt64
    access(all) let creditScore: UFix64
    access(all) let averageAPY: UFix64
    access(all) let durationSeconds: UFix64

    init(
        streamId: String,
        employer: Address,
        workerAddress: Address,
        role: String,
        startTimestamp: UFix64,
        endTimestamp: UFix64?,
        totalEarned: UFix64,
        totalYieldEarned: UFix64,
        milestonesCompleted: UInt64,
        disputesRaised: UInt64,
        creditScore: UFix64,
        averageAPY: UFix64,
        durationSeconds: UFix64
    ) {
        self.streamId = streamId
        self.employer = employer
        self.workerAddress = workerAddress
        self.role = role
        self.startTimestamp = startTimestamp
        self.endTimestamp = endTimestamp
        self.totalEarned = totalEarned
        self.totalYieldEarned = totalYieldEarned
        self.milestonesCompleted = milestonesCompleted
        self.disputesRaised = disputesRaised
        self.creditScore = creditScore
        self.averageAPY = averageAPY
        self.durationSeconds = durationSeconds
    }
}

access(all) fun main(accountAddress: Address, streamId: String): CredentialView? {
    let account = getAccount(accountAddress)

    let credCap = account.capabilities.get<&WorkCredential.Credential>(
        PublicPath(identifier: "WorkCred_".concat(streamId))!
    )

    if let cred = credCap.borrow() {
        return CredentialView(
            streamId: cred.streamId,
            employer: cred.employer,
            workerAddress: cred.workerAddress,
            role: cred.role,
            startTimestamp: cred.startTimestamp,
            endTimestamp: cred.endTimestamp,
            totalEarned: cred.totalEarned,
            totalYieldEarned: cred.totalYieldEarned,
            milestonesCompleted: cred.milestonesCompleted,
            disputesRaised: cred.disputesRaised,
            creditScore: cred.creditScore(),
            averageAPY: cred.yieldProfile.averageAPY,
            durationSeconds: cred.getDurationSeconds()
        )
    }

    return nil
}
