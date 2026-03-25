// src/components/ProductList.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { collection, collectionGroup, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import toast, { Toaster } from "react-hot-toast";
import { FaEdit, FaSave, FaTimes, FaBox, FaTrash, FaSearch, FaChevronLeft, FaChevronRight, FaFilter, FaSortAmountDown, FaSortAmountUp, FaCheckCircle, FaTimesCircle, FaDownload, FaSync, FaList, FaThLarge, FaImage, FaToggleOn, FaToggleOff, FaChartBar, FaPercent, FaRupeeSign, FaCubes, FaFire, FaRecycle, FaFileExcel, FaFileCsv, FaCloudDownloadAlt, FaCloudUploadAlt, FaCheckDouble, FaBan, FaStar, FaRegStar, FaWarehouse, FaExclamationTriangle, FaWifi } from "react-icons/fa";
import * as XLSX from "xlsx";

const num = (v) => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0);
const formatPrice = (p) => `PKR ${num(p).toLocaleString()}`;

const StatusBadge = ({ status, onChange, disabled }) => (
  <button onClick={() => onChange?.(status === "active" ? "inactive" : "active")} disabled={disabled}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 ${status === "active" ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-green-500/30" : "bg-gradient-to-r from-red-400 to-red-500 text-white shadow-red-500/30"} shadow-lg ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
    {status === "active" ? <><FaToggleOn className="w-3.5 h-3.5" /> Active</> : <><FaToggleOff className="w-3.5 h-3.5" /> Inactive</>}
  </button>
);

const StockBadge = ({ stock }) => {
  const s = num(stock);
  if (s === 0) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><FaBan className="w-3 h-3" /> Out</span>;
  if (s < 10) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700"><FaExclamationTriangle className="w-3 h-3" /> {s}</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><FaWarehouse className="w-3 h-3" /> {s}</span>;
};

export default function ProductList() {
  const [allProducts, setAllProducts] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showStats, setShowStats] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fullImage, setFullImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const fileInputRef = useRef(null);
  const searchRef = useRef(null);

  // Fetch Categories
  useEffect(() => {
    getDocs(collectionGroup(db, "categories")).then(snap => {
      const map = {};
      snap.forEach(d => map[d.id] = { id: d.id, ...d.data() });
      setCategoriesMap(map);
    }).catch(() => toast.error("Failed to load categories!"));
  }, []);

  // Real-time Products Listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(list);
      setLoading(false);
      setIsConnected(true);
      snap.docChanges().forEach(change => {
        if (change.type === "modified") {
          const p = change.doc.data();
          toast.success(`"${p.nameEn}" → ${p.status}`, { icon: p.status === "active" ? "🟢" : "🔴", duration: 2000 });
        }
      });
    }, () => { setIsConnected(false); toast.error("Connection lost!"); setLoading(false); });
    return () => unsub();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setEditProduct(null); setFullImage(null); setShowImportModal(false); setShowExportModal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(p => (p.nameEn || "").toLowerCase().includes(t) || (p.nameUr || "").toLowerCase().includes(t) || (p.categoryName || "").toLowerCase().includes(t) || (p.sku || "").toLowerCase().includes(t));
    }
    if (selectedCategory) list = list.filter(p => p.category === selectedCategory);
    if (priceRange.min) list = list.filter(p => num(p.price) >= num(priceRange.min));
    if (priceRange.max) list = list.filter(p => num(p.price) <= num(priceRange.max));
    if (stockFilter === "instock") list = list.filter(p => num(p.stock) > 0);
    else if (stockFilter === "outofstock") list = list.filter(p => num(p.stock) === 0);
    else if (stockFilter === "lowstock") list = list.filter(p => num(p.stock) > 0 && num(p.stock) < 10);
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    
    list.sort((a, b) => {
      let av, bv;
      if (sortBy === "nameEn") { av = (a.nameEn || "").toLowerCase(); bv = (b.nameEn || "").toLowerCase(); }
      else if (sortBy === "price") { av = num(a.price); bv = num(b.price); }
      else if (sortBy === "stock") { av = num(a.stock); bv = num(b.stock); }
      else { av = a.createdAt?.toDate?.()?.getTime() || 0; bv = b.createdAt?.toDate?.()?.getTime() || 0; }
      return sortOrder === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
    return list;
  }, [allProducts, searchTerm, selectedCategory, priceRange, stockFilter, statusFilter, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredProducts.length,
    active: filteredProducts.filter(p => p.status === "active").length,
    inactive: filteredProducts.filter(p => p.status !== "active").length,
    lowStock: filteredProducts.filter(p => num(p.stock) > 0 && num(p.stock) < 10).length,
    popular: filteredProducts.filter(p => p.mostPopular).length,
    totalValue: filteredProducts.reduce((s, p) => s + num(p.price) * num(p.stock), 0),
  }), [filteredProducts]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginated = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = searchTerm || selectedCategory || priceRange.min || priceRange.max || stockFilter || statusFilter;
  const mainCategories = useMemo(() => Object.values(categoriesMap).filter(c => !c.parentId), [categoriesMap]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedCategory, statusFilter, stockFilter]);

  const clearFilters = () => {
    setSearchTerm(""); setSelectedCategory(""); setPriceRange({ min: "", max: "" }); 
    setStockFilter(""); setStatusFilter(""); setPage(1);
    toast.success("Filters cleared");
  };

  // Status Toggle
  const toggleStatus = async (product) => {
    const newStatus = product.status === "active" ? "inactive" : "active";
    setUpdatingStatus(product.id);
    try {
      await updateDoc(doc(db, "products", product.id), { status: newStatus, updatedAt: serverTimestamp() });
    } catch { toast.error("Failed to update!"); }
    finally { setUpdatingStatus(null); }
  };

  // Delete
  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "products", id));
      setSelectedProducts(p => p.filter(x => x !== id));
      toast.success("Deleted!");
    } catch { toast.error("Delete failed!"); }
    finally { setDeleting(null); }
  };

  // Image Upload
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Only JPG, PNG, WEBP!");
    if (file.size > 1024 * 1024) return toast.error("Max 1MB!");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) return editProduct?.image || null;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append("image", imageFile);
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`, { method: "POST", body: fd });
      const data = await res.json();
      return data.success ? data.data.url : editProduct?.image || null;
    } catch { toast.error("Upload failed!"); return editProduct?.image || null; }
    finally { setUploadingImage(false); }
  };

  // Save Edit
  const handleSave = async () => {
    if (!editProduct) return;
    const t = toast.loading("Saving...");
    try {
      const img = await uploadImage();
      await updateDoc(doc(db, "products", editProduct.id), {
        nameEn: editProduct.nameEn || "", nameUr: editProduct.nameUr || "",
        price: num(editProduct.price), mrpPrice: num(editProduct.mrpPrice),
        discount: num(editProduct.discount), orderLimit: num(editProduct.orderLimit),
        unit: editProduct.unit || "", stock: num(editProduct.stock),
        status: editProduct.status || "inactive",
        mostPopular: editProduct.mostPopular === true || editProduct.mostPopular === "yes",
        reselling: editProduct.reselling === true || editProduct.reselling === "yes",
        category: editProduct.category || "", subcategory: editProduct.subcategory || "",
        description: editProduct.description || "", sku: editProduct.sku || "",
        image: img, updatedAt: serverTimestamp(),
      });
      toast.success("Saved!", { id: t });
      setEditProduct(null); setImageFile(null); setImagePreview(null);
    } catch { toast.error("Save failed!", { id: t }); }
  };

  // Bulk Actions
  const handleBulk = async (action) => {
    if (!selectedProducts.length) return toast.error("Select products!");
    if (!confirm(`${action} ${selectedProducts.length} products?`)) return;
    setBulkUpdating(true);
    const t = toast.loading("Processing...");
    try {
      const batch = writeBatch(db);
      selectedProducts.forEach(id => {
        const ref = doc(db, "products", id);
        if (action === "delete") batch.delete(ref);
        else batch.update(ref, { status: action === "activate" ? "active" : "inactive", updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedProducts([]);
      toast.success("Done!", { id: t });
    } catch { toast.error("Failed!", { id: t }); }
    finally { setBulkUpdating(false); }
  };

  // Export
  const exportData = (type, format) => {
    const data = (type === "all" ? allProducts : filteredProducts).map(p => ({
      "Name (EN)": p.nameEn || "", "Name (UR)": p.nameUr || "", Category: p.categoryName || "",
      "Price (PKR)": num(p.price), MRP: num(p.mrpPrice), "Discount %": num(p.discount),
      Stock: num(p.stock), Unit: p.unit || "", Status: p.status || "inactive",
      Popular: p.mostPopular ? "Yes" : "No", Reselling: p.reselling ? "Yes" : "No",
      SKU: p.sku || "", Image: p.image || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `products_${type}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } else {
      XLSX.writeFile(wb, `products_${type}_${new Date().toISOString().split("T")[0]}.xlsx`);
    }
    toast.success(`Exported ${data.length} products!`);
    setShowExportModal(false);
  };

  // Import
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const t = toast.loading("Importing...");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!data.length) return toast.error("No data!", { id: t });
        if (!confirm(`Import ${data.length} products?`)) return toast.dismiss(t);
        const batch = writeBatch(db);
        let count = 0;
        data.forEach(row => {
          const name = row.nameEn || row["Name (EN)"] || "";
          if (name) {
            batch.set(doc(collection(db, "products")), {
              nameEn: name, nameUr: row.nameUr || row["Name (UR)"] || "",
              categoryName: row.categoryName || row.Category || "",
              price: num(row.price || row["Price (PKR)"]),
              mrpPrice: num(row.mrpPrice || row.MRP),
              discount: num(row.discount || row["Discount %"]),
              stock: num(row.stock || row.Stock),
              unit: row.unit || row.Unit || "",
              status: (row.status || row.Status || "active").toLowerCase(),
              mostPopular: ["yes", "true", "1"].includes(String(row.mostPopular || row.Popular || "").toLowerCase()),
              reselling: ["yes", "true", "1"].includes(String(row.reselling || row.Reselling || "").toLowerCase()),
              sku: row.sku || row.SKU || "",
              image: row.image || row.Image || "",
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            count++;
          }
        });
        await batch.commit();
        toast.success(`Imported ${count}!`, { id: t });
        setShowImportModal(false);
      } catch { toast.error("Import failed!", { id: t }); }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ nameEn: "Product Name", nameUr: "اردو نام", categoryName: "Category", price: 100, mrpPrice: 120, discount: 10, stock: 50, unit: "kg", status: "active", mostPopular: "no", reselling: "no", sku: "SKU001", image: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "import_template.xlsx");
    toast.success("Template downloaded!");
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gradient-to-r from-blue-100 to-purple-100 animate-pulse rounded-xl" />)}
    </div>
  );

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
              <FaBox className="text-blue-600" /> Products
            </h1>
            <p className="text-gray-500 text-sm">Real-time sync enabled</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <FaWifi className="w-3 h-3" /> {isConnected ? "Live" : "Offline"}
            </div>
            <button onClick={() => setShowStats(!showStats)} className={`p-2 rounded-lg ${showStats ? "bg-blue-500 text-white" : "bg-white"} shadow`}>
              <FaChartBar className="w-4 h-4" />
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm ${showFilters || hasFilters ? "bg-blue-500 text-white" : "bg-white"} shadow`}>
              <FaFilter className="w-3 h-3" /> Filters
            </button>
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm shadow">
              <FaCloudUploadAlt className="w-4 h-4" /> Import
            </button>
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 text-white rounded-lg font-semibold text-sm shadow">
              <FaCloudDownloadAlt className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><FaCubes className="w-4 h-4 text-blue-600" /></div>
              <div><p className="text-xs text-gray-500">Total</p><p className="font-bold">{stats.total}</p></div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-3 shadow text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><FaCheckCircle className="w-4 h-4" /></div>
              <div><p className="text-xs opacity-80">Active</p><p className="font-bold">{stats.active}</p></div>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-xl p-3 shadow text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><FaBan className="w-4 h-4" /></div>
              <div><p className="text-xs opacity-80">Inactive</p><p className="font-bold">{stats.inactive}</p></div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><FaExclamationTriangle className="w-4 h-4 text-orange-600" /></div>
              <div><p className="text-xs text-gray-500">Low Stock</p><p className="font-bold text-orange-600">{stats.lowStock}</p></div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><FaFire className="w-4 h-4 text-purple-600" /></div>
              <div><p className="text-xs text-gray-500">Popular</p><p className="font-bold text-purple-600">{stats.popular}</p></div>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-3 shadow text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><FaRupeeSign className="w-4 h-4" /></div>
              <div><p className="text-xs opacity-80">Value</p><p className="font-bold text-sm">PKR {stats.totalValue.toLocaleString()}</p></div>
            </div>
          </div>
        )}

        {/* Search & Quick Filters */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input ref={searchRef} type="text" placeholder="Search... (Ctrl+F)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2"><FaTimes className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {["", "active", "inactive"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded text-xs font-semibold ${statusFilter === s ? (s === "active" ? "bg-green-500 text-white" : s === "inactive" ? "bg-red-500 text-white" : "bg-white shadow") : "text-gray-600"}`}>
                {s === "" ? "All" : s === "active" ? `🟢 Active (${stats.active})` : `🔴 Inactive (${stats.inactive})`}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="p-2.5 border rounded-lg text-sm">
            <option value="createdAt">Date</option><option value="nameEn">Name</option><option value="price">Price</option><option value="stock">Stock</option>
          </select>
          <button onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")} className="p-2.5 bg-gray-100 rounded-lg">
            {sortOrder === "asc" ? <FaSortAmountUp className="w-4 h-4" /> : <FaSortAmountDown className="w-4 h-4" />}
          </button>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="p-2.5 border rounded-lg text-sm">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-2 border rounded-lg text-sm">
              <option value="">All Categories</option>
              {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="p-2 border rounded-lg text-sm">
              <option value="">All Stock</option><option value="instock">In Stock</option><option value="lowstock">Low</option><option value="outofstock">Out</option>
            </select>
            <input type="number" placeholder="Min PKR" value={priceRange.min} onChange={(e) => setPriceRange(p => ({ ...p, min: e.target.value }))} className="p-2 border rounded-lg text-sm" />
            <input type="number" placeholder="Max PKR" value={priceRange.max} onChange={(e) => setPriceRange(p => ({ ...p, max: e.target.value }))} className="p-2 border rounded-lg text-sm" />
            {hasFilters && <button onClick={clearFilters} className="p-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"><FaTimes className="w-3 h-3" /> Clear</button>}
          </div>
        )}

        {/* Bulk Actions */}
        {selectedProducts.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-4 text-white flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold"><FaCheckDouble className="inline w-4 h-4 mr-2" />{selectedProducts.length} selected</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulk("activate")} disabled={bulkUpdating} className="px-3 py-1.5 bg-green-500 rounded-lg text-sm font-semibold">Activate</button>
              <button onClick={() => handleBulk("deactivate")} disabled={bulkUpdating} className="px-3 py-1.5 bg-orange-500 rounded-lg text-sm font-semibold">Deactivate</button>
              <button onClick={() => handleBulk("delete")} disabled={bulkUpdating} className="px-3 py-1.5 bg-red-500 rounded-lg text-sm font-semibold">Delete</button>
              <button onClick={() => setSelectedProducts([])} className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-semibold">Cancel</button>
            </div>
          </div>
        )}

        {/* Products Table/Grid */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600">Showing {paginated.length} of {filteredProducts.length}</span>
            <div className="flex gap-1 bg-gray-100 rounded p-1">
              <button onClick={() => setViewMode("table")} className={`p-1.5 rounded ${viewMode === "table" ? "bg-white shadow" : ""}`}><FaList className="w-4 h-4" /></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-white shadow" : ""}`}><FaThLarge className="w-4 h-4" /></button>
            </div>
          </div>

          {viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <tr>
                    <th className="p-3 text-left"><input type="checkbox" checked={selectedProducts.length === paginated.length && paginated.length > 0} onChange={() => setSelectedProducts(selectedProducts.length === paginated.length ? [] : paginated.map(p => p.id))} /></th>
                    <th className="p-3 text-left">Image</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Price</th>
                    <th className="p-3 text-left">Stock</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-center">Popular</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-gray-500"><FaBox className="w-12 h-12 mx-auto mb-2 text-gray-300" />No products found</td></tr>
                  ) : paginated.map((p, i) => (
                    <tr key={p.id} className={`border-b hover:bg-blue-50/50 ${selectedProducts.includes(p.id) ? "bg-blue-50" : i % 2 ? "bg-gray-50/50" : ""} ${updatingStatus === p.id ? "animate-pulse bg-yellow-50" : ""}`}>
                      <td className="p-3"><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => setSelectedProducts(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} /></td>
                      <td className="p-3">
                        {p.image ? <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:scale-110 transition" onClick={() => setFullImage(p.image)} />
                        : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><FaImage className="w-5 h-5 text-gray-400" /></div>}
                      </td>
                      <td className="p-3"><p className="font-semibold">{p.nameEn || "Unnamed"}</p>{p.nameUr && <p className="text-xs text-gray-500">{p.nameUr}</p>}</td>
                      <td className="p-3 text-gray-600">{p.categoryName || "-"}</td>
                      <td className="p-3"><span className="font-bold text-green-600">{formatPrice(p.price)}</span>{p.mrpPrice > p.price && <p className="text-xs text-gray-400 line-through">{formatPrice(p.mrpPrice)}</p>}</td>
                      <td className="p-3"><StockBadge stock={p.stock} /></td>
                      <td className="p-3"><StatusBadge status={p.status} onChange={() => toggleStatus(p)} disabled={updatingStatus === p.id} /></td>
                      <td className="p-3 text-center">{p.mostPopular ? <FaStar className="w-5 h-5 text-yellow-500 mx-auto" /> : <FaRegStar className="w-5 h-5 text-gray-300 mx-auto" />}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => { setEditProduct({ ...p }); setImagePreview(p.image); }} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><FaEdit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50">
                            {deleting === p.id ? <FaSync className="w-4 h-4 animate-spin" /> : <FaTrash className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.length === 0 ? <div className="col-span-full text-center py-8 text-gray-500"><FaBox className="w-12 h-12 mx-auto mb-2 text-gray-300" />No products</div>
              : paginated.map(p => (
                <div key={p.id} className={`bg-white rounded-xl border-2 overflow-hidden shadow hover:shadow-lg transition ${selectedProducts.includes(p.id) ? "border-blue-500" : "border-gray-100"}`}>
                  <div className="relative aspect-square bg-gray-100">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" onClick={() => setFullImage(p.image)} /> : <div className="w-full h-full flex items-center justify-center"><FaImage className="w-12 h-12 text-gray-300" /></div>}
                    <div className="absolute top-2 left-2"><StatusBadge status={p.status} onChange={() => toggleStatus(p)} disabled={updatingStatus === p.id} /></div>
                    <div className="absolute top-2 right-2"><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => setSelectedProducts(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} className="w-5 h-5" /></div>
                    {num(p.discount) > 0 && <span className="absolute bottom-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">{p.discount}% OFF</span>}
                    {p.mostPopular && <div className="absolute bottom-2 right-2 p-1.5 bg-yellow-500 text-white rounded-full"><FaStar className="w-3 h-3" /></div>}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold truncate">{p.nameEn || "Unnamed"}</h3>
                    <p className="text-xs text-gray-500 mb-2">{p.categoryName || "Uncategorized"}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-green-600">{formatPrice(p.price)}</span>
                      <StockBadge stock={p.stock} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditProduct({ ...p }); setImagePreview(p.image); }} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold"><FaEdit className="inline w-3 h-3 mr-1" />Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-100 text-red-600 rounded-lg"><FaTrash className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1.5 bg-white border rounded text-sm disabled:opacity-50">First</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1"><FaChevronLeft className="w-3 h-3" />Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1">Next<FaChevronRight className="w-3 h-3" /></button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1.5 bg-white border rounded text-sm disabled:opacity-50">Last</button>
              </div>
            </div>
          )}
        </div>

        {/* Full Image Modal */}
        {fullImage && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setFullImage(null)}>
            <img src={fullImage} alt="" className="max-w-full max-h-[90vh] rounded-xl" />
            <button onClick={() => setFullImage(null)} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full"><FaTimes className="w-5 h-5" /></button>
          </div>
        )}

        {/* Edit Modal */}
        {editProduct && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2"><FaEdit /> Edit Product</h2>
                <button onClick={() => { setEditProduct(null); setImageFile(null); setImagePreview(null); }} className="p-1.5 hover:bg-white/20 rounded"><FaTimes className="w-5 h-5" /></button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-gray-600">Name (EN)</label><input type="text" value={editProduct.nameEn || ""} onChange={(e) => setEditProduct({ ...editProduct, nameEn: e.target.value })} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Name (UR)</label><input type="text" value={editProduct.nameUr || ""} onChange={(e) => setEditProduct({ ...editProduct, nameUr: e.target.value })} className="w-full p-2 border rounded-lg mt-1 text-right" dir="rtl" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Price (PKR)</label><input type="number" value={editProduct.price || ""} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div><label className="text-xs font-semibold text-gray-600">MRP (PKR)</label><input type="number" value={editProduct.mrpPrice || ""} onChange={(e) => setEditProduct({ ...editProduct, mrpPrice: e.target.value })} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Discount %</label><input type="number" value={editProduct.discount || ""} onChange={(e) => setEditProduct({ ...editProduct, discount: e.target.value })} className="w-full p-2 border rounded-lg mt-1" min="0" max="100" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Stock</label><input type="number" value={editProduct.stock || ""} onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Unit</label><input type="text" value={editProduct.unit || ""} onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })} className="w-full p-2 border rounded-lg mt-1" placeholder="kg, piece, etc" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Order Limit</label><input type="number" value={editProduct.orderLimit || ""} onChange={(e) => setEditProduct({ ...editProduct, orderLimit: e.target.value })} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div className="bg-yellow-50 p-3 rounded-lg border-2 border-yellow-200">
                  <label className="text-xs font-semibold text-gray-600">🔴🟢 Status</label>
                  <select value={editProduct.status || "inactive"} onChange={(e) => setEditProduct({ ...editProduct, status: e.target.value })} className="w-full p-2 border rounded-lg mt-1 font-bold">
                    <option value="active">🟢 Active (Visible)</option>
                    <option value="inactive">🔴 Inactive (Hidden)</option>
                  </select>
                  <p className="text-xs text-yellow-700 mt-1">⚠️ Changes sync to app instantly!</p>
                </div>
                <div><label className="text-xs font-semibold text-gray-600">Popular</label>
                  <select value={editProduct.mostPopular ? "yes" : "no"} onChange={(e) => setEditProduct({ ...editProduct, mostPopular: e.target.value === "yes" })} className="w-full p-2 border rounded-lg mt-1">
                    <option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </div>
                <div><label className="text-xs font-semibold text-gray-600">Reselling</label>
                  <select value={editProduct.reselling ? "yes" : "no"} onChange={(e) => setEditProduct({ ...editProduct, reselling: e.target.value === "yes" })} className="w-full p-2 border rounded-lg mt-1">
                    <option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Image</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="flex-1 p-2 border-2 border-dashed rounded-lg text-sm" />
                    {(imagePreview || editProduct.image) && <img src={imagePreview || editProduct.image} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Description</label>
                  <textarea value={editProduct.description || ""} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} className="w-full p-2 border rounded-lg mt-1 min-h-[80px]" />
                </div>
              </div>
              <div className="border-t p-4 bg-gray-50 flex justify-end gap-2">
                <button onClick={() => { setEditProduct(null); setImageFile(null); setImagePreview(null); }} className="px-4 py-2 bg-gray-200 rounded-lg font-semibold flex items-center gap-1"><FaTimes /> Cancel</button>
                <button onClick={handleSave} disabled={uploadingImage} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
                  {uploadingImage ? <><FaSync className="animate-spin" /> Uploading...</> : <><FaSave /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FaCloudDownloadAlt className="text-purple-500" /> Export</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => exportData("filtered", "xlsx")} className="p-4 border-2 border-blue-500 bg-blue-50 rounded-xl text-center hover:bg-blue-100">
                  <FaFileExcel className="w-8 h-8 text-blue-600 mx-auto mb-1" /><p className="font-semibold text-sm">Filtered</p><p className="text-xs text-gray-500">{filteredProducts.length} items</p>
                </button>
                <button onClick={() => exportData("all", "xlsx")} className="p-4 border-2 border-green-500 bg-green-50 rounded-xl text-center hover:bg-green-100">
                  <FaFileExcel className="w-8 h-8 text-green-600 mx-auto mb-1" /><p className="font-semibold text-sm">All</p><p className="text-xs text-gray-500">{allProducts.length} items</p>
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportData("filtered", "csv")} className="flex-1 py-2 bg-gray-100 rounded-lg font-semibold text-sm flex items-center justify-center gap-1"><FaFileCsv /> CSV</button>
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg font-semibold text-sm">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FaCloudUploadAlt className="text-green-500" /> Import</h3>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4 text-sm text-blue-700">
                Upload Excel/CSV file with product data. Default status will be <strong>active</strong>.
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="w-full p-3 border-2 border-dashed rounded-lg mb-4" />
              <div className="flex gap-2">
                <button onClick={downloadTemplate} className="flex-1 py-2 bg-purple-100 text-purple-700 rounded-lg font-semibold text-sm flex items-center justify-center gap-1"><FaDownload /> Template</button>
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg font-semibold text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </>
  );
}