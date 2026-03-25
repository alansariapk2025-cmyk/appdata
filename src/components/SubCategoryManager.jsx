import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

export default function SubCategoryManager({ shopId, categoryId }) {
  const [subcategories, setSubcategories] = useState([]);
  const [subName, setSubName] = useState('');

  const fetchSubcategories = async () => {
    try {
      const snap = await getDocs(
        collection(db, 'shops', shopId, 'categories', categoryId, 'subcategories')
      );
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSubcategories(list);
    } catch (err) {
      console.warn('Failed to load subcategories:', err);
    }
  };

  useEffect(() => {
    fetchSubcategories();
  }, []);

  const addSubcategory = async (e) => {
    e.preventDefault();
    if (!subName.trim()) return;

    try {
      await addDoc(collection(db, 'shops', shopId, 'categories', categoryId, 'subcategories'), {
        name: subName.trim(),
        createdAt: Timestamp.now()
      });
      setSubName('');
      fetchSubcategories();
    } catch (err) {
      console.error('Failed to add subcategory:', err);
    }
  };

  const deleteSub = async (id) => {
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'categories', categoryId, 'subcategories', id));
      fetchSubcategories();
    } catch (err) {
      console.error('Failed to delete subcategory:', err);
    }
  };

  return (
    <div className="pl-4 mt-2 border-l-4 border-blue-300 space-y-2">
      <form onSubmit={addSubcategory} className="flex gap-2">
        <input
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          placeholder="Add subcategory"
          className="flex-1 p-1 px-3 rounded border bg-white/30"
        />
        <button type="submit" className="bg-blue-600 text-white px-3 rounded">+</button>
      </form>

      <ul className="text-sm text-gray-700 space-y-1">
        {subcategories.map(sub => (
          <li key={sub.id} className="flex justify-between items-center bg-white/20 p-1 px-3 rounded">
            <span>{sub.name}</span>
            <button onClick={() => deleteSub(sub.id)} className="text-red-600 hover:underline">x</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
