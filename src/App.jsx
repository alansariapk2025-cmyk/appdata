// src/App.jsx
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Dashboard from "./components/dashboard/Dashboard";
import AddProduct from "./components/AddProduct";
import ProductList from "./components/ProductList";
import PriceManagement from "./components/PriceManagement"; // ✅ NEW
import AddCategory from "./components/AddCategory";
import AddShop from "./components/layout/AddShop";
import Orders from "./components/Orders";
import NewOrders from "./components/NewOrders";
import Payments from "./components/Payments";
import Customers from "./components/Customers";
import Backup from "./pages/Backup";
import SendNotificationScreen from "./components/SendNotificationScreen";
import OrderReportAdvanced from "./components/OrderReportAdvanced";
import AdminBanner from "./components/AdminBanner";
import AdminUsers from "./components/AdminUsers";
import AuthScreen from "./components/AuthScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminCheckMessage, setAdminCheckMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          const adminDoc = await getDoc(doc(db, "admins", currentUser.uid));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            const isAdminUser = adminData?.role === "admin" || adminData?.role === "superadmin";
            const isSuperAdminUser = adminData?.role === "superadmin";
            setIsAdmin(isAdminUser);
            setIsSuperAdmin(isSuperAdminUser);
            setAdminCheckMessage(isAdminUser ? "Admin verified" : "Not an admin account");
          } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setAdminCheckMessage("Not an admin account");
          }
        } catch (error) {
          console.error("Admin validate error:", error);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminCheckMessage("Unable to validate admin role");
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminCheckMessage("");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">⏳ Checking login status...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-3">Access Denied</h1>
          <p className="text-gray-600 mb-2">This account is not registered as an admin.</p>
          <p className="text-sm text-gray-500 mb-6">Contact the super-admin to get admin access.</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500"><strong>Email:</strong> {user.email}</p>
            <p className="text-xs text-gray-500"><strong>Status:</strong> {adminCheckMessage}</p>
          </div>
          <button onClick={async () => await signOut(auth)} className="w-full rounded-xl bg-red-600 px-4 py-3 text-white font-semibold hover:bg-red-700 transition">
            Sign Out & Try Another Account
          </button>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard />;
      case "product": return <AddProduct />;
      case "productList": return <ProductList />;
      case "priceManagement": return <PriceManagement />; // ✅ NEW
      case "category": return <AddCategory />;
      case "shop": return <AddShop />;
      case "orders": return <Orders onNavigate={setActiveTab} />;
      case "newOrders": return <NewOrders onNavigate={setActiveTab} />;
      case "payments": return <Payments />;
      case "customers": return <Customers />;
      case "backup": return <Backup />;
      case "notifications": return <SendNotificationScreen />;
      case "orderReport": return <OrderReportAdvanced />;
      case "banners": return <AdminBanner />;
      case "adminUsers": return <AdminUsers isSuperAdmin={isSuperAdmin} currentUser={user} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
      <div className="flex-1 flex flex-col">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={() => signOut(auth)} isSuperAdmin={isSuperAdmin} />
        <main className="flex-1 p-6 overflow-y-auto">{renderScreen()}</main>
      </div>
    </div>
  );
}