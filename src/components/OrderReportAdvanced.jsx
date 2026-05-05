// src/pages/OrderReportAdvanced.jsx
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Bar, Pie } from "react-chartjs-2";
import "chart.js/auto";
import { saveAs } from "file-saver";
import { Workbook } from "exceljs";

const num = (v) =>
  typeof v === "number" && !isNaN(v) ? v : Number(v) || 0;

export default function OrderReportAdvanced() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [chartData, setChartData] = useState({});
  const [categoryData, setCategoryData] = useState({});
  const [topProducts, setTopProducts] = useState([]);
  const [timeFilter, setTimeFilter] = useState("daily");

  const [page, setPage] = useState(1);
  const perPage = 10;

  // 🔹 Fetch orders
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(data);
      },
      (err) => {
        console.warn("Order report listener error:", err);
      }
    );
    return () => unsub();
  }, []);

  // 🔹 Map orders to consistent structure (memoized)
  const mappedOrders = useMemo(
    () =>
      orders.map((o) => {
        const sub = num(o.subtotal ?? o.total ?? 0);
        const del = num(o.deliveryCharge ?? 0);
        const grand = num(o.grandTotal ?? sub + del);

        const date =
          o.createdAt?.toDate?.() ||
          (o.createdAt?.seconds
            ? new Date(o.createdAt.seconds * 1000)
            : new Date());

        const firstItem =
          o.items && o.items.length > 0 ? o.items[0] : null;

        return {
          id: o.orderId || o.id,
          customerName:
            o.customerName || o.name || "Unknown",
          category:
            firstItem?.nameEn ||
            firstItem?.name ||
            "-",
          total: grand,
          cost: sub,
          profit: grand - sub,
          date,
          status: o.status || "Pending",
          deliveryCharge: del,
          paymentMethod: o.paymentMethod || "N/A",
          address:
            o.customerAddress || o.address || "N/A",
          phone:
            o.customerPhone || o.phone || "N/A",
          items: o.items || [],
        };
      }),
    [orders]
  );

  // 🔹 Filter, search & calculate stats
  useEffect(() => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const filtered = mappedOrders.filter((o) => {
      const term = search.toLowerCase();

      const matchesSearch =
        !term ||
        o.id.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        o.category.toLowerCase().includes(term) ||
        o.phone.toLowerCase().includes(term);

      return (
        matchesSearch &&
        (!from || o.date >= from) &&
        (!to || o.date <= to)
      );
    });

    setFilteredOrders(filtered);

    // Stats & charts
    let earnings = 0;
    let profit = 0;
    const dateMap = {};
    const categoryMap = {};
    const productMap = {};

    filtered.forEach((o) => {
      earnings += o.total;
      profit += o.profit;

      // Chart keys
      let key = "";
      if (timeFilter === "daily")
        key = o.date.toLocaleDateString();
      else if (timeFilter === "weekly") {
        const startOfWeek = new Date(o.date);
        startOfWeek.setDate(
          o.date.getDate() - o.date.getDay()
        );
        key = startOfWeek.toLocaleDateString();
      } else if (timeFilter === "monthly")
        key = `${o.date.getMonth() + 1}-${
          o.date.getFullYear()
        }`;
      else key = `${o.date.getFullYear()}`;

      dateMap[key] = (dateMap[key] || 0) + o.total;

      if (o.category)
        categoryMap[o.category] =
          (categoryMap[o.category] || 0) + o.total;

      // Top products
      o.items.forEach((item) => {
        const name = item.nameEn || item.name || "Item";
        productMap[name] =
          (productMap[name] || 0) +
          num(item.price) * num(item.qty || 1);
      });
    });

    // Charts
    setChartData({
      labels: Object.keys(dateMap),
      datasets: [
        {
          label: "Earnings",
          data: Object.values(dateMap),
          backgroundColor: "rgba(99,102,241,0.7)",
          borderColor: "rgb(99,102,241)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    });

    setCategoryData({
      labels: Object.keys(categoryMap),
      datasets: [
        {
          label: "Category Earnings",
          data: Object.values(categoryMap),
          backgroundColor: [
            "rgba(99,102,241,0.7)",
            "rgba(16,185,129,0.7)",
            "rgba(236,72,153,0.7)",
            "rgba(249,115,22,0.7)",
            "rgba(59,130,246,0.7)",
          ],
        },
      ],
    });

    // Top 5 products
    const top = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
    setTopProducts(top);

    setTotalEarnings(earnings);
    setTotalProfit(profit);
  }, [
    mappedOrders,
    fromDate,
    toDate,
    search,
    timeFilter,
  ]);

  const totalPages =
    Math.ceil(filteredOrders.length / perPage) || 1;
  const currentPageOrders = filteredOrders.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const exportExcel = async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet("Orders");
    const data = filteredOrders.map((o) => ({
      "Order ID": o.id,
      Customer: o.customerName,
      Category: o.category,
      Total: o.total,
      Cost: o.cost,
      Profit: o.profit,
      Date: o.date.toLocaleString(),
      Status: o.status,
    }));
    if (data.length > 0) {
      ws.columns = Object.keys(data[0]).map(k => ({ header: k, key: k }));
      data.forEach(row => ws.addRow(row));
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/octet-stream",
    });
    saveAs(blob, "OrderReport.xlsx");
  };

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 space-y-6">
      {/* Search & totals */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <input
          type="text"
          placeholder="Search Order ID, Customer, Category..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border p-2 rounded-lg shadow-inner w-72"
        />
        <div className="flex flex-col gap-1 text-right">
          <span className="font-bold text-lg">
            Total Earnings: PKR{" "}
            {totalEarnings.toLocaleString()}
          </span>
          <span className="font-bold text-lg text-green-700">
            Total Profit: PKR{" "}
            {totalProfit.toLocaleString()}
          </span>
        </div>
        <button
          onClick={exportExcel}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-md"
        >
          Export Excel
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white/70 backdrop-blur-md border border-red-300 p-4 rounded-2xl shadow-xl">
        <h3 className="font-bold text-lg mb-4 text-blue-700">
          Filtered Orders
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200 text-sm">
            <thead className="bg-blue-200 text-blue-900 font-semibold">
              <tr>
                <th className="border p-2">Order ID</th>
                <th className="border p-2">Customer</th>
                <th className="border p-2">Category</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">Cost</th>
                <th className="border p-2">Profit</th>
                <th className="border p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {currentPageOrders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-blue-50 transition"
                >
                  <td className="border p-2 font-semibold text-blue-600">
                    {o.id}
                  </td>
                  <td className="border p-2">
                    {o.customerName}
                  </td>
                  <td className="border p-2">
                    {o.category}
                  </td>
                  <td className="border p-2 font-semibold text-green-700">
                    {o.total}
                  </td>
                  <td className="border p-2">
                    {o.cost}
                  </td>
                  <td className="border p-2">
                    {o.profit}
                  </td>
                  <td className="border p-2">
                    {o.date.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center mt-4 gap-2">
          <button
            onClick={() =>
              setPage((p) => Math.max(p - 1, 1))
            }
            disabled={page === 1}
            className="px-3 py-1 bg-blue-500 text-white rounded-lg disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1 font-semibold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() =>
              setPage((p) =>
                Math.min(p + 1, totalPages)
              )
            }
            disabled={page === totalPages}
            className="px-3 py-1 bg-blue-500 text-white rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Filters & Charts */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="border p-2 rounded-md bg-white shadow-inner"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="border p-2 rounded-md bg-white shadow-inner"
          />
          <select
            value={timeFilter}
            onChange={(e) =>
              setTimeFilter(e.target.value)
            }
            className="border p-2 rounded-md bg-white shadow-inner"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="bg-white/70 backdrop-blur-md border border-blue-300 p-4 rounded-xl shadow-lg">
            <h3 className="font-bold mb-2 text-blue-700">
              Earnings Over Time
            </h3>
            {chartData.labels?.length > 0 ? (
              <Bar data={chartData} />
            ) : (
              <p className="text-gray-500">No data</p>
            )}
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-blue-300 p-4 rounded-xl shadow-lg">
            <h3 className="font-bold mb-2 text-blue-700">
              Earnings by Category
            </h3>
            {categoryData.labels?.length > 0 ? (
              <Pie data={categoryData} />
            ) : (
              <p className="text-gray-500">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 Products */}
      <div className="bg-white/70 backdrop-blur-md border border-green-300 p-4 rounded-2xl shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-green-700">
          Top 5 Best Earning Products
        </h3>
        <ol className="list-decimal list-inside space-y-1">
          {topProducts.map((p) => (
            <li key={p.name} className="font-semibold">
              {p.name} - PKR{" "}
              {p.total.toLocaleString()}
            </li>
          ))}
          {topProducts.length === 0 && (
            <p className="text-gray-500">
              No products sold yet
            </p>
          )}
        </ol>
      </div>
    </div>
  );
}