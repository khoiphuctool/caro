const admin = require("firebase-admin");
const fs = require("fs");
const http = require("http");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function main() {
  try {
    console.log("Downloading Cloud Database...");

    const snap = await admin.database().ref("/").get();
    const data = snap.val() || {};

    fs.writeFileSync(
      "backup.json",
      JSON.stringify(data, null, 2),
      "utf8"
    );

    console.log("✓ Downloaded Cloud Database.");

    const body = JSON.stringify(data);

    const req = http.request({
      hostname: "127.0.0.1",
      port: 9000,
      path: "/.json",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let out = "";
      res.on("data", c => out += c);
      res.on("end", () => {
        console.log("✓ Emulator response:", out);
        console.log("✓ Cloud -> Emulator sync complete.");
      });
    });

    req.on("error", err => {
      console.error("Cannot connect to Emulator (9000).");
      console.error(err.message);
    });

    req.write(body);
    req.end();

  } catch (e) {
    console.error(e);
  }
}

main();