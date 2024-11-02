async function uploadToPinata(filePath, nameOfNft, username, nftPrice) {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  let data = new FormData();
  data.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post(url, data, {
      headers: {
        ...data.getHeaders(),
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY,
      },
    });
    console.log("File uploaded successfully:", response.data);

    // Upload to Diamante
    await uploadData(response.data.IpfsHash, nameOfNft, username, nftPrice);
  } catch (error) {
    console.error(
      "Error uploading file to Pinata:",
      error.response ? error.response.data : error.message
    );
  }
}

function uploadData(hash, nameOfNft, username, nftPrice) {
  var server = new diamnet.Aurora.Server("https://diamtestnet.diamcircle.io");
  var sourceKeys = diamnet.Keypair.fromSecret(
    "YOUR_SECRET_KEY_HERE" // Use the appropriate user secret key
  );

  var transaction;

  server
    .loadAccount(sourceKeys.publicKey())
    .then(function (sourceAccount) {
      // Build the transaction to upload data to Diamante
      transaction = new diamnet.TransactionBuilder(sourceAccount, {
        fee: diamnet.BASE_FEE,
        networkPassphrase: diamnet.Networks.TESTNET,
      })
        .addOperation(
          diamnet.Operation.manageData({
            name: nameOfNft, // The name of the NFT
            value: JSON.stringify({
              ipfsHash: hash,
              username: username,
              price: nftPrice, // Store the price
            }), // Store the data as JSON
          })
        )
        .setTimeout(0)
        .build();

      // Sign and submit the transaction
      transaction.sign(sourceKeys);
      return server.submitTransaction(transaction);
    })
    .then(function () {
      console.log("Success! NFT data uploaded to Diamante.");
    })
    .catch(function (error) {
      console.error("Something went wrong!", error);
    });

  // Insert into local database
  db.query(
    "INSERT INTO allNFT (nftName, ipfsHash, username) VALUES (?, ?, ?)",
    [nameOfNft, hash, username],
    (err, results) => {
      if (err) {
        console.error("Error inserting data:", err);
      } else {
        console.log("Data inserted successfully:", results);
      }
    }
  );
}
