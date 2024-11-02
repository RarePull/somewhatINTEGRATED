const express = require("express");
const mysql = require("mysql2");
const router = express.Router();

// Database connection setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "asdfghjkl",
  database: "rarepull_1",
});

// Login route
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Query to fetch user based on username
  const query = "SELECT password FROM users WHERE username = ?";
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).send("Internal server error.");
    }

    // Check if user exists and password matches
    if (results.length === 0 || results[0].password !== password) {
      return res.status(401).send("Invalid username or password");
    }

    // If successful, set session variable
    req.session.username = username;
    res.status(200).send("Login successful");
  });
});

// Logout route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error logging out.");
    }
    res.status(200).send("Logged out successfully.");
  });
});

module.exports = router;
