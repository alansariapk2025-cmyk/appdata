import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

export default function AddProduct() {
  const [product, setProduct] = useState({
    nameEn: "",
    price: "",
    mrpPrice: "",
    unit: "kg",
    minQty: 500,
    discount: "",
    stock: "",
    status: "active",
    shopId: "",
    category: "",
    subcategory: "",
    isPopular: false,
    isReselling: false,
  });

  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const MAX_SIZE = 1 * 1024 * 1024; // 2MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const snap = await getDocs(collection(db, "shops"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setShops(list);
      } catch (err) {
        console.warn("Failed to load shops:", err);
      }
    };
    fetchShops();
  }, []);

  const handleShopChange = async (e) => {
    const shopId = e.target.value;
    setProduct((prev) => ({ ...prev, shopId, category: "", subcategory: "" }));

    if (!shopId) {
      setCategories([]);
      setSubcategories([]);
      return;
    }

    try {
      const catSnap = await getDocs(collection(db, "shops", shopId, "categories"));
      const cats = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllCategories(cats);
      setCategories(cats.filter((c) => !c.parentId));
      setSubcategories([]);
    } catch (err) {
      console.warn("Failed to load categories for shop:", err);
    }
  };

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    setProduct((prev) => ({ ...prev, category: categoryId, subcategory: "" }));
    setSubcategories(allCategories.filter((s) => s.parentId === categoryId));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProduct((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast.error("Image too large! Max 1MB allowed.");
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG, WEBP images allowed!");
      return;
    }

    try {
      createImageBitmap(file); // check corrupted
    } catch {
      toast.error("Invalid or corrupted image!");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    toast.success("Image selected!");
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    setIsUploading(true);
    toast.loading("Uploading image...");

    try {
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      const form = new FormData();
      form.append("image", imageFile);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      toast.dismiss();

      if (data.success) {
        toast.success("Image uploaded!");
        setIsUploading(false);
        return data.data.url;
      }

      throw new Error("Upload failed");
    } catch {
      toast.dismiss();
      toast.error("Image upload failed!");
      setIsUploading(false);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!product.nameEn || !product.shopId || !product.category) {
      toast.error("Please fill all required fields!");
      return;
    }

    const imageUrl = await uploadImage();
    if (!imageUrl) return;

    const cat = allCategories.find((c) => c.id === product.category);
    const sub = allCategories.find((s) => s.id === product.subcategory);

    try {
      await addDoc(collection(db, "products"), {
        ...product,
        image: imageUrl,
        price: parseFloat(product.price || 0),
        mrpPrice: parseFloat(product.mrpPrice || 0),
        discount: parseFloat(product.discount || 0),
        stock: parseInt(product.stock || 0),
        minQty: parseInt(product.minQty || 0),
        categoryName: cat ? cat.name : "Uncategorized",
        subcategoryName: sub ? sub.name : "No Subcategory",
        createdAt: new Date(),
      });

      toast.success("Product added successfully!");
      setProduct({
        nameEn: "",
        price: "",
        mrpPrice: "",
        unit: "kg",
        minQty: 500,
        discount: "",
        stock: "",
        status: "active",
        shopId: "",
        category: "",
        subcategory: "",
        isPopular: false,
        isReselling: false,
      });
      setImageFile(null);
      setImagePreview(null);
      setSubcategories([]);
    } catch {
      toast.error("Failed to add product!");
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <form
        onSubmit={handleSubmit}
        className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 space-y-6"
      >
        <h2 className="text-2xl font-bold text-gray-900">🛒 Add Product</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input
            name="nameEn"
            value={product.nameEn}
            onChange={handleChange}
            placeholder="Product Name"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <input
            name="price"
            type="number"
            value={product.price}
            onChange={handleChange}
            placeholder="Selling Price"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <input
            name="mrpPrice"
            type="number"
            value={product.mrpPrice}
            onChange={handleChange}
            placeholder="MRP Price"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <select
            name="unit"
            value={product.unit}
            onChange={handleChange}
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          >
            {["Kg", "Gram", "Litre", "Dozen", "Packet", "Piece"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <input
            name="minQty"
            type="number"
            value={product.minQty}
            onChange={handleChange}
            placeholder="Min Qty"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <input
            name="discount"
            type="number"
            value={product.discount}
            onChange={handleChange}
            placeholder="Discount (%)"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <input
            name="stock"
            type="number"
            value={product.stock}
            onChange={handleChange}
            placeholder="Stock"
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          />
          <select
            name="status"
            value={product.status}
            onChange={handleChange}
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            name="shopId"
            value={product.shopId}
            onChange={handleShopChange}
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
          >
            <option value="">Select Shop</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            value={product.category}
            onChange={handleCategoryChange}
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
            disabled={!product.shopId}
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="subcategory"
            value={product.subcategory}
            onChange={handleChange}
            className="p-3 rounded-xl border border-gray-300 bg-white/20 backdrop-blur-sm"
            disabled={!product.category}
          >
            <option value="">Select Subcategory</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="p-3 border border-gray-300 rounded-xl bg-white/20 backdrop-blur-sm"
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-2 w-24 h-24 rounded-lg object-cover border-2 border-blue-500"
            />
          )}
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isPopular"
              checked={product.isPopular}
              onChange={handleChange}
            />
            🏆 Most Popular
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isReselling"
              checked={product.isReselling}
              onChange={handleChange}
            />
            🔁 Reselling
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUploading}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-xl font-semibold shadow hover:shadow-md transition"
          >
            {isUploading ? "Uploading..." : "Save Product"}
          </button>
        </div>
      </form>
    </>
  );
} 