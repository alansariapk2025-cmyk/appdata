// ✅ Backup.jsx — Firestore Export + Import (No getCollections)
import React from "react";
import { getFirestore, getDocs, collection, doc, setDoc } from "firebase/firestore";
import { saveAs } from "file-saver";
import { db } from "../firebase"; // apni firebase config ka path

export default function Backup() {
  // ✅ Apni Firestore collections list yahan likho
  const collectionsList = ["products", "categories", "users", "orders"]; // <-- customize as needed

  // ✅ Export Firestore data
  const exportFirestoreData = async () => {
    try {
      const allData = {};
      for (const colName of collectionsList) {
        const docsSnap = await getDocs(collection(db, colName));
        allData[colName] = {};
        docsSnap.forEach((docSnap) => {
          allData[colName][docSnap.id] = docSnap.data();
        });
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], {
        type: "application/json",
      });
      saveAs(blob, "firestore-backup.json");
      alert("✅ Firestore backup downloaded successfully!");
    } catch (error) {
      console.error("Error exporting Firestore:", error);
      alert("❌ Backup failed. Check console for details.");
    }
  };

  // ✅ Import Firestore data
  const importFirestoreData = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return alert("⚠️ Please select a JSON backup file.");

      const text = await file.text();
      const jsonData = JSON.parse(text);

      for (const [collectionName, docs] of Object.entries(jsonData)) {
        for (const [docId, docData] of Object.entries(docs)) {
          await setDoc(doc(db, collectionName, docId), docData);
        }
      }

      alert("✅ Firestore data restored successfully!");
    } catch (error) {
      console.error("Error importing Firestore:", error);
      alert("❌ Restore failed. Check console for details.");
    }
  };

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">💾 Firestore Backup & Restore</h1>
      <p className="mb-4 text-gray-600">
        Export ya Restore karen apna Firestore data (React Safe Version)
      </p>

      {/* ✅ Export Button */}
      <button
        onClick={exportFirestoreData}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow mr-3"
      >
        🔄 Export Firestore Data
      </button>

      {/* ✅ Restore Button */}
      <label className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow cursor-pointer">
        📤 Restore Firestore Data
        <input
          type="file"
          accept=".json"
          onChange={importFirestoreData}
          className="hidden"
        />
      </label>
    </div>
  );
}
