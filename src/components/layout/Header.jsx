import { useEffect, useState, useRef } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

export default function Header({ activeTab, setActiveTab, user, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Latest notifications fetch
  useEffect(() => {
    const q = query(collection(db, 'shops', 'xKUNJfO0kSZK4yCEhh8s', 'notifications'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const notis = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setNotifications(notis);
      },
      (err) => {
        console.warn("Notifications listener error:", err);
      }
    );
    return () => unsub();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (!notifRef.current?.contains(event.target)) setShowNotifications(false);
      if (!profileRef.current?.contains(event.target)) setShowProfileMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotiClick = async (noti) => {
    if (noti.link && noti.link !== '#') setActiveTab(noti.link.replace('/', ''));
    await updateDoc(doc(db, 'shops', 'xKUNJfO0kSZK4yCEhh8s', 'notifications', noti.id), { read: true });
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, read: true } : n));
    setShowNotifications(false);
  };

  const handleDeleteNoti = async (notiId) => {
    await deleteDoc(doc(db, 'shops', 'xKUNJfO0kSZK4yCEhh8s', 'notifications', notiId));
    setNotifications(prev => prev.filter(n => n.id !== notiId));
  };

  return (
    <header className="flex justify-between items-center p-4 shadow-md bg-white relative z-50">
      <div className="text-xl font-bold text-orange-500">🛒 Ansari Admin</div>

      <div className="flex items-center gap-4 relative">
        <div className="text-sm text-slate-600 mr-4">
          {user ? `Signed in as ${user?.displayName || user?.email}` : "Not signed in"}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full hover:bg-gray-200 transition"
          >
            <Bell size={22} />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg p-4 text-sm z-50 max-h-80 overflow-auto">
              <p className="font-semibold mb-2">Notifications</p>
              <ul className="space-y-2">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <li key={n.id} className="flex justify-between items-start p-2 hover:bg-gray-100 rounded cursor-pointer">
                      <div onClick={() => handleNotiClick(n)} className="flex-1">
                        <p className="font-medium">{n.title}</p>
                      </div>
                      <button onClick={() => handleDeleteNoti(n.id)} className="ml-2 text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400">No notifications</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold cursor-pointer"
          >
            F
          </div>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg p-2 text-sm z-50">
              <ul>
                <li className="p-2 hover:bg-gray-100 rounded cursor-pointer">My Profile</li>
                <li className="p-2 hover:bg-gray-100 rounded cursor-pointer">Settings</li>
                <li
                  className="p-2 hover:bg-gray-100 rounded cursor-pointer text-red-600"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout?.();
                  }}
                >
                  Logout
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
