import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

export default function AdminBanner() {
  const [banner, setBanner] = useState({
    type: "slider",
    title: "",
    subtitle: "",
    images: [], // for slider multiple images
    imageFile: null, // temp selected image
    imagePreview: null, // temp preview
    status: "active",
    order: 0,
    id: null,
  });

  const [banners, setBanners] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const MAX_SIZE = 1 * 1024 * 1024; // 1MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  // Fetch banners
  const fetchBanners = async () => {
    try {
      const snap = await getDocs(collection(db, "banners"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBanners(list.sort((a, b) => a.order - b.order));
    } catch (err) {
      console.warn("Failed to fetch banners:", err);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBanner(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_SIZE) return toast.error("Max 1MB allowed");
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error("Only JPG, PNG, WEBP allowed");

    try { createImageBitmap(file); } catch { return toast.error("Invalid image"); }

    setBanner(prev => ({
      ...prev,
      imageFile: file,
      imagePreview: URL.createObjectURL(file)
    }));
    toast.success("Image ready!");
  };

  // Upload image to ImgBB
  const uploadImage = async () => {
    if (!banner.imageFile) return banner.imagePreview || null; // keep old
    setIsUploading(true);
    toast.loading("Uploading image...");
    try {
      const form = new FormData();
      form.append("image", banner.imageFile);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`, { method: "POST", body: form });
      const data = await res.json();
      toast.dismiss();
      setIsUploading(false);
      if (data.success) return data.data.url;
      throw new Error("Upload failed");
    } catch {
      toast.dismiss();
      setIsUploading(false);
      toast.error("Image upload failed!");
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!banner.imageFile && banner.type === "offer") return toast.error("Select an image!");

    const imageUrl = await uploadImage();
    if (banner.type === "offer" && !imageUrl) return;

    try {
      if (banner.id) {
        // Update
        const updateData = {
          type: banner.type,
          status: banner.status,
          order: Number(banner.order),
        };
        if (banner.type === "offer") {
          updateData.title = banner.title;
          updateData.subtitle = banner.subtitle;
          updateData.imageUrl = imageUrl;
        } else {
          updateData.images = banner.images.concat(imageUrl ? [imageUrl] : []);
        }

        await updateDoc(doc(db, "banners", banner.id), {
          ...updateData,
          updatedAt: new Date()
        });
        toast.success("Banner updated!");
      } else {
        const newData = {
          type: banner.type,
          status: banner.status,
          order: Number(banner.order),
        };
        if (banner.type === "offer") {
          newData.title = banner.title;
          newData.subtitle = banner.subtitle;
          newData.imageUrl = imageUrl;
        } else {
          newData.images = imageUrl ? [imageUrl] : [];
        }

        await addDoc(collection(db, "banners"), {
          ...newData,
          createdAt: new Date()
        });
        toast.success("Banner added!");
      }

      setBanner({ type: "slider", title: "", subtitle: "", images: [], imageFile: null, imagePreview: null, status: "active", order: 0, id: null });
      fetchBanners();
    } catch {
      toast.error("Failed to save banner!");
    }
  };

  const handleEdit = (b) => {
    setBanner({
      type: b.type,
      title: b.title || "",
      subtitle: b.subtitle || "",
      images: b.images || [],
      imageFile: null,
      imagePreview: b.imageUrl || (b.images?.[0] || null),
      status: b.status,
      order: b.order,
      id: b.id,
      imageUrl: b.imageUrl
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await deleteDoc(doc(db, "banners", id));
      toast.success("Banner deleted!");
      fetchBanners();
    } catch (err) {
      console.error("Failed to delete banner:", err);
      toast.error("Unable to delete banner. Check permissions.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <Toaster position="top-right" />
      <h2 className="text-2xl font-bold mb-4">🖼 Admin Banners</h2>

      <form onSubmit={handleSubmit} className="p-4 bg-white rounded-lg shadow space-y-4 mb-6">
        <select name="type" value={banner.type} onChange={handleChange} className="p-2 border rounded w-full">
          <option value="slider">Slider</option>
          <option value="offer">Offer</option>
        </select>

        {banner.type === "offer" && (
          <>
            <input name="title" value={banner.title} onChange={handleChange} placeholder="Title (e.g. December Mega Sale)" className="p-2 border rounded w-full"/>
            <input name="subtitle" value={banner.subtitle} onChange={handleChange} placeholder="Subtitle (e.g. Up to 50% Off)" className="p-2 border rounded w-full"/>
          </>
        )}

        <input type="number" name="order" value={banner.order} onChange={handleChange} placeholder="Order" className="p-2 border rounded w-full"/>
        <input type="file" accept="image/*" onChange={handleImageSelect} className="p-2 border rounded w-full"/>
        {banner.imagePreview && <img src={banner.imagePreview} className="w-32 h-32 object-cover rounded border mt-2"/>}

        <select name="status" value={banner.status} onChange={handleChange} className="p-2 border rounded w-full">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button type="submit" disabled={isUploading} className="bg-blue-500 text-white px-4 py-2 rounded">
          {banner.id ? "Update Banner" : isUploading ? "Uploading..." : "Add Banner"}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {banners.map(b => (
          <div key={b.id} className="bg-white p-2 rounded shadow flex flex-col items-center">
            {b.type === "offer" ? (
              <>
                <img src={b.imageUrl} className="w-full h-32 object-cover rounded"/>
                <div className="text-center mt-2"><h3>{b.title}</h3><p>{b.subtitle}</p></div>
              </>
            ) : (
              b.images?.map((img, idx) => <img key={idx} src={img} className="w-full h-32 object-cover rounded mb-2"/>) 
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleEdit(b)} className="bg-yellow-500 text-white px-2 py-1 rounded">Edit</button>
              <button onClick={() => handleDelete(b.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
