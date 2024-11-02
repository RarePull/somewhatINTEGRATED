const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

// Create a MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "asdfghjkl",
  database: "rarepull_1",
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

// Helper function to calculate similarity score (higher score = more similar)
function calculateSimilarityScore(input, name) {
  if (name.toLowerCase() === input.toLowerCase()) return 1; // Exact match
  if (name.toLowerCase().includes(input.toLowerCase())) return 0.5; // Partial match
  return 0; // No match
}

// Fetch image from Pinata
async function fetchImageFromPinata(ipfsHash) {
  const url = `https://ipfs.io/ipfs/${ipfsHash}`;
  return url;
}

// Serve the HTML and JavaScript directly from the server
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NFT Search</title>
      <style>
        body { font-family: Arial, sans-serif; }
        .nft-item { margin: 20px; border: 1px solid #ccc; padding: 10px; display: inline-block; }
        .buy-button { background-color: green; color: white; border: none; padding: 10px; cursor: pointer; }
        .buy-button:hover { background-color: darkgreen; }
      </style>
    </head>
    <body>
      <h1>Search for an NFT</h1>
      <form id="nftForm">
        <label for="nftName">NFT Name:</label>
        <input type="text" id="nftName" name="nftName" required>
        <button type="submit">Search</button>
      </form>

      <h2>Search Results:</h2>
      <div id="results"></div>

      <script>
        document.getElementById("nftForm").addEventListener("submit", async function (event) {
          event.preventDefault();
          
          const nftName = document.getElementById("nftName").value;

          try {
            const response = await fetch("/search-nft", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ nftName }),
            });
            
            const data = await response.json();

            const resultsDiv = document.getElementById("results");
            resultsDiv.innerHTML = "";

            if (data.length) {
              for (const nft of data) {
                // Fetch image from IPFS and display it
                const imageUrl = await fetchImage(nft.ipfsHash);
                const nftItem = document.createElement("div");
                nftItem.className = 'nft-item';
                nftItem.innerHTML = \`
                  <p>NFT: \${nft.name}</p>
                  <img src="\${imageUrl}" alt="NFT Image" width="200"/>
                  <button class="buy-button" data-ipfs="\${nft.ipfsHash}" data-name="\${nft.name}">Buy</button>
                \`;
                resultsDiv.appendChild(nftItem);
              }

              // Add event listeners to the buy buttons
              const buyButtons = document.querySelectorAll('.buy-button');
              buyButtons.forEach(button => {
                button.addEventListener('click', async function () {
                  const ipfsHash = this.dataset.ipfs;
                  const nftName = this.dataset.name;

                  // Trigger purchase
                  try {
                    const purchaseResponse = await fetch("/purchase-nft", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ ipfsHash, nftName }),
                    });
                    const purchaseResult = await purchaseResponse.json();
                    alert(purchaseResult.message);
                  } catch (error) {
                    console.error("Error during purchase:", error);
                  }
                });
              });
            } else {
              resultsDiv.textContent = "No matching results found.";
            }
          } catch (error) {
            console.error("Error fetching search results:", error);
          }
        });

        // Function to fetch image from Pinata
        async function fetchImage(ipfsHash) {
          return \`https://ipfs.io/ipfs/\${ipfsHash}\`;
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint to handle the NFT search and return IPFS hashes for images
app.post("/search-nft", (req, res) => {
  const userInput = req.body.nftName;

  const query = "SELECT name, ipfsHash FROM allNFT";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Database query error" });
      return;
    }

    // Calculate similarity score for each NFT and sort by score in descending order
    const sortedResults = results
      .map((nft) => ({
        ...nft,
        similarityScore: calculateSimilarityScore(userInput, nft.name),
      }))
      .filter((nft) => nft.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore);

    // Only return name and ipfsHash fields
    res.json(sortedResults.map(({ name, ipfsHash }) => ({ name, ipfsHash })));
  });
});

// Endpoint to handle NFT purchases
app.post("/purchase-nft", (req, res) => {
  const { ipfsHash, nftName } = req.body;
  const username = req.session.username; // Get the username from the session

  // Here you would handle the logic for purchasing the NFT, e.g., updating the database,
  // deducting the user's balance, transferring the NFT, etc.

  console.log(
    `User ${username} is purchasing NFT: ${nftName} with IPFS hash: ${ipfsHash}`
  );

  // Send a response back to the user
  res.json({ message: `Successfully purchased ${nftName}!` });
});
