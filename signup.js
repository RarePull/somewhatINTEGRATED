// Function to sign up a new user
const signUp = (username, password, publicKey, callback) => {
  const checkUserQuery = `SHOW TABLES LIKE '${username}'`;
  db.query(checkUserQuery, (err, results) => {
    if (err) return callback(err);

    if (results.length > 0) {
      return callback(new Error(`Username '${username}' already exists.`));
    } else {
      // Insert user details into the userdetails table
      const insertUserQuery =
        "INSERT INTO userdetails (username, password, publicKey) VALUES (?, ?, ?)";
      db.query(insertUserQuery, [username, password, publicKey], (err) => {
        if (err) return callback(err);

        // Create a new table for the user to store their NFTs
        const createNftTableQuery = `CREATE TABLE \`${username}\` (ipfsHash VARCHAR(255), nftName VARCHAR(255))`; // table to store all the NFTs owned by the user
        db.query(createNftTableQuery, (err) => {
          if (err) return callback(err);
          callback(null, true); // Call once at the end
        });
      });
    }
  });
};
