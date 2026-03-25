import { useState, useEffect } from "react";
import { db } from "../../firebase"; // apke firebase config ka path
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

export default function AddShop() {
  const [shopName, setShopName] = useState("");
  const [shops, setShops] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const shopsCollection = collection(db, "shops");

  // 🔹 Realtime listener for shops
  useEffect(() => {
    const unsubscribe = onSnapshot(
      shopsCollection,
      (snapshot) => {
        setShops(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.warn("Shops listener error:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 🔹 Add Shop
  const handleAddShop = async (e) => {
    e.preventDefault();
    if (!shopName.trim()) {
      alert("❗ Shop name is required");
      return;
    }

    // Duplicate check
    const exists = shops.find(
      (shop) => shop.name.toLowerCase() === shopName.trim().toLowerCase()
    );
    if (exists) {
      alert("⚠️ This shop already exists!");
      return;
    }

    try {
      await addDoc(shopsCollection, {
        name: shopName.trim(),
        createdAt: Date.now(),
      });
      setShopName("");
    } catch (error) {
      console.error("❌ Error adding shop:", error);
      alert("Something went wrong!");
    }
  };

  // 🔹 Delete Shop
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "shops", id));
    } catch (error) {
      console.error("❌ Error deleting shop:", error);
    }
  };

  // 🔹 Update Shop
  const handleUpdate = async (id) => {
    if (!shopName.trim()) {
      alert("❗ Enter new shop name to update");
      return;
    }

    // Duplicate check
    const exists = shops.find(
      (shop) =>
        shop.name.toLowerCase() === shopName.trim().toLowerCase() &&
        shop.id !== id
    );
    if (exists) {
      alert("⚠️ Shop name already exists!");
      return;
    }

    try {
      await updateDoc(doc(db, "shops", id), {
        name: shopName.trim(),
      });
      setShopName("");
      setEditingId(null);
    } catch (error) {
      console.error("❌ Error updating shop:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <form
        onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId);} : handleAddShop}
        className="bg-white/30 backdrop-blur-md p-6 rounded shadow space-y-4"
      >
        <h2 className="text-xl font-bold text-gray-800">
          🏬 {editingId ? "Update Shop" : "Add Shop"}
        </h2>
        <input
          type="text"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="Enter Shop Name"
          className="w-full p-2 border border-gray-300 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-md transition"
        >
          {editingId ? "Update Shop" : "Add Shop"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setShopName("");
            }}
            className="ml-3 bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition"
          >
            Cancel
          </button>
        )}
      </form>

      {/* Shop List */}
      <div className="bg-white/30 backdrop-blur-md p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">📋 Shop List</h3>
        {shops.length === 0 ? (
          <p className="text-gray-600">No shops added yet.</p>
        ) : (
          <ul className="space-y-3">
            {shops.map((shop) => (
              <li
                key={shop.id}
                className="flex justify-between items-center bg-white p-3 rounded shadow"
              >
                <span className="font-medium">{shop.name}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditingId(shop.id);
                      setShopName(shop.name);
                    }}
                    className="bg-yellow-500 text-white px-4 py-1 rounded hover:bg-yellow-600"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => handleDelete(shop.id)}
                    className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
