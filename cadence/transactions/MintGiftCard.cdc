// MintGiftCard.cdc
// Mints a yield-bearing gift card NFT backed by a FlowPilot vault.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import NonFungibleToken from 0x631e88ae7f1d7c20
import FlowPilotVault from 0x0000000000000000
import GiftCardNFT from 0x0000000000000000

transaction(
    vaultId: String,
    recipientAddress: Address,
    message: String,
    targetDate: UFix64?,
    principalAmount: UFix64
) {
    prepare(sender: auth(Storage, Capabilities) &Account) {
        // Get the minter resource
        let minter = sender.storage.borrow<auth(GiftCardNFT.Mint) &GiftCardNFT.Minter>(
            from: GiftCardNFT.MinterStoragePath
        ) ?? panic("Minter not found — only contract deployer can mint")

        // Get capability to the vault (read-only, balance only)
        let vaultStoragePath = StoragePath(identifier: "FlowPilotVault_".concat(vaultId))!
        let vaultCap = sender.capabilities.get<&FlowPilotVault.Vault>(
            PublicPath(identifier: "FlowPilotVault_".concat(vaultId))!
        )

        // Mint the gift card
        let giftCard <- minter.mintGiftCard(
            vaultCap: vaultCap,
            targetDate: targetDate,
            message: message,
            sender: sender.address,
            recipient: recipientAddress,
            principalAmount: principalAmount
        )

        // Get or create the sender's collection
        let collectionStoragePath = GiftCardNFT.CollectionStoragePath
        if sender.storage.borrow<&GiftCardNFT.Collection>(from: collectionStoragePath) == nil {
            let collection <- GiftCardNFT.createEmptyCollection(nftType: Type<@GiftCardNFT.NFT>())
            sender.storage.save(<- collection, to: collectionStoragePath)
        }

        let collection = sender.storage.borrow<&GiftCardNFT.Collection>(
            from: collectionStoragePath
        )!

        let cardId = giftCard.id
        collection.deposit(token: <- giftCard)

        log("Gift card minted: #".concat(cardId.toString()))
        log("For recipient: ".concat(recipientAddress.toString()))
    }
}
