import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutService } from '../services/authService';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    logoutService();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm flex-shrink-0">
        <header className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-green-600 tracking-tight">SmartBin</h2>
          <p className="text-sm text-gray-500 mt-1">Halo, <strong className="text-gray-700">{user?.nama || 'Petugas'}</strong>!</p>
        </header>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <a href="/dashboard" className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg">Dashboard Utama</a>
            </li>
            <li>
              <a href="/riwayat" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">Riwayat Sampah</a>
            </li>
            <li>
              <a href="/pengaturan" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">Pengaturan</a>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout} 
            className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ringkasan Data</h1>
          <p className="text-gray-500 mt-2">Pemantauan klasifikasi dan kapasitas sampah real-time.</p>
        </header>
        
        <section>
          {/* Widget Kartu Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status Alat</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">ONLINE</p>
            </article>

            <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Kapasitas Bin</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">0%</p>
              {/* Indikator visual sederhana */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100"><div className="h-full bg-blue-500 w-0"></div></div>
            </article>

            <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Hari Ini</h3>
              <p className="text-2xl font-bold text-purple-600 mt-2">0 <span className="text-lg text-gray-500 font-medium">Item</span></p>
            </article>
          </div>

          {/* Grafik Chart*/}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Grafik Historis Klasifikasi Sampah</h3>
            <div className="w-full h-64 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
              [ Nanti Grafik Chart.js ditaruh di sini ]
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}