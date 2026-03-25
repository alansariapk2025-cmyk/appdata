// 📄 File: AdminUsers.jsx
// ✅ Admin Users Management - Create, View, Delete Admins

import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

const BACKEND_URL = "http://localhost:5000";

export default function AdminUsers() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [hasDemoAdmin, setHasDemoAdmin] = useState(false);

  // Get current user email
  useEffect(() => {
    if (auth.currentUser) {
      setCurrentUserEmail(auth.currentUser.email || "");
    }
  }, []);

  // Load admins list
  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const adminsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAdmins(adminsList);
      
      // Check if demo admin exists
      const demoExists = adminsList.some((admin) => admin.isDemo === true);
      setHasDemoAdmin(demoExists);
    } catch (error) {
      console.log("Error loading admins:", error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  // Create new admin
  const createAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Validation
      if (!fullName.trim()) {
        throw new Error("Full name is required.");
      }
      if (!email.trim()) {
        throw new Error("Email is required.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      // Check if email already exists
      const existingAdmin = admins.find(
        (a) => a.email?.toLowerCase() === email.trim().toLowerCase()
      );
      if (existingAdmin) {
        throw new Error("An admin with this email already exists.");
      }

      const response = await fetch(`${BACKEND_URL}/create-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create admin account");
      }

      setMessage(`✅ Admin "${fullName.trim()}" created successfully!`);
      setFullName("");
      setEmail("");
      setPassword("");
      
      // Reload admins list
      await loadAdmins();
      
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete admin (only demo admin can be deleted by regular admin)
  const deleteAdmin = async (adminId, adminEmail, isDemo) => {
    // Prevent deleting yourself
    if (adminEmail === currentUserEmail) {
      setMessage("❌ You cannot delete your own account.");
      return;
    }

    // Only allow deleting demo admin
    if (!isDemo) {
      setMessage("❌ Only demo admin accounts can be deleted from here. Contact super admin.");
      return;
    }

    if (!window.confirm(`Delete admin: ${adminEmail}?\n\nThis will remove the demo account.`)) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "admins", adminId));
      
      // Try to delete from Auth via server (optional - may fail if no server endpoint)
      try {
        await fetch(`${BACKEND_URL}/delete-admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: adminId }),
        });
      } catch (e) {
        console.log("Server delete skipped:", e);
      }

      setMessage(`✅ Admin "${adminEmail}" deleted.`);
      await loadAdmins();
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            👥 Admin Users Management
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Create and manage admin accounts for the control panel.
          </p>
        </div>

        {/* Demo Admin Warning */}
        {hasDemoAdmin && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">Demo Account Active</p>
                <p className="text-sm text-amber-700 mt-1">
                  A demo admin account exists. Create a real admin account below, then the demo account will be automatically removed.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* Create Admin Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              ➕ Create New Admin
            </h2>

            <form onSubmit={createAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="admin@company.com"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password * (min 6 characters)
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all"
              >
                {loading ? "🔄 Creating..." : "Create Admin Account"}
              </button>
            </form>

            {/* Status Message */}
            {message && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${
                message.startsWith("✅")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Admins List */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              📋 Existing Admins
              <span className="text-sm font-normal text-slate-500">
                ({admins.length})
              </span>
            </h2>

            {loadingAdmins ? (
              <div className="text-center py-8 text-slate-500">
                🔄 Loading admins...
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No admin accounts yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className={`rounded-xl border p-4 flex items-center justify-between ${
                      admin.isDemo
                        ? "bg-amber-50 border-amber-200"
                        : admin.email === currentUserEmail
                        ? "bg-blue-50 border-blue-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 truncate">
                          {admin.fullName || "Unnamed"}
                        </p>
                        {admin.isDemo && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                            DEMO
                          </span>
                        )}
                        {admin.email === currentUserEmail && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded-full">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {admin.email}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Created: {admin.createdAt?.toDate?.()?.toLocaleDateString() || "—"}
                      </p>
                    </div>

                    {/* Delete Button - Only for demo admin */}
                    {admin.isDemo && admin.email !== currentUserEmail && (
                      <button
                        onClick={() => deleteAdmin(admin.id, admin.email, admin.isDemo)}
                        className="ml-3 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3">ℹ️ How it works</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span>1️⃣</span>
              <span>First time: Demo admin account is created automatically.</span>
            </li>
            <li className="flex items-start gap-2">
              <span>2️⃣</span>
              <span>Login with demo credentials and come to this page.</span>
            </li>
            <li className="flex items-start gap-2">
              <span>3️⃣</span>
              <span>Create a real admin account with your email.</span>
            </li>
            <li className="flex items-start gap-2">
              <span>4️⃣</span>
              <span>Demo account is automatically deleted when first real admin is created.</span>
            </li>
            <li className="flex items-start gap-2">
              <span>5️⃣</span>
              <span>Now only real admin accounts can login.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}