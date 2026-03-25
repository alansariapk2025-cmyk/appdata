import React from "react";
import {
  FaHome,
  FaBoxOpen,
  FaList,
  FaTags,
  FaStore,
  FaClipboardList,
  FaMoneyBillWave,
  FaUsers,
  FaBell,
  FaDatabase,
  FaChartLine,
  FaImage, // ✅ New icon for Banners
} from "react-icons/fa";

export default function Sidebar({ activeTab, onTabChange, isAdmin }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <FaHome /> },
    { id: "product", label: "Add Product", icon: <FaBoxOpen /> },
    { id: "productList", label: "Product List", icon: <FaList /> },
    { id: "category", label: "Categories", icon: <FaTags /> },
    { id: "shop", label: "Shops", icon: <FaStore /> },
    { id: "orders", label: "Orders", icon: <FaClipboardList /> },
    { id: "newOrders", label: "New Orders", icon: <FaBell /> },
    { id: "payments", label: "Payments", icon: <FaMoneyBillWave /> },
    { id: "customers", label: "Customers", icon: <FaUsers /> },
    { id: "orderReport", label: "Order Report", icon: <FaChartLine /> },
    { id: "notifications", label: "Send Notification", icon: <FaBell /> },
    { id: "backup", label: "Backup", icon: <FaDatabase /> },
    { id: "banners", label: "Banners", icon: <FaImage /> },
  ];

  if (isAdmin) {
    menuItems.push({ id: "adminUsers", label: "Admin Users", icon: <FaUsers /> });
  }


  return (
    <aside className="w-64 bg-gradient-to-b from-blue-700 to-blue-900 text-white flex flex-col shadow-lg">
      <div className="text-center py-6 border-b border-blue-600">
        <h1 className="text-2xl font-bold">🛒 Admin Panel</h1>
        <p className="text-sm text-blue-200 mt-1">Grocery Wholesale</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-all ${
              activeTab === item.id
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-blue-600 text-blue-100"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="p-4 text-center text-sm text-blue-200 border-t border-blue-600">
        © 2025-2026 Ansari Grocery
      </footer>
    </aside>
  );
}
