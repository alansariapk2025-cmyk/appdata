import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Users, ReceiptText, Wallet } from 'lucide-react';

export default function OverviewBoxes() {
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalPayments: 0,
    totalCustomers: 0,
  });

  useEffect(() => {
    // 🔁 Real-time updates via onSnapshot
    const unsubscribeOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        setSummary((prev) => ({ ...prev, totalOrders: snapshot.size }));
      },
      (err) => {
        console.warn('Orders overview listener error:', err);
      }
    );

    const unsubscribePayments = onSnapshot(
      collection(db, 'payments'),
      (snapshot) => {
        const total = snapshot.docs.reduce((sum, doc) => {
          const amount = doc.data()?.amount || 0;
          return sum + amount;
        }, 0);
        setSummary((prev) => ({ ...prev, totalPayments: total }));
      },
      (err) => {
        console.warn('Payments overview listener error:', err);
      }
    );

    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setSummary((prev) => ({ ...prev, totalCustomers: snapshot.size }));
      },
      (err) => {
        console.warn('Users overview listener error:', err);
      }
    );

    // 🧹 Cleanup listeners jab component unmount ho
    return () => {
      unsubscribeOrders();
      unsubscribePayments();
      unsubscribeUsers();
    };
  }, []);

  // 🎁 Card box component
  const Box = ({ icon, label, value, color }) => (
    <div className="bg-white/70 backdrop-blur p-6 rounded-xl shadow flex items-center gap-4 w-full sm:w-[30%] min-w-[240px]">
      <div className={`p-3 rounded-full ${color} bg-opacity-20`}>
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800">{value}</h2>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap justify-center gap-6 p-6 bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 rounded-2xl">
      <Box
        icon={<Users className="text-indigo-600" size={28} />}
        label="Total Customers"
        value={summary.totalCustomers}
        color="bg-indigo-200"
      />
      <Box
        icon={<ReceiptText className="text-orange-600" size={28} />}
        label="Total Orders"
        value={summary.totalOrders}
        color="bg-orange-200"
      />
      <Box
        icon={<Wallet className="text-green-600" size={28} />}
        label="Total Payments"
        value={`PKR ${summary.totalPayments.toLocaleString()}`}
        color="bg-green-200"
      />
    </div>
  );
}
