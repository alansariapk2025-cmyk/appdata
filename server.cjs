const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Setup
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Helper: Chunk array
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Helper: Remove duplicate tokens
function removeDuplicateTokens(users) {
  const seen = new Set();
  return users.filter((user) => {
    if (seen.has(user.token)) return false;
    seen.add(user.token);
    return true;
  });
}

// Health routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Send broadcast
app.post("/send-broadcast", async (req, res) => {
  try {
    const { title, body, link } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: "Title and body required",
      });
    }

    console.log("🚀 Broadcast started");

    // push_tokens collection
    const pushTokensSnapshot = await db
      .collection("push_tokens")
      .where("pushEnabled", "==", true)
      .get();

    let users = [];

    pushTokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) {
        users.push({
          id: doc.id,
          token: data.expoPushToken,
          collection: "push_tokens",
        });
      }
    });

    // users collection
    const usersSnapshot = await db
      .collection("users")
      .where("pushEnabled", "==", true)
      .get();

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) {
        users.push({
          id: doc.id,
          token: data.expoPushToken,
          collection: "users",
        });
      }
    });

    users = removeDuplicateTokens(users);

    if (users.length === 0) {
      return res.json({
        success: true,
        totalTokens: 0,
        message: "No valid tokens",
      });
    }

    console.log("✅ Unique tokens:", users.length);

    const chunks = chunkArray(users, 100);
    let totalSent = 0;
    let invalidTokensRemoved = 0;

    for (const chunk of chunks) {
      const messages = chunk.map((user) => ({
        to: user.token,
        sound: "default",
        title,
        body,
        data: { link: link || "/home" },
      }));

      const response = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        messages,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const results = response.data.data;

      for (let i = 0; i < results.length; i++) {
        if (
          results[i].status === "error" &&
          results[i].details?.error === "DeviceNotRegistered"
        ) {
          const invalidUser = chunk[i];

          await db.collection(invalidUser.collection).doc(invalidUser.id).update({
            expoPushToken: admin.firestore.FieldValue.delete(),
            pushEnabled: false,
          });

          invalidTokensRemoved++;
        }
      }

      totalSent += messages.length;
    }

    await db.collection("notification_history").add({
      title,
      body,
      link: link || null,
      totalSent,
      invalidTokensRemoved,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Broadcast completed");

    res.json({
      success: true,
      totalTokens: totalSent,
      invalidTokensRemoved,
    });
  } catch (error) {
    console.error("❌ Broadcast error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Push stats
app.get("/push-stats", async (req, res) => {
  try {
    const pushTokensSnap = await db.collection("push_tokens").get();
    const usersSnap = await db.collection("users").get();

    let enabledPushTokens = 0;
    let guestTokens = 0;
    let userTokens = 0;

    pushTokensSnap.forEach((doc) => {
      const data = doc.data();
      if (data.pushEnabled === true && data.expoPushToken) {
        enabledPushTokens++;
        if (data.isGuest === true) guestTokens++;
        else userTokens++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalPushTokenRecords: pushTokensSnap.size,
        enabledPushTokens,
        guestTokens,
        userTokens,
        totalUsers: usersSnap.size,
      },
    });
  } catch (error) {
    console.error("❌ Push stats error:", error);
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
    } catch {
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

    res.json({
      success: true,
      email: demoEmail,
      password: demoPassword,
    });
  } catch (error) {
    console.error("❌ Init demo admin error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create admin
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
        // ignore if demo user missing
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