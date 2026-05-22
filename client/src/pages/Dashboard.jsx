import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { nama: 'Petugas' };

  // State kapasitsas
  const [capacity, setCapacity] = useState(0);

  // Alert
  const isBinFull = capacity >= 90;

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Simulasi tambah sampah (ini sementara)
  const simulateAddTrash = () => {
    if (capacity < 100) {
      setCapacity(prev => Math.min(prev + 25, 100)); // Tambah 25% setiap klik, maksimal 100%
    }
  };

  const simulateEmptyBin = () => {
    setCapacity(0); // Kosongkan kembali
  };

  // Konfigurasi Chart.js
  const chartData = {
    labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    datasets: [
      {
        label: 'Organik',
        data: [12, 19, 15, 22, 14, 28, 30],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 4,
      },
      {
        label: 'Anorganik',
        data: [8, 11, 13, 18, 10, 20, 25],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Jumlah Sampah (Item)' } } }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm flex-shrink-0">
        <header className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-green-600 tracking-tight">SmartBin</h2>
          <p className="text-sm text-gray-500 mt-1">Halo, <strong className="text-gray-700">{user.nama}</strong>!</p>
        </header>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li><a href="/dashboard" className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg">Dashboard Utama</a></li>
            <li><a href="/riwayat" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">Riwayat Sampah</a></li>
            <li><a href="/pengaturan" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">Pengaturan</a></li>
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      {/* KONTEN */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ringkasan Data</h1>
            <p className="text-gray-500 mt-2">Pemantauan klasifikasi dan kapasitas sampah real-time.</p>
          </div>
          
          {/* TOMBOL SIMULASI*/}
          <div className="flex gap-2">
            <button onClick={simulateAddTrash} className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-purple-700">
              + Simulasi Sampah Masuk
            </button>
            <button onClick={simulateEmptyBin} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg shadow-sm hover:bg-gray-300">
              Kosongkan Bin
            </button>
          </div>
        </header>
        
        {/* KOMPONEN ALERT NOTIFIKASI */}
        {isBinFull && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm animate-pulse">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-bold">
                  Peringatan Sistem: Kapasitas SmartBin telah mencapai {capacity}%! Segera lakukan pengangkutan sampah.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <section>
          {/* Widget Kartu Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status Alat</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">ONLINE</p>
            </article>

            {/* WIDGET KAPASITAS */}
            <article className={`bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden transition-colors ${isBinFull ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Kapasitas Bin</h3>
              <p className={`text-3xl font-bold mt-2 ${isBinFull ? 'text-red-600' : 'text-blue-600'}`}>{capacity}%</p>
              
              {/* Indikator Bar Dinamis di bawah widget */}
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-100">
                <div 
                  className={`h-full transition-all duration-500 ease-in-out ${isBinFull ? 'bg-red-500' : 'bg-blue-500'}`} 
                  style={{ width: `${capacity}%` }}
                ></div>
              </div>
            </article>

            <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Hari Ini</h3>
              <p className="text-2xl font-bold text-purple-600 mt-2">42 <span className="text-lg text-gray-500 font-medium">Item</span></p>
            </article>
          </div>

          {/* Grafik */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Grafik Historis Klasifikasi Sampah</h3>
            <div className="w-full h-72 relative">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}