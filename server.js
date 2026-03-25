const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Init from Render env var
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Health route
app.get("/", (req, res) => {
  res.send("Server is running");
});

/*
Broadcast Route
Only pushEnabled users
Invalid token auto remove
History save
Chunk support
*/
app.post("/send-broadcast", async (req, res) => {
  try {
    const { title, body, link } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: "Title and body required",
      });
    }

    console.log("🚀 Broadcast started");

    const snapshot = await db
      .collection("users")
      .where("pushEnabled", "==", true)
      .get();

    const users = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) {
        users.push({
          id: doc.id,
          token: data.expoPushToken,
        });
      }
    });

    if (users.length === 0) {
      return res.json({ success: true, totalTokens: 0 });
    }

    let totalSent = 0;
    const chunkSize = 100;

    for (let i = 0; i < users.length; i += chunkSize) {
      const chunk = users.slice(i, i + chunkSize);

      const messages = chunk.map((u) => ({
        to: u.token,
        sound: "default",
        title,
        body,
        data: { link },
      }));

      const response = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        messages,
        { headers: { "Content-Type": "application/json" } }
      );

      const results = response.data.data;

      for (let j = 0; j < results.length; j++) {
        if (
          results[j].status === "error" &&
          results[j].details?.error === "DeviceNotRegistered"
        ) {
          await db.collection("users").doc(chunk[j].id).update({
            expoPushToken: admin.firestore.FieldValue.delete(),
          });
        }
      }

      totalSent += messages.length;
    }

    await db.collection("notification_history").add({
      title,
      body,
      link,
      totalSent,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Broadcast completed");

    res.json({
      success: true,
      totalTokens: totalSent,
    });
  } catch (error) {
    console.error("❌ Broadcast error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Demo admin initializer
app.post("/init-demo-admin", async (req, res) => {
  try {
    const demoEmail = "demo.admin@ansari.com";
    const demoPassword = "Demo1234";
    const demoName = "Demo Admin";

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(demoEmail);
    } catch (err) {
      userRecord = null;
    }

    if (!userRecord) {
      userRecord = await admin.auth().createUser({
        email: demoEmail,
        password: demoPassword,
        displayName: demoName,
      });
    }

    await db.collection("admins").doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        fullName: demoName,
        email: demoEmail,
        role: "admin",
        isDemo: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ success: true, email: demoEmail, password: demoPassword });
  } catch (error) {
    console.error("❌ Init demo admin error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin creation endpoint
app.post("/create-admin", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password || password.length < 6) {
      return res.status(400).json({
        error: "fullName, email, and password (min 6 chars) are required",
      });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    await db.collection("admins").doc(userRecord.uid).set({
      uid: userRecord.uid,
      fullName,
      email,
      role: "admin",
      isDemo: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const demoEmail = "demo.admin@ansari.com";
    if (email !== demoEmail) {
      try {
        const demoUser = await admin.auth().getUserByEmail(demoEmail);
        if (demoUser) {
          await admin.auth().deleteUser(demoUser.uid);
          await db.collection("admins").doc(demoUser.uid).delete();
        }
      } catch (e) {
        // ignore missing demo account
      }
    }

    res.json({
      uid: userRecord.uid,
      email: userRecord.email,
      fullName: userRecord.displayName,
    });
  } catch (error) {
    console.error("❌ Create admin error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Push server running on port ${PORT}`);
});