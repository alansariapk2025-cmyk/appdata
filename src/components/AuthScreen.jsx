// 📄 File: AuthScreen.jsx
// ✅ Admin Login - Demo account only for first time setup

import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";

const BACKEND_URL = "http://localhost:5000";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initPending, setInitPending] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // ✅ Check if any real admin exists (not demo)
  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        // Check for any non-demo admin
        const adminsSnap = await getDocs(collection(db, "admins"));
        
        let hasRealAdmin = false;
        let hasDemoAdmin = false;

        adminsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.isDemo === true) {
            hasDemoAdmin = true;
          } else {
            hasRealAdmin = true;
          }
        });

        if (hasRealAdmin) {
          // Real admin exists - normal login mode
          setIsFirstTimeSetup(false);
          setSetupComplete(true);
        } else if (hasDemoAdmin) {
          // Only demo admin exists - show demo login
          setIsFirstTimeSetup(true);
          setSetupComplete(false);
          setEmail("demo.admin@ansari.com");
          setPassword("Demo1234");
        } else {
          // No admin at all - first time setup
          setIsFirstTimeSetup(true);
          setSetupComplete(false);
        }
      } catch (error) {
        console.log("Error checking admin setup:", error);
        setIsFirstTimeSetup(true);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkAdminExists();
  }, []);

  // ✅ Create demo admin (only for first time)
  const createDemoAdmin = async () => {
    setInitPending(true);
    setMessage("🔧 Creating demo admin account...");
    
    try {
      const response = await fetch(`${BACKEND_URL}/init-demo-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create demo admin");
      }
      
      setMessage(`✅ Demo account created!\nEmail: ${data.email}\nPassword: ${data.password}`);
      setEmail(data.email);
      setPassword(data.password);
      setIsFirstTimeSetup(true);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setInitPending(false);
    }
  };

  // ✅ Login handler
  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      
      // Verify user is in admins collection
      const adminsSnap = await getDocs(
        query(collection(db, "admins"), where("email", "==", trimmedEmail))
      );

      if (adminsSnap.empty) {
        await auth.signOut();
        setMessage("❌ You are not authorized as an admin.");
        return;
      }

      const adminData = adminsSnap.docs[0].data();
      
      if (adminData.isDemo) {
        setMessage("✅ Logged in with demo account. Please create a real admin account from Admin Users section.");
      } else {
        setMessage("✅ Logged in successfully.");
      }
      
    } catch (error) {
      console.log("Login error:", error.code);
      
      if (
        error.code === "auth/invalid-email" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        if (isFirstTimeSetup && !setupComplete) {
          setMessage("⚠️ Demo account not found. Click 'Initialize Demo Admin' button.");
        } else {
          setMessage("❌ Invalid email or password.");
        }
      } else {
        setMessage(`❌ ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-white text-lg">🔄 Checking admin setup...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 text-slate-800">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">🔐 Admin Login</h1>
          <p className="text-sm text-slate-600 mt-2">
            {setupComplete 
              ? "Sign in to access admin control panel." 
              : "First time setup - Initialize demo account"}
          </p>
        </div>

        {/* First Time Setup Banner */}
        {isFirstTimeSetup && !setupComplete && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ First Time Setup
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Click the button below to create a demo admin account. After login, create a real admin account from Admin Users section.
            </p>
            
            <button
              onClick={createDemoAdmin}
              disabled={initPending}
              className="mt-3 w-full rounded-xl bg-amber-500 text-white py-2 font-semibold hover:bg-amber-600 disabled:opacity-70 transition-all"
            >
              {initPending ? "🔄 Creating Demo Admin..." : "🚀 Initialize Demo Admin"}
            </button>
            
            <div className="mt-3 text-xs text-amber-700 bg-amber-100 rounded-lg p-2">
              <strong>Demo Credentials:</strong><br />
              Email: demo.admin@ansari.com<br />
              Password: Demo1234
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={submitLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-70 transition-all"
          >
            {loading ? "🔄 Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Info Text */}
        {setupComplete && (
          <div className="mt-4 text-center text-xs text-gray-500">
            Contact super admin if you need access.
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${
            message.startsWith("✅") 
              ? "bg-green-50 text-green-700 border border-green-200" 
              : message.startsWith("⚠️")
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}