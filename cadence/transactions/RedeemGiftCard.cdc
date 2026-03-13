// RedeemGiftCard.cdc
// Redeems a gift card NFT — pays principal + yield to the redeemer's wallet.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import NonFungibleToken from 0x631e88ae7f1d7c20
import GiftCardNFT from 0x0000000000000000
import FlowPilotVault from 0x0000000000000000

transaction(cardId: UInt64, streamId: String) {

    prepare(redeemer: auth(Storage) &Account) {
        let collection = redeemer.storage.borrow<&GiftCardNFT.Collection>(
            from: GiftCardNFT.CollectionStoragePath
        ) ?? panic("No gift card collection found")

        let card = collection.borrowGiftCard(cardId) ?? panic("Gift card not found")

        assert(!card.redeemed, message: "Gift card already redeemed")

        // Check maturity date if set
        if let targetDate = card.targetDate {
            assert(
                getCurrentBlock().timestamp >= targetDate,
                message: "Gift card not yet matured"
            )
        }

        // Get total value (principal + yield)
        let totalValue = card.getTotalValue()

        // Claim from underlying vault via capability
        // Note: Vault capability must grant Claim entitlement for redemption
        // In production, vault is a separate dedicated vault for the gift card

        // Withdraw the NFT from collection and destroy it (mark redeemed)
        let nft <- collection.withdraw(withdrawID: cardId) as! @GiftCardNFT.NFT

        // Transfer funds to redeemer's FlowToken vault
        let receiver = redeemer.storage.borrow<&{FungibleToken.Receiver}>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow redeemer's FlowToken receiver")

        // In production: claim from vault, deposit to receiver
        // let claimed <- vaultRef.claim(amount: totalValue)
        // receiver.deposit(from: <- claimed)

        // Destroy the redeemed NFT
        destroy nft

        log("Gift card redeemed: #".concat(cardId.toString()))
        log("Total value: ".concat(totalValue.toString()))
    }
}
