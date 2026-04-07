// ================================================================
// 📁 server.cjs - FCM ONLY (No Expo)
// ✅ Sirf Firebase Cloud Messaging use karega
// ================================================================

const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

try {
  require('dotenv').config();
} catch (e) {
  console.log("⚠️ dotenv not available");
}

const app = express();

// ================================================================
// ✅ CORS
// ================================================================
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/.*\.onrender\.com$/,
      'https://my-broadcast-app.onrender.com',
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    });
    
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================================================
// ✅ Firebase Init
// ================================================================
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Firebase: ENV se load");
  } else {
    const keyPath = process.env.SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
    if (!fs.existsSync(keyPath)) {
      throw new Error(`File not found: ${keyPath}`);
    }
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    console.log(`✅ Firebase: ${keyPath} se load`);
  }
  
  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    throw new Error("Invalid service account");
  }
} catch (err) {
  console.error("❌ Firebase load failed:", err.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase initialized");
}

const db = admin.firestore();

// ================================================================
// ✅ Helper Functions
// ================================================================
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// ================================================================
// ✅ Serve Frontend
// ================================================================
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log("✅ Serving dist/");
}

// ================================================================
// ✅ Health Routes
// ================================================================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "FCM Push Notification Server",
    timestamp: new Date().toISOString(),
    version: "4.0.0 (FCM Only)"
  });
});

app.get("/ping", (req, res) => {
  res.json({ pong: true, time: Date.now() });
});

app.get("/health", (req, res) => {
  res.json({
    status: "✅ Healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: { connected: admin.apps.length > 0 },
    mode: "FCM_ONLY",
    port: process.env.PORT || 5000
  });
});

// ================================================================
// ✅ Stats API (FCM Only)
// ================================================================
app.get("/push-stats", async (req, res) => {
  try {
    const [pushTokensSnapshot, usersSnapshot] = await Promise.all([
      db.collection("push_tokens").get(),
      db.collection("users").get()
    ]);

    let enabledDevices = 0;
    let fcmCount = 0;
    let guestCount = 0;
    let userCount = 0;

    pushTokensSnapshot.forEach((doc) => {
      const data = doc.data();
      
      if (data?.pushEnabled === true && data?.fcmToken && data.fcmToken.trim() !== "") {
        enabledDevices++;
        fcmCount++;
        
        if (data?.isGuest === true) {
          guestCount++;
        } else {
          userCount++;
        }
      }
    });

    res.json({
      success: true,
      stats: {
        total: pushTokensSnapshot.size,
        enabled: enabledDevices,
        fcm: fcmCount,
        guests: guestCount,
        users: userCount,
        totalUsers: usersSnapshot.size
      },
      mode: "FCM_ONLY",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// ✅ SEND BROADCAST (FCM ONLY)
// ================================================================
app.post("/send-broadcast", async (req, res) => {
  try {
    const { title, body, link } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: "Title aur body required" 
      });
    }

    console.log("🚀 FCM Broadcast started:", { title, body });

    const deviceTokenMap = new Map();

    // ✅ Fetch push_tokens (FCM only)
    try {
      const pushSnap = await db
        .collection("push_tokens")
        .where("pushEnabled", "==", true)
        .get();
      
      pushSnap.forEach((doc) => {
        const data = doc.data();
        const deviceId = doc.id;
        
        // ✅ Only FCM tokens
        if (data.fcmToken && data.fcmToken.trim() !== "") {
          deviceTokenMap.set(deviceId, {
            id: deviceId,
            token: data.fcmToken,
            collection: "push_tokens"
          });
        }
      });
      
      console.log(`✅ push_tokens: ${pushSnap.size} total, ${deviceTokenMap.size} with FCM`);
    } catch (e) {
      console.error("⚠️ push_tokens error:", e.message);
    }

    // ✅ Fetch users (backup)
    try {
      const usersSnap = await db
        .collection("users")
        .where("pushEnabled", "==", true)
        .get();
      
      usersSnap.forEach((doc) => {
        const data = doc.data();
        const userId = doc.id;
        
        if (deviceTokenMap.has(userId)) return;
        
        if (data.fcmToken && data.fcmToken.trim() !== "") {
          deviceTokenMap.set(userId, {
            id: userId,
            token: data.fcmToken,
            collection: "users"
          });
        }
      });
      
      console.log(`✅ users: ${usersSnap.size} total`);
    } catch (e) {
      console.error("⚠️ users error:", e.message);
    }

    const allDevices = Array.from(deviceTokenMap.values());
    
    console.log(`✅ Total FCM devices: ${allDevices.length}`);

    if (allDevices.length === 0) {
      return res.json({
        success: true,
        message: "No FCM tokens found",
        totalDevices: 0,
        totalSent: 0,
        invalidTokensRemoved: 0
      });
    }

    let fcmSuccess = 0;
    let invalidTokensRemoved = 0;

    // ✅ Send FCM
    console.log(`📤 Sending to ${allDevices.length} FCM tokens...`);
    
    const fcmChunks = chunkArray(allDevices, 500);
    
    for (const chunk of fcmChunks) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: chunk.map(d => d.token),
          notification: { 
            title, 
            body 
          },
          data: { 
            link: link || "/home",
            timestamp: Date.now().toString()
          },
          android: { 
            priority: "high",
            notification: {
              channelId: "default",
              sound: "default",
              priority: "high"
            }
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1
              }
            }
          }
        });

        fcmSuccess += response.successCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            
            console.warn(`⚠️ FCM error for ${chunk[idx].id}:`, errorCode);
            
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              db.collection(chunk[idx].collection)
                .doc(chunk[idx].id)
                .update({ fcmToken: admin.firestore.FieldValue.delete() })
                .catch(() => {});
              
              invalidTokensRemoved++;
              console.log(`🗑️ Removed invalid token: ${chunk[idx].id}`);
            }
          }
        });
      } catch (error) {
        console.error("❌ FCM batch error:", error.message);
      }
    }
    
    console.log(`✅ FCM sent: ${fcmSuccess}/${allDevices.length}`);

    // ✅ Save history
    try {
      await db.collection("notification_history").add({
        title,
        body,
        link: link || null,
        totalDevices: allDevices.length,
        totalSent: fcmSuccess,
        invalidTokensRemoved,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("⚠️ History save failed:", error.message);
    }

    console.log(`🎉 Complete: ${fcmSuccess} sent to ${allDevices.length} devices`);

    return res.json({
      success: true,
      totalDevices: allDevices.length,
      totalSent: fcmSuccess,
      invalidTokensRemoved,
      message: `FCM sent to ${fcmSuccess}/${allDevices.length} devices`
    });

  } catch (error) {
    console.error("❌ Broadcast error:", error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// ================================================================
// ✅ Notification History
// ================================================================
app.get("/notification-history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const snapshot = await db
      .collection("notification_history")
      .orderBy("sentAt", "desc")
      .limit(limit)
      .get();

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null
    }));

    res.json({ 
      success: true, 
      history,
      count: history.length
    });
  } catch (error) {
    console.error("❌ History error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ================================================================
// ✅ Catch-All
// ================================================================
app.get("*", (req, res) => {
  const distIndex = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ================================================================
// ✅ Start Server
// ================================================================
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 FCM Push Notification Server");
  console.log("=".repeat(60));
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📊 Stats:    /push-stats`);
  console.log(`🔔 Broadcast: POST /send-broadcast`);
  console.log("=".repeat(60));
  console.log(`✅ Mode: FCM ONLY (No Expo)`);
  console.log(`✅ Firebase Project: ${serviceAccount.project_id}`);
  console.log("=".repeat(60) + "\n");
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));