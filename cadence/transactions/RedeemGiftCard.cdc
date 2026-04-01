// RedeemGiftCard.cdc
// Redeems a gift card NFT — pays principal + yield to the redeemer's wallet.

import FungibleToken from 0x9a0766d93b6608b7
import GiftCardNFT from 0x0000000000000000

transaction(cardId: UInt64, streamId: String) {

    prepare(redeemer: auth(Storage) &Account) {
        let collection = redeemer.storage.borrow<&GiftCardNFT.Collection>(
            from: GiftCardNFT.CollectionStoragePath
        ) ?? panic("No gift card collection found")

        let card = collection.borrowGiftCard(cardId) ?? panic("Gift card not found")

        assert(!card.redeemed, message: "Gift card already redeemed")

        if let targetDate = card.targetDate {
            assert(
                getCurrentBlock().timestamp >= targetDate,
                message: "Gift card not yet matured"
            )
        }

        let nft <- collection.withdraw(withdrawID: cardId)
        let totalValue = nft.getTotalValue()
        let vault = nft.vaultCap.borrow()
            ?? panic("Backed FlowPilot vault is no longer accessible")

        // Transfer funds to redeemer's FlowToken vault
        let receiver = redeemer.storage.borrow<&{FungibleToken.Receiver}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow redeemer's FlowToken receiver")

        let claimed <- vault.claim(amount: totalValue)
        receiver.deposit(from: <- claimed)

        nft.markRedeemed(totalValue: totalValue, redeemer: redeemer.address)
        destroy nft

        log("Gift card redeemed: #".concat(cardId.toString()))
        log("Total value: ".concat(totalValue.toString()))
        log("Source stream: ".concat(streamId))
    }
}
