// MintGiftCard.cdc
// Mints a yield-bearing gift card NFT backed by a FlowPilot vault.

import FlowPilotVault from 0x0000000000000000
import GiftCardNFT from 0x0000000000000000

transaction(
    vaultId: String,
    recipientAddress: Address,
    message: String,
    targetDate: UFix64,
    principalAmount: UFix64
) {
    prepare(sender: auth(Storage, Capabilities) &Account) {
        // Get the minter resource
        let minter = sender.storage.borrow<&GiftCardNFT.Minter>(
            from: GiftCardNFT.MinterStoragePath
        ) ?? panic("Minter not found — only contract deployer can mint")

        let vaultCap = sender.capabilities.get<&FlowPilotVault.Vault>(
            PublicPath(identifier: "FlowPilotVault_".concat(vaultId))!
        )
        assert(vaultCap.borrow() != nil, message: "Backed FlowPilot vault is not publicly available")

        var effectiveTargetDate: UFix64? = nil
        if targetDate > 0.0 {
            effectiveTargetDate = targetDate
        }

        // Mint the gift card
        let giftCard <- minter.mintGiftCard(
            streamId: vaultId,
            vaultCap: vaultCap,
            targetDate: effectiveTargetDate,
            message: message,
            sender: sender.address,
            recipient: recipientAddress,
            principalAmount: principalAmount
        )

        // Get or create the sender's collection
        let collectionStoragePath = GiftCardNFT.CollectionStoragePath
        if sender.storage.borrow<&GiftCardNFT.Collection>(from: collectionStoragePath) == nil {
            let collection <- GiftCardNFT.createEmptyCollection()
            sender.storage.save(<- collection, to: collectionStoragePath)
            sender.capabilities.publish(
                sender.capabilities.storage.issue<&GiftCardNFT.Collection>(collectionStoragePath),
                at: GiftCardNFT.CollectionPublicPath
            )
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
