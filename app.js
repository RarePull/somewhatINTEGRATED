const express = require("express");
const session = require("express-session");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const { signUp } = require("./signup");
const { login } = require("./login");
const { uploadToPinata } = require("./upload");
const { searchNFT } = require("./searchNFT");
const { make_payment } = require("./payment");
const { transfer_asset } = require("./transferAsset");
const { deleteNFTData } = require("./deleteNFT");
const favicon = require("serve-favicon");

const app = express();

// Database connection setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "asdfghjkl",
  database: "rarepull_1",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err.message);
    return; // Prevent server from starting if DB connection fails
  }
  console.log("Connected to MySQL database.");
});

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
  })
);

// Serve static files and favicon
app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.ico"))); // Make sure you have a favicon.ico in public folder

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ensure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append time to file name
  },
});

const upload = multer({ storage: storage });

// Routes

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to Rare Pull!"); // Simple welcome message
});

// Serve the signup page
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html")); // Adjust path as needed
});

// Serve the login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html")); // Adjust path as needed
});

// Sign up route
app.post("/signup", (req, res) => {
  const { username, password, publicKey } = req.body;
  signUp(username, password, publicKey, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/signup");
    }
    req.session.username = username; // Set session variable
    res.redirect("/rec");
  });
});

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  login(username, password, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/login");
    }
    req.session.username = username; // Set session variable on successful login
    res.redirect("/dashboard");
  });
});

// Logout route
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/dashboard");
    }
    res.redirect("/login");
  });
});

// Trade route
app.get("/trade", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "trade.html")); // Adjust path as needed
});

// Upload NFT route
app.post("/sell", upload.single("nftFile"), async (req, res) => {
  const { nftName, nftPrice } = req.body;
  const filePath = req.file.path; // Path to the uploaded file
  const username = req.session.username; // Get the username from the session

  try {
    await uploadToPinata(filePath, nftName, username, nftPrice);
    res.status(200).send("NFT uploaded and listed for sale successfully!");
  } catch (error) {
    console.error("Error during NFT upload:", error);
    res.status(500).send("There was an error uploading your NFT.");
  }
});

// Search for NFTs
app.post("/search-nft", async (req, res) => {
  const { nftName } = req.body;
  try {
    const results = await searchNFT(nftName);
    res.json(results);
  } catch (error) {
    console.error("Error searching for NFTs:", error);
    res.status(500).json({ message: "Error searching for NFTs." });
  }
});

// Finalize NFT purchase route
app.post("/finalize-nft-purchase", async (req, res) => {
  const { nftId, buyerPublicKey, sellerPublicKey } = req.body;

  try {
    // Delete NFT from seller's data
    const deleteQuery =
      "DELETE FROM allNFT WHERE id = ? AND sellerPublicKey = ?";
    db.query(deleteQuery, [nftId, sellerPublicKey], async (err) => {
      if (err) {
        console.error("Error deleting NFT from seller's data:", err);
        return res.status(500).json({ message: "Error deleting NFT data." });
      }

      // Get NFT details
      try {
        const nftDetails = await getNftDetails(nftId);

        // Update the database for the buyer
        const insertQuery =
          "INSERT INTO allNFT (name, ipfsHash, sellerPublicKey, price) VALUES (?, ?, ?, ?)";
        db.query(
          insertQuery,
          [
            nftDetails.name,
            nftDetails.ipfsHash,
            buyerPublicKey,
            nftDetails.price,
          ],
          (err) => {
            if (err) {
              console.error("Error updating NFT for the buyer:", err);
              return res
                .status(500)
                .json({ message: "Error updating NFT data for buyer." });
            }

            // Perform the transfer of the NFT
            transfer_asset({ publicKey: buyerPublicKey }, nftDetails)
              .then(() => {
                console.log("NFT transfer successful.");
                res.json({ message: "NFT purchase finalized successfully." });
              })
              .catch((error) => {
                console.error("Error transferring NFT:", error);
                res.status(500).json({ message: "Error transferring NFT." });
              });
          }
        );
      } catch (error) {
        console.error("Error retrieving NFT details:", error);
        res.status(500).json({ message: "Error retrieving NFT details." });
      }
    });
  } catch (error) {
    console.error("Error finalizing NFT purchase:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while finalizing the purchase." });
  }
});

// Function to get NFT details based on ID
function getNftDetails(nftId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT name, ipfsHash, price FROM allNFT WHERE id = ?";
    db.query(query, [nftId], (err, results) => {
      if (err || results.length === 0) {
        return reject("NFT not found.");
      }
      resolve(results[0]);
    });
  });
}

// Make payment route
app.post("/make-payment", async (req, res) => {
  const { receiverKey, senderKeypair } = req.body;
  try {
    await make_payment(receiverKey, senderKeypair);
    res.status(200).send("Payment successful.");
  } catch (error) {
    res.status(500).send("Error making payment.");
  }
});

// Delete NFT route (after purchase)
app.delete("/delete-nft/:nftName", async (req, res) => {
  const { nftName } = req.params;
  try {
    await deleteNFTData(nftName);
    res.status(200).send("NFT deleted successfully.");
  } catch (error) {
    res.status(500).send("Error deleting NFT.");
  }
});

// Endpoint to get NFT details
app.get("/get-nft-details/:nftId", async (req, res) => {
  const { nftId } = req.params;
  try {
    const query =
      "SELECT name, price, description, image FROM allNFT WHERE id = ?";
    db.query(query, [nftId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: "NFT not found." });
      }
      res.json(results[0]);
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching NFT details." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
