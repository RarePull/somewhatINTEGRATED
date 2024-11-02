const diamnet = require("diamnet-sdk");

async function transferAsset(receiverKeypair, assetName) {
  const server = new diamnet.Aurora.Server("https://diamtestnet.diamcircle.io");
  const TheNFt = new diamnet.Asset(assetName, "YOUR_ISSUER_PUBLIC_KEY"); // Replace with actual issuer public key

  try {
    // Load the receiver's account
    const receiver = await server.loadAccount(receiverKeypair.publicKey());

    // Build and submit the transaction to create a trustline for the NFT in the receiver's account
    let transaction = new diamnet.TransactionBuilder(receiver, {
      fee: diamnet.BASE_FEE,
      networkPassphrase: diamnet.Networks.TESTNET,
    })
      .addOperation(
        diamnet.Operation.changeTrust({
          asset: TheNFt, // Trustline for the new NFT asset
          limit: "1", // Set a limit of 1 for an NFT
          source: receiverKeypair.publicKey(),
        })
      )
      .setTimeout(180)
      .build();

    // Sign the transaction with the receiver's keypair
    transaction.sign(receiverKeypair);
    await server.submitTransaction(transaction);
    console.log("Trustline created successfully for NFT");

    // Issue the NFT to the receiver
    transaction = new diamnet.TransactionBuilder(receiver, {
      fee: diamnet.BASE_FEE,
      networkPassphrase: diamnet.Networks.TESTNET,
    })
      .addOperation(
        diamnet.Operation.payment({
          destination: receiverKeypair.publicKey(), // Send NFT to the receiver
          asset: TheNFt, // The NFT asset to be issued
          amount: "1", // Since it’s an NFT, issuing one unit
        })
      )
      .setTimeout(180)
      .build();

    // Sign the issuance transaction
    transaction.sign(receiverKeypair);
    const result = await server.submitTransaction(transaction);
    console.log("NFT issued and transferred successfully:", result);
  } catch (error) {
    console.error(
      "There was an error in transferring the asset:",
      error.message
    );
  }
}

module.exports = { transferAsset };
