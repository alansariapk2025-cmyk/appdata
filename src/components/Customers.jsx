import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { FaSearch } from "react-icons/fa";

const num = (v) => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0);

export default function Users() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // 🔹 Orders se customers nikaalo
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Orders fetch error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 🔹 Orders -> unique customers aggregate
  const customers = useMemo(() => {
    const map = {};

    orders.forEach((o) => {
      const createdAt = o.createdAt?.toDate
        ? o.createdAt.toDate()
        : o.createdAt?.seconds
        ? new Date(o.createdAt.seconds * 1000)
        : new Date();

      // key by userId, otherwise email, otherwise phone
      const key = o.userId || o.email || o.customerPhone || o.phone;
      if (!key) return;

      if (!map[key]) {
        map[key] = {
          id: key,
          name: o.customerName || o.userName || "—",
          email: o.email || "—",
          phone: o.customerPhone || o.phone || "—",
          address: o.customerAddress || o.address || "—",
          status: "Active",
          ordersCount: 0,
          totalSpent: 0,
          lastOrderAt: createdAt,
        };
      }

      map[key].ordersCount += 1;
      map[key].totalSpent += num(o.grandTotal ?? o.total ?? 0);
      if (createdAt > map[key].lastOrderAt) {
        map[key].lastOrderAt = createdAt;
      }
    });

    return Object.values(map);
  }, [orders]);

  // 🔹 Filter + search
  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return customers;

    return customers.filter((u) => {
      return (
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.phone.toLowerCase().includes(s) ||
        u.address.toLowerCase().includes(s)
      );
    });
  }, [customers, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-xl w-full max-w-7xl mx-auto overflow-auto border border-blue-200 backdrop-blur-md">
      <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">
        👥 Customers (from Orders)
      </h2>

      {/* 🔍 Search */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
          <FaSearch className="text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone, address..."
            className="outline-none bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="text-sm text-gray-600">
          Total customers: {customers.length}
        </span>
      </div>

      {/* 📋 Table */}
      {loading ? (
        <div className="text-center text-gray-600 py-10 text-lg animate-pulse">
          Loading customers...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl shadow-lg">
            <table className="w-full text-sm text-left text-gray-800">
              <thead className="bg-blue-200/70 text-blue-900 font-semibold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Total Spent</th>
                  <th className="p-3">Last Order</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {current.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center p-6 text-gray-500">
                      💭 No customers found.
                    </td>
                  </tr>
                ) : (
                  current.map((user, index) => (
                    <tr
                      key={user.id}
                      className="border-t border-blue-100 hover:bg-blue-50/70 transition"
                    >
                      <td className="p-3">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="p-3">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">{user.phone}</td>
                      <td className="p-3">{user.address}</td>
                      <td className="p-3 font-semibold">{user.ordersCount}</td>
                      <td className="p-3 font-semibold text-green-700">
                        PKR {user.totalSpent.toLocaleString()}
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {user.lastOrderAt.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center mt-4 gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}