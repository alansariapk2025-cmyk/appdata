import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // React Router for navigation
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Users, ReceiptText, Wallet, Store, Package, Tags } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalPayments: 0,
    totalCustomers: 0,
    totalShops: 0,
    totalProducts: 0,
    totalCategories: 0
  });
  const [latestOrders, setLatestOrders] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 🔹 Fetch summary data
  useEffect(() => {
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        let totalAmount = 0;
        snap.forEach((doc) => (totalAmount += doc.data().total || 0));
        setSummary((prev) => ({ ...prev, totalOrders: snap.size, totalPayments: totalAmount }));
      },
      (err) => {
        console.warn('Orders summary listener error:', err);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setSummary((prev) => ({ ...prev, totalCustomers: snap.size }));
      },
      (err) => {
        console.warn('Users summary listener error:', err);
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setSummary((prev) => ({ ...prev, totalProducts: snap.size }));
      },
      (err) => {
        console.warn('Products summary listener error:', err);
      }
    );

    const unsubShops = onSnapshot(
      collection(db, 'shops'),
      (snap) => {
        let catCount = 0;
        snap.docs.forEach((docSnap) => {
          onSnapshot(
            collection(db, 'shops', docSnap.id, 'categories'),
            (catSnap) => {
              catCount += catSnap.size;
              setSummary((prev) => ({ ...prev, totalCategories: catCount }));
            },
            (err) => {
              console.warn('Shop categories listener error:', err);
            }
          );
        });
        setSummary((prev) => ({ ...prev, totalShops: snap.size }));
      },
      (err) => {
        console.warn('Shops summary listener error:', err);
      }
    );

    return () => { unsubOrders(); unsubUsers(); unsubProducts(); unsubShops(); };
  }, []);

  // 🔹 Latest Orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            customerName: d.name || "Unknown",
            total: d.total || 0,
            status: d.status || "Pending",
            createdAt: d.createdAt?.toDate?.() || new Date(),
          };
        });
        setLatestOrders(orders);
      },
      (err) => {
        console.warn("Latest orders listener error:", err);
      }
    );
    return () => unsub();
  }, []);

  // 🔹 Chart data
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => doc.data()).filter((doc) => {
          const d = doc.createdAt?.toDate?.();
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          return (!from || d >= from) && (!to || d <= to);
        });

      const dateMap = {};
      data.forEach(o => {
        const date = o.createdAt.toDate().toLocaleDateString();
        dateMap[date] = (dateMap[date] || 0) + (o.total || 0);
      });

      const gradient = (ctx) => {
        const grad = ctx.createLinearGradient(0, 0, 0, 400);
        grad.addColorStop(0, 'rgba(99,102,241,0.8)');
        grad.addColorStop(0.5, 'rgba(99,102,241,0.5)');
        grad.addColorStop(1, 'rgba(99,102,241,0.3)');
        return grad;
      };

      setChartData({
        labels: Object.keys(dateMap),
        datasets: [{
          label: 'Payments',
          data: Object.values(dateMap),
          backgroundColor: function (ctx) {
            return gradient(ctx.chart.ctx);
          },
          borderColor: 'rgb(99,102,241)',
          borderWidth: 2,
          borderRadius: 12,
          barPercentage: 0.7,
        }],
      });
    },
    (err) => {
      console.warn('Chart data listener error:', err);
    }
  );
  return () => unsub();
}, [fromDate, toDate]);

  const Box = ({ icon, label, value, color }) => (
    <div className="bg-white/50 backdrop-blur-lg p-6 rounded-xl shadow-xl flex items-center gap-4 w-full sm:w-[30%] min-w-[240px] hover:scale-[1.05] transition transform duration-300">
      <div className={`p-3 rounded-full ${color} bg-opacity-30`}>{icon}</div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{value}</h2>
        <p className="text-sm text-gray-700">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50">

      {/* 🔹 Summary Boxes - TOP */}
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        <Box icon={<Store className="text-blue-600" size={28} />} label="Total Shops" value={summary.totalShops} color="bg-blue-200" />
        <Box icon={<Package className="text-green-600" size={28} />} label="Total Products" value={summary.totalProducts} color="bg-green-200" />
        <Box icon={<Tags className="text-purple-600" size={28} />} label="Total Categories" value={summary.totalCategories} color="bg-purple-200" />
        <Box icon={<Users className="text-yellow-600" size={28} />} label="Total Customers" value={summary.totalCustomers} color="bg-yellow-200" />
        <Box icon={<ReceiptText className="text-indigo-600" size={28} />} label="Total Orders" value={summary.totalOrders} color="bg-indigo-200" />
        <Box icon={<Wallet className="text-pink-600" size={28} />} label="Total Payments" value={`PKR ${summary.totalPayments.toLocaleString()}`} color="bg-pink-200" />
      </div>

      {/* 🔹 Latest Orders - MIDDLE */}
      <div className="bg-white/40 backdrop-blur-lg p-4 rounded-xl shadow-xl max-h-96 overflow-y-auto mt-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-700">Latest Orders</h3>
        <ul className="space-y-2">
          {latestOrders.map(o => (
            <li
              key={o.id}
              className="bg-white/70 p-3 rounded-xl border-l-4 border-blue-500 shadow-lg flex justify-between items-center hover:scale-[1.03] transition transform duration-200 cursor-pointer"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <div>
                <p className="font-semibold text-gray-800">{o.customerName}</p>
                <p className="text-sm text-gray-600">{o.createdAt.toLocaleString()}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${o.status === 'Pending' ? 'bg-yellow-200 text-yellow-800' : o.status === 'Delivered' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                  {o.status}
                </span>
              </div>
              <span className="font-bold text-green-700 text-lg">Rs {o.total}</span>
            </li>
          ))}
          {latestOrders.length === 0 && <p className="text-gray-500 text-sm text-center">No orders yet.</p>}
        </ul>
      </div>

      {/* 🔹 Chart Section - BOTTOM */}
      <div className="bg-white/50 backdrop-blur-lg p-4 rounded-xl shadow-xl space-y-4 mt-6">
        <div className="flex gap-4">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border p-2 rounded w-full sm:w-auto"/>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border p-2 rounded w-full sm:w-auto"/>
        </div>
        {chartData?.labels?.length > 0 ? <Bar data={chartData} /> : <p className="text-gray-500 text-sm">No data for selected date.</p>}
      </div>

    </div>
  );
}
