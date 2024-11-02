const express = require("express");
const mysql = require("mysql2");
const diamnet = require("diamnet-sdk");
const { accountVerification } = require("./loadAccount.js");
const { transferAsset } = require("./transferAsset");

const app = express();
const PORT = 3000;

// MySQL connection details
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "asdfghjkl",
  database: "rarePull",
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Endpoint to finalize the NFT purchase after successful payment
app.post("/finalize-nft-purchase", async (req, res) => {
  const { nftId, buyerPublicKey, sellerPublicKey, senderSecretKey } = req.body;

  try {
    // Verify the seller's account
    const sellerKeypair = diamnet.Keypair.fromSecret(senderSecretKey);
    await accountVerification(sellerKeypair);

    // Step 1: Delete NFT from seller's data
    const deleteQuery =
      "DELETE FROM allNFT WHERE id = ? AND sellerPublicKey = ?";

    await new Promise((resolve, reject) => {
      db.query(deleteQuery, [nftId, sellerPublicKey], (err, results) => {
        if (err) {
          console.error("Error deleting NFT from seller's data:", err);
          return reject("Error deleting NFT data.");
        }
        resolve(results);
      });
    });

    // Step 2: Get NFT details to prepare for insertion for buyer
    const nftDetails = await getNftDetails(nftId); // Function to retrieve NFT details

    // Step 3: Update the database for the buyer
    const insertQuery =
      "INSERT INTO allNFT (name, ipfsHash, sellerPublicKey) VALUES (?, ?, ?)";

    await new Promise((resolve, reject) => {
      db.query(
        insertQuery,
        [nftDetails.name, nftDetails.ipfsHash, buyerPublicKey],
        (err, results) => {
          if (err) {
            console.error("Error updating NFT for the buyer:", err);
            return reject("Error updating NFT data for buyer.");
          }
          resolve(results);
        }
      );
    });

    // Step 4: Delete NFT from Diamante
    await deleteNftFromDiamante(nftDetails.name, sellerKeypair);
    console.log("NFT deleted from Diamante successfully.");
    res.json({ message: "NFT purchase finalized successfully." });
  } catch (error) {
    console.error("Error finalizing NFT purchase:", error.message);
    res.status(500).json({
      message:
        error.message || "An error occurred while finalizing the purchase.",
    });
  }
});

// Function to get NFT details based on ID
async function getNftDetails(nftId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT name, ipfsHash FROM allNFT WHERE id = ?";
    db.query(query, [nftId], (err, results) => {
      if (err || results.length === 0) {
        return reject("NFT not found.");
      }
      resolve(results[0]);
    });
  });
}

// Function to delete NFT from Diamante
async function deleteNftFromDiamante(nftName, sellerKeypair) {
  const server = new diamnet.Aurora.Server("https://diamtestnet.diamcircle.io");

  try {
    const account = await server.loadAccount(sellerKeypair.publicKey());
    const transaction = new diamnet.TransactionBuilder(account, {
      fee: diamnet.BASE_FEE,
      networkPassphrase: diamnet.Networks.TESTNET,
    })
      .addOperation(
        diamnet.Operation.manageData({
          name: nftName, // The name of the NFT to delete
          value: null, // Set value to null to delete the data
        })
      )
      .setTimeout(180)
      .build();

    // Sign and submit the transaction
    transaction.sign(sellerKeypair);
    await server.submitTransaction(transaction);
  } catch (error) {
    throw new Error("Failed to delete NFT from Diamante: " + error.message);
  }
}
