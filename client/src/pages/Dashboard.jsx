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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard SmartBin</h1>
            <p className="text-gray-600">Selamat datang kembali, <span className="font-semibold text-green-600">{user?.nama || 'Petugas'}</span>!</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Placeholder untuk widget data IoT kalian nanti */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <h3 className="text-sm font-medium text-green-700">Status Alat</h3>
            <p className="text-2xl font-bold text-green-900 mt-1">ONLINE</p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <h3 className="text-sm font-medium text-blue-700">Kapasitas Sampah</h3>
            <p className="text-2xl font-bold text-blue-900 mt-1">0%</p>
          </div>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
            <h3 className="text-sm font-medium text-purple-700">Total Hari Ini</h3>
            <p className="text-2xl font-bold text-purple-900 mt-1">0 Sampah</p>
          </div>
        </div>
      </div>
    </div>
  );
}