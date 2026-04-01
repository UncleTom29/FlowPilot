// GetGiftCards.cdc
// Returns the current gift cards in an account's public collection.

import GiftCardNFT from 0x0000000000000000

access(all) struct GiftCardView {
    access(all) let id: UInt64
    access(all) let recipient: Address
    access(all) let sender: Address
    access(all) let message: String
    access(all) let principalAmount: UFix64
    access(all) let accruedYield: UFix64
    access(all) let totalValue: UFix64
    access(all) let targetDate: UFix64?
    access(all) let redeemed: Bool

    init(
        id: UInt64,
        recipient: Address,
        sender: Address,
        message: String,
        principalAmount: UFix64,
        accruedYield: UFix64,
        totalValue: UFix64,
        targetDate: UFix64?,
        redeemed: Bool
    ) {
        self.id = id
        self.recipient = recipient
        self.sender = sender
        self.message = message
        self.principalAmount = principalAmount
        self.accruedYield = accruedYield
        self.totalValue = totalValue
        self.targetDate = targetDate
        self.redeemed = redeemed
    }
}

access(all) fun main(accountAddress: Address): [GiftCardView] {
    let account = getAccount(accountAddress)
    let collectionCap = account.capabilities.get<&GiftCardNFT.Collection>(GiftCardNFT.CollectionPublicPath)

    if let collection = collectionCap.borrow() {
        var cards: [GiftCardView] = []

        for id in collection.getIDs() {
            if let card = collection.borrowGiftCard(id) {
                cards.append(
                    GiftCardView(
                        id: card.id,
                        recipient: card.recipient,
                        sender: card.sender,
                        message: card.message,
                        principalAmount: card.principalAmount,
                        accruedYield: card.getAccruedYield(),
                        totalValue: card.getTotalValue(),
                        targetDate: card.targetDate,
                        redeemed: card.redeemed
                    )
                )
            }
        }

        return cards
    }

    return []
}