// 📄 File: SendNotificationScreen.jsx
// ✅ Admin panel - sends to push_tokens collection (includes guest + users)

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
  where,
} from "firebase/firestore";

import { FaHistory, FaTrash, FaUsers, FaBell, FaUserCheck } from "react-icons/fa";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
];

const ACTION_ROUTES = {
  home: "/home",
  cart: "/cart",
  account: "/account",
  orders: "/account/OrderHistoryScreen",
};

export default function SendNotificationScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedAction, setSelectedAction] = useState("home");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [stats, setStats] = useState({
    totalPushTokens: 0,
    enabledPushTokens: 0,
    guestTokens: 0,
    userTokens: 0,
    totalUsers: 0,
  });

  // ✅ Load stats from push_tokens collection
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch from push_tokens collection
        const pushTokensSnapshot = await getDocs(collection(db, "push_tokens"));
        const usersSnapshot = await getDocs(collection(db, "users"));

        let enabledPushTokens = 0;
        let guestTokens = 0;
        let userTokens = 0;

        pushTokensSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.expoPushToken && data?.pushEnabled === true) {
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
      } catch (err) {
        console.warn("Failed to load stats:", err);
      }
    };

    fetchStats();
  }, []);

  // ✅ Notification history live listener
  useEffect(() => {
    const q = query(
      collection(db, "notification_history"),
      orderBy("sentAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotificationHistory(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => console.warn("Notification history listener error:", err)
    );

    return () => unsub();
  }, []);

  // ✅ Send Broadcast Function
  const sendNotificationToAll = async () => {
    if (!title.trim() || !body.trim()) {
      alert("Enter title & body");
      return;
    }

    setLoading(true);
    setStatus("🚀 Sending notification...");

    try {
      const link = ACTION_ROUTES[selectedAction] || "/home";

      const response = await fetch(`${BACKEND_URL}/send-broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          link,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Push server failed");
      }

      const totalSent = result.totalTokens ?? 0;
      const invalidRemoved = result.invalidTokensRemoved ?? 0;

      setStatus(
        `✅ Sent to ${totalSent} users` +
          (invalidRemoved > 0 ? ` (${invalidRemoved} invalid removed)` : "")
      );
      setTitle("");
      setBody("");

      // Refresh stats
      const pushTokensSnapshot = await getDocs(collection(db, "push_tokens"));
      let enabledPushTokens = 0;
      let guestTokens = 0;
      let userTokens = 0;

      pushTokensSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.expoPushToken && data?.pushEnabled === true) {
          enabledPushTokens++;
          if (data?.isGuest === true) guestTokens++;
          else userTokens++;
        }
      });

      setStats((prev) => ({
        ...prev,
        totalPushTokens: pushTokensSnapshot.size,
        enabledPushTokens,
        guestTokens,
        userTokens,
      }));

      setTimeout(() => setStatus(""), 5000);
    } catch (error) {
      console.error("Broadcast error:", error);
      setStatus(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Use Template
  const useTemplate = (template) => {
    setTitle(template.title);
    setBody(template.body);
    setSelectedAction(template.action);
  };

  // ✅ Delete History
  const deleteFromHistory = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    await deleteDoc(doc(db, "notification_history", id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">📢 Broadcast Notifications</h1>
            <p className="text-sm text-gray-400">
              Send notifications to all users (logged-in + guests) who enabled push.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70 flex items-center gap-1">
                <FaBell /> Total Tokens
              </p>
              <p className="text-xl font-semibold">{stats.totalPushTokens}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70 flex items-center gap-1">
                <FaUserCheck /> Push Enabled
              </p>
              <p className="text-xl font-semibold text-emerald-300">
                {stats.enabledPushTokens}
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70">Logged-in Users</p>
              <p className="text-xl font-semibold text-blue-300">{stats.userTokens}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-lg">
              <p className="text-xs text-white/70">Guest Users</p>
              <p className="text-xl font-semibold text-amber-300">{stats.guestTokens}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          {/* Compose Section */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="text-xl font-semibold mb-4">✍️ Compose message</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: Eid Offer - 40% off"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Example: Use code EID40 to save on your next order!"
                  rows={4}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Where the user should land
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="home">Home</option>
                  <option value="cart">Cart</option>
                  <option value="account">Account</option>
                  <option value="orders">Orders</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={sendNotificationToAll}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send broadcast"}
                </button>

                {status && (
                  <span className="text-sm text-gray-300">{status}</span>
                )}
              </div>
            </div>

            {/* Templates */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white/80 mb-2">
                Quick templates
              </h3>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => useTemplate(t)}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-white/10"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FaHistory /> Recent broadcasts
            </h2>
            {notificationHistory.length === 0 ? (
              <p className="text-gray-400">
                No history yet — send one to see it here.
              </p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {notificationHistory.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-gray-300">{item.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Sent to: {item.totalSent || 0} users
                          {item.invalidTokensRemoved > 0 &&
                            ` (${item.invalidTokensRemoved} invalid removed)`}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteFromHistory(item.id)}
                        className="text-sm font-medium text-red-400 hover:text-red-300"
                      >
                        <FaTrash />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {item.sentAt?.toDate
                        ? item.sentAt.toDate().toLocaleString()
                        : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}