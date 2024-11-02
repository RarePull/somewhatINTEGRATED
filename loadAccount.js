const diamnet = require("diamnet-sdk");

const server = new diamnet.Aurora.Server("https://diamtestnet.diamcircle.io");

async function accountVerification() {
  //checking to see if users account actually exists and also storing the account after loading it
  while (true) {
    let senderSecretKey = question("what are your secret keys");
    let senderKeypair = diamnet.Keypair.fromSecret(senderSecretKey);
    try {
      const sourceAccount = await server.loadAccount(senderKeypair.publicKey());
      break;
    } catch (error) {
      if (error instanceof diamnet.NotFoundError) {
        throw new Error("your account could not be found");
      } else {
        console.log("an error occured");
      }
    }
  }
}

module.exports = { accountVerification };
