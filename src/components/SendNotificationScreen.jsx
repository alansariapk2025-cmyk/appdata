// ================================================================
// 📁 src/screens/SendNotificationScreen.jsx
// ✅ FCM ONLY - No Expo
// ================================================================

import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";

import {
  FaHistory,
  FaTrash,
  FaBell,
  FaUserCheck,
  FaServer,
  FaAndroid,
  FaUsers,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

// ================================================================
// ✅ Backend URL
// ================================================================
const getBackendURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return 'https://my-broadcast-app.onrender.com';
  }
  
  return 'http://localhost:5000';
};

const BACKEND_URL = getBackendURL();

// ================================================================
// ✅ Templates
// ================================================================
const NOTIFICATION_TEMPLATES = [
  {
    id: "eid_offer",
    title: "🌙 Eid Special Sale!",
    body: "Celebrate Eid with up to 40% discount on all items!",
    action: "home",
  },
  {
    id: "discount_offer",
    title: "🔥 Mega Discount Offer!",
    body: "Flat 30% off on selected products. Limited time only!",
    action: "home",
  },
  {
    id: "new_arrival",
    title: "🆕 New Products Arrived!",
    body: "Check out our latest collection. Shop now!",
    action: "home",
  },
  {
    id: "order_reminder",
    title: "🛒 Complete Your Order!",
    body: "You have items in your cart. Don't miss out!",
    action: "cart",
  },
  {
    id: "flash_sale",
    title: "⚡ Flash Sale Alert!",
    body: "24-hour flash sale - Up to 50% off! Hurry!",
    action: "home",
  },
];

const ACTION_ROUTES = {
  home: "/home",
  cart: "/cart",
  account: "/account",
  orders: "/account/OrderHistoryScreen",
};

// ================================================================
// ✅ Main Component
// ================================================================
export default function SendNotificationScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedAction, setSelectedAction] = useState("home");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [serverStatus, setServerStatus] = useState("checking");
  const [lastPing, setLastPing] = useState(null);
  const [stats, setStats] = useState({
    totalPushTokens: 0,
    enabledPushTokens: 0,
    guestTokens: 0,
    userTokens: 0,
    totalUsers: 0,
  });

  // ================================================================
  // ✅ Check Server Health
  // ================================================================
  const checkServerHealth = async () => {
    setServerStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${BACKEND_URL}/ping`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setServerStatus("online");
        setLastPing(new Date().toLocaleTimeString());
      } else {
        setServerStatus("offline");
      }
    } catch (error) {
      setServerStatus("offline");
    }
  };

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  // ================================================================
  // ✅ Load Stats (FCM Only)
  // ================================================================
  const fetchStats = async () => {
    try {
      const [pushTokensSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, "push_tokens")),
        getDocs(collection(db, "users"))
      ]);

      let enabledPushTokens = 0;
      let guestTokens = 0;
      let userTokens = 0;

      pushTokensSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        if (data?.pushEnabled === true && data?.fcmToken && data.fcmToken.trim() !== "") {
          enabledPushTokens++;
          
          if (data?.isGuest === true) {
            guestTokens++;
          } else {
            userTokens++;
          }
        }
      });

      setStats({
        totalPushTokens: pushTokensSnapshot.size,
        enabledPushTokens,
        guestTokens,
        userTokens,
        totalUsers: usersSnapshot.size,
      });
      
      console.log("📊 FCM Stats:", { enabled: enabledPushTokens });
    } catch (err) {
      console.error("❌ Stats error:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // ================================================================
  // ✅ History Listener
  // ================================================================
  useEffect(() => {
    const q = query(
      collection(db, "notification_history"),
      orderBy("sentAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotificationHistory(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });

    return () => unsubscribe();
  }, []);

  // ================================================================
  // ✅ Send Broadcast
  // ================================================================
  const sendNotificationToAll = async () => {
    if (!title.trim() || !body.trim()) {
      alert("⚠️ Please enter title and body");
      return;
    }

    if (serverStatus !== "online") {
      const proceed = window.confirm("⚠️ Server offline. Try anyway?");
      if (!proceed) return;
    }

    setLoading(true);
    setStatus("🚀 Sending via FCM...");

    try {
      const link = ACTION_ROUTES[selectedAction] || "/home";

      const response = await fetch(`${BACKEND_URL}/send-broadcast`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), link }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Error: ${response.status}`);
      }

      const totalDevices = result.totalDevices ?? 0;
      const totalSent = result.totalSent ?? 0;
      const invalidRemoved = result.invalidTokensRemoved ?? 0;

      let statusMessage = `✅ Sent to ${totalSent}/${totalDevices} devices`;
      
      if (invalidRemoved > 0) {
        statusMessage += ` • 🗑️ ${invalidRemoved} invalid removed`;
      }

      setStatus(statusMessage);
      setTitle("");
      setBody("");
      setSelectedAction("home");

      await fetchStats();
      setTimeout(() => setStatus(""), 10000);
      
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // ✅ Use Template
  // ================================================================
  const useTemplate = (template) => {
    setTitle(template.title);
    setBody(template.body);
    setSelectedAction(template.action);
  };

  // ================================================================
  // ✅ Delete History
  // ================================================================
  const deleteFromHistory = async (id) => {
    if (!window.confirm("Delete?")) return;
    try {
      await deleteDoc(doc(db, "notification_history", id));
    } catch (error) {
      alert("Failed: " + error.message);
    }
  };

  // ================================================================
  // ✅ Server Status Badge
  // ================================================================
  const ServerStatusBadge = () => {
    const config = {
      online: { color: "bg-green-500", text: "text-green-300", label: "🟢 Online", icon: <FaCheckCircle /> },
      offline: { color: "bg-red-500", text: "text-red-300", label: "🔴 Offline", icon: <FaExclamationTriangle /> },
      checking: { color: "bg-yellow-500", text: "text-yellow-300", label: "🟡 Checking...", icon: <FaSync className="animate-spin" /> },
    }[serverStatus];

    return (
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`}></span>
        <span className={`text-sm font-medium ${config.text} flex items-center gap-1`}>
          {config.icon} {config.label}
        </span>
        {lastPing && serverStatus === "online" && (
          <span className="text-xs text-gray-500">({lastPing})</span>
        )}
        <button onClick={checkServerHealth} className="text-xs text-blue-400 hover:text-blue-300 ml-1 p-1 hover:bg-white/10 rounded">
          <FaSync className={serverStatus === "checking" ? "animate-spin" : ""} />
        </button>
      </div>
    );
  };

  // ================================================================
  // ✅ Render
  // ================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        <header className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">📢 FCM Broadcast</h1>
              <p className="text-sm text-gray-400 mt-1">
                Firebase Cloud Messaging Only
              </p>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-lg shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <FaServer className="text-gray-400" />
                <ServerStatusBadge />
              </div>
              <p className="text-xs text-gray-500 truncate max-w-xs">{BACKEND_URL}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70 flex items-center gap-1">
                <FaBell className="text-blue-400" /> Total
              </p>
              <p className="text-2xl font-bold mt-1">{stats.totalPushTokens}</p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70 flex items-center gap-1">
                <FaAndroid className="text-green-400" /> FCM Enabled
              </p>
              <p className="text-2xl font-bold text-green-300 mt-1">{stats.enabledPushTokens}</p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70 flex items-center gap-1">
                <FaUsers className="text-blue-400" /> Users
              </p>
              <p className="text-2xl font-bold text-blue-300 mt-1">{stats.userTokens}</p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70">👤 Guests</p>
              <p className="text-2xl font-bold text-amber-300 mt-1">{stats.guestTokens}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          
          {/* Compose */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="text-xl font-semibold mb-4">✍️ Compose Message</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Eid Offer - 40% off"
                  maxLength={100}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{title.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Body *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g., Use code EID40..."
                  rows={5}
                  maxLength={500}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{body.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Open Screen</label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white focus:ring-2 focus:ring-blue-400"
                >
                  <option value="home">🏠 Home</option>
                  <option value="cart">🛒 Cart</option>
                  <option value="account">👤 Account</option>
                  <option value="orders">📦 Orders</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={sendNotificationToAll}
                  disabled={loading || !title.trim() || !body.trim()}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold ${
                    loading || !title.trim() || !body.trim()
                      ? "bg-gray-600 opacity-60 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  }`}
                >
                  {loading ? (
                    <>
                      <FaSync className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FaAndroid />
                      Send to {stats.enabledPushTokens} devices
                    </>
                  )}
                </button>

                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  <FaSync />
                </button>
              </div>

              {status && (
                <div className={`rounded-xl p-4 text-sm font-medium ${
                  status.includes("✅") ? "bg-green-500/20 border border-green-500/50 text-green-300" :
                  "bg-red-500/20 border border-red-500/50 text-red-300"
                }`}>
                  {status}
                </div>
              )}
            </div>

            {/* Templates */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <h3 className="text-sm font-semibold mb-3">📝 Quick Templates</h3>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFICATION_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => useTemplate(t)}
                    disabled={loading}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 text-left"
                  >
                    <span className="block truncate font-semibold">{t.title}</span>
                    <span className="block text-gray-400 truncate text-[10px] mt-1">
                      {t.body.substring(0, 40)}...
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FaHistory /> Recent Broadcasts
            </h2>
            
            {notificationHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FaBell className="text-5xl mx-auto mb-4 opacity-30" />
                <p>No broadcasts yet</p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {notificationHistory.map((item) => (
                  <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                    <div className="flex justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-white truncate">{item.title}</p>
                        <p className="text-sm text-gray-300 line-clamp-2 mt-1">{item.body}</p>
                        
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                            📤 {item.totalSent || 0} sent
                          </span>
                          {item.invalidTokensRemoved > 0 && (
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">
                              🗑️ {item.invalidTokensRemoved}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => deleteFromHistory(item.id)}
                        className="text-red-400 hover:bg-red-500/20 p-2 rounded-lg"
                      >
                        <FaTrash />
                      </button>
                    </div>
                    
                    <p className="mt-3 text-xs text-gray-500">
                      🕐 {item.sentAt?.toDate?.()?.toLocaleString() || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-gray-500 pt-6 border-t border-white/10">
          <p>Backend: <code className="bg-white/10 px-2 py-1 rounded">{BACKEND_URL}</code></p>
          <p className="mt-2">
            <FaAndroid className="inline text-green-400" /> FCM Only • No Expo Errors
          </p>
        </footer>
      </div>
    </div>
  );
}