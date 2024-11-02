const diamnet = require("diamnet-sdk");
const { accountVerification } = require("./loadAccount.js");
const { transfer_asset } = require("./transferAsset");
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = 3000;

// Session configuration
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Change to true in production with HTTPS
  })
);

let server = new diamnet.Aurora.Server("https://diamtestnet.diamcircle.io");

async function make_payment(receiverKey, senderKeypair) {
  try {
    // Load the sender's account for the transaction
    const sourceAccount = await server.loadAccount(senderKeypair.publicKey());

    const transaction = new diamnet.TransactionBuilder(sourceAccount, {
      fee: diamnet.BASE_FEE,
      networkPassphrase: diamnet.Networks.TESTNET,
    })
      .addOperation(
        diamnet.Operation.payment({
          destination: receiverKey,
          asset: diamnet.Asset.native(), // Sending in Lumens (native asset)
          amount: "10", // The amount being transferred to the destination account
        })
      )
      .setTimeout(180)
      .build();

    // Sign the transaction
    transaction.sign(senderKeypair);

    // Submit the transaction
    const result = await server.submitTransaction(transaction);
    console.log("Payment successful:", result);

    // Transfer NFT after successful payment
    const rarePullNft = ""; // Get the NFT identifier or asset details as needed
    await transfer_asset(senderKeypair, rarePullNft);
  } catch (e) {
    console.error("Error in making payment:", e.message);
  }
}

// Route to handle buying an NFT
app.post("/buy-nft", async (req, res) => {
  // Check if the user is logged in
  if (!req.session.username) {
    return res
      .status(401)
      .json({ message: "You must be logged in to buy NFTs." });
  }

  // Example receiver key (to be determined by your logic)
  const receiverKey = req.body.receiverKey; // Get this from the client-side input
  const senderSecretKey = req.session.senderSecretKey; // Assuming the secret key is stored in the session

  // Create the sender keypair from the session
  const senderKeypair = diamnet.Keypair.fromSecret(senderSecretKey);

  try {
    // Verify the sender's account before proceeding
    await accountVerification(senderKeypair);

    // Proceed with the payment
    await make_payment(receiverKey, senderKeypair);
    res.json({ message: "NFT purchase processed successfully." });
  } catch (error) {
    console.error("Purchase failed:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while processing your purchase." });
  }
});
