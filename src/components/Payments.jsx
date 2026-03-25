// src/pages/Payments.jsx
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { FaTrash, FaFileInvoice, FaSearch } from "react-icons/fa";
import jsPDF from "jspdf";
import "jspdf-autotable";
import JsBarcode from "jsbarcode";
import "../fonts/NotoNastaliqUrdu-Bold-normal";

const num = (v) =>
  typeof v === "number" && !isNaN(v) ? v : Number(v) || 0;

export default function Payments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  // 🔹 Realtime Fetch Orders (latest first)
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allOrders = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setOrders(allOrders);
        setLoading(false);
      },
      (err) => {
        console.error("Orders fetch error:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 🔹 Filter + Search (fast via useMemo)
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((o) => {
      const st = String(o.status || "Pending").toLowerCase();
      if (statusFilter !== "All" && st !== statusFilter.toLowerCase()) {
        return false;
      }

      if (!term) return true;

      const orderId = (o.orderId || o.id || "").toLowerCase();
      const name = (o.customerName || o.name || "").toLowerCase();
      const phone = (o.customerPhone || o.phone || "").toLowerCase();
      const email = (o.email || "").toLowerCase();

      return (
        orderId.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        email.includes(term)
      );
    });
  }, [orders, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  // 🔹 Delete Order
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await deleteDoc(doc(db, "orders", id));
    } catch (err) {
      console.error("Error deleting order:", err);
    }
  };

  // 🔹 Update Status
  const handleStatusChange = async (id, status) => {
    try {
      await updateDoc(doc(db, "orders", id), {
        status,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // 🔹 Generate Invoice PDF with Urdu Support
  const handleInvoice = (order) => {
    try {
      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [80, 220],
      });

      let y = 8;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const leftPadding = 4;
      const rightPadding = pageWidth - 4;
      const lineHeight = 4;

      // ✅ Check available fonts
      console.log("Available fonts:", pdf.getFontList());

      // Header - English
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("ANSARI TRADERS", pageWidth / 2, y, { align: "center" });
      y += 5;

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Korangi, Karachi - Pakistan", pageWidth / 2, y, {
        align: "center",
      });
      y += lineHeight;
      pdf.text("Phone: 0213-5041666", pageWidth / 2, y, { align: "center" });
      y += 6;

      // Title
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("SALE RECEIPT", pageWidth / 2, y, { align: "center" });
      y += 3;
      pdf.line(4, y, pageWidth - 4, y);
      y += 5;

      // Date
      const createdAt = order.createdAt?.toDate
        ? order.createdAt.toDate()
        : order.createdAt?.seconds
        ? new Date(order.createdAt.seconds * 1000)
        : new Date();

      const dateStr = createdAt.toLocaleString("en-PK", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Customer Info Section
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Invoice: ${order.orderId || "000"}`, leftPadding, y);
      y += lineHeight;
      pdf.text(
        `Customer: ${order.customerName || order.name || "-"}`,
        leftPadding,
        y
      );
      y += lineHeight;

      // Address
      const addr = order.customerAddress || order.address || "-";
      const addressLines = pdf.splitTextToSize(
        `Address: ${addr}`,
        pageWidth - 8
      );
      addressLines.forEach((line) => {
        pdf.text(line, leftPadding, y);
        y += lineHeight;
      });

      pdf.text(
        `Phone: ${order.customerPhone || order.phone || "-"}`,
        leftPadding,
        y
      );
      y += lineHeight;
      pdf.text(`Payment: ${order.paymentMethod || "-"}`, leftPadding, y);
      y += lineHeight;
      pdf.text(`Type: ${order.deliveryType || "-"}`, leftPadding, y);
      y += lineHeight;
      pdf.text(`Time: ${dateStr}`, leftPadding, y);
      y += lineHeight;

      pdf.line(4, y, pageWidth - 4, y);
      y += 4;

      // ✅ Items Table Header
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text("Item", leftPadding, y);
      pdf.text("Qty", 42, y);
      pdf.text("Rate", 52, y);
      pdf.text("Amt", 66, y);
      y += 3;
      pdf.line(4, y, pageWidth - 4, y);
      y += 4;

      // ✅ Items Table Body - Manual rendering for Urdu support
      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item) => {
        const price = num(item?.price);
        const qty = num(item?.qty);
        const amount = (price * qty).toFixed(0);

        // Get English and Urdu names
        const nameEn = item?.nameEn || item?.name || "-";
        const nameUrdu = item?.nameUrdu || "";

        // ✅ Print English Name
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);

        const maxNameWidth = 36;
        const nameLines = pdf.splitTextToSize(nameEn, maxNameWidth);

        nameLines.forEach((line, idx) => {
          pdf.text(line, leftPadding, y);
          // Only show qty, rate, amount on first line
          if (idx === 0) {
            pdf.text(String(qty), 42, y);
            pdf.text(price.toFixed(0), 52, y);
            pdf.text(amount, 66, y);
          }
          y += lineHeight;
        });

        // ✅ Print Urdu Name (if exists) - RTL
        if (nameUrdu && nameUrdu.trim() !== "") {
          try {
            pdf.setFont("NotoNastaliqUrdu-Bold", "normal");
            pdf.setFontSize(9);
            // Right-to-left text - align right
            pdf.text(nameUrdu, rightPadding - 4, y, { align: "right" });
            y += lineHeight + 2;
          } catch (fontError) {
            console.warn("Urdu font error:", fontError);
            // Fallback to showing in brackets
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(6);
            pdf.text(`(${nameUrdu})`, leftPadding, y);
            y += lineHeight;
          }
        }

        y += 1; // Small gap between items
      });

      pdf.line(4, y, pageWidth - 4, y);
      y += 5;

      // Totals Section
      const sub = num(order.subtotal ?? order.total ?? 0);
      const del = num(order.deliveryCharge ?? 0);
      const grand = num(order.grandTotal ?? sub + del);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(`Subtotal: Rs.${sub.toLocaleString()}`, leftPadding, y);
      y += lineHeight;
      pdf.text(`Delivery: Rs.${del.toLocaleString()}`, leftPadding, y);
      y += lineHeight;
      pdf.setFontSize(9);
      pdf.text(`TOTAL: Rs.${grand.toLocaleString()}`, leftPadding, y);
      y += 8;

      // Barcode
      try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, order.orderId || "000", {
          format: "CODE128",
          width: 1,
          height: 18,
          displayValue: false,
        });
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          (pageWidth - 36) / 2,
          y,
          36,
          9
        );
        y += 12;
      } catch (barcodeError) {
        console.warn("Barcode generation error:", barcodeError);
        y += 5;
      }

      // Footer
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      const footerText =
        "Please check your order before leaving. No return without receipt.";
      pdf.text(footerText, pageWidth / 2, y, {
        align: "center",
        maxWidth: pageWidth - 10,
      });
      y += 8;

      pdf.setFontSize(7);
      pdf.text("Thanks for shopping with us!", pageWidth / 2, y, {
        align: "center",
      });
      y += 4;
      pdf.text("Visit Again!", pageWidth / 2, y, { align: "center" });

      pdf.save(`Invoice_${order.orderId || "000"}.pdf`);
    } catch (err) {
      console.error("Error generating invoice:", err);
      alert("Invoice generation failed: " + err.message);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-xl w-full max-w-7xl mx-auto overflow-auto border border-blue-200 backdrop-blur-md">
      <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">
        Orders & Payments
      </h2>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
          <FaSearch className="text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or order ID..."
            className="outline-none bg-transparent w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border rounded-lg shadow-sm bg-white"
        >
          <option value="All">All</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Delivered">Delivered</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-gray-600 py-10 text-lg animate-pulse">
          Loading payments...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl shadow-lg">
            <table className="w-full text-sm text-left text-gray-800">
              <thead className="bg-blue-200/70 text-blue-900 font-semibold">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {current.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-6 text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  current.map((o, i) => {
                    const createdAt = o.createdAt?.toDate
                      ? o.createdAt.toDate()
                      : o.createdAt?.seconds
                      ? new Date(o.createdAt.seconds * 1000)
                      : null;
                    const date = createdAt
                      ? createdAt.toLocaleString("en-PK", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    const sub = num(o.subtotal ?? o.total ?? 0);
                    const del = num(o.deliveryCharge ?? 0);
                    const grand = num(o.grandTotal ?? sub + del);

                    return (
                      <tr
                        key={o.id}
                        className="border-t border-blue-100 hover:bg-blue-50/70 transition"
                      >
                        <td className="p-3 font-semibold text-gray-800">
                          {o.orderId || `ORD-${String(i + 1).padStart(3, "0")}`}
                        </td>
                        <td className="p-3">
                          {o.customerName || o.name || "—"}
                        </td>
                        <td className="p-3">
                          {o.customerPhone || o.phone || "—"}
                        </td>
                        <td className="p-3 font-semibold text-green-700">
                          Rs.{grand.toLocaleString()}
                        </td>
                        <td className="p-3">{o.paymentMethod || "—"}</td>
                        <td className="p-3">{o.deliveryType || "-"}</td>
                        <td className="p-3">
                          <select
                            value={o.status || "Pending"}
                            onChange={(e) =>
                              handleStatusChange(o.id, e.target.value)
                            }
                            className={`border px-2 py-1 rounded text-sm font-semibold ${
                              o.status === "Paid"
                                ? "bg-green-100 text-green-800"
                                : o.status === "Delivered"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </td>
                        <td className="p-3">{date}</td>
                        <td className="p-3 text-center flex gap-2 justify-center">
                          <button
                            onClick={() => handleInvoice(o)}
                            className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm flex items-center gap-1"
                          >
                            <FaFileInvoice /> Invoice
                          </button>
                          <button
                            onClick={() => handleDelete(o.id)}
                            className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm flex items-center gap-1"
                          >
                            <FaTrash /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center mt-4 gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}