import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RiwayatSampah() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { nama: 'Petugas' };

  // Data dummy
  const [riwayatData] = useState([
    { id: 'SMPH-001', waktu: '22-05-2026 11:15:22', jenis: 'Organik', jumlah: 1 },
    { id: 'SMPH-002', waktu: '22-05-2026 11:12:05', jenis: 'Anorganik', jumlah: 1 },
    { id: 'SMPH-003', waktu: '22-05-2026 10:45:10', jenis: 'Organik', jumlah: 1 },
    { id: 'SMPH-004', waktu: '22-05-2026 09:30:18', jenis: 'Anorganik', jumlah: 2 },
    { id: 'SMPH-005', waktu: '21-05-2026 16:20:00', jenis: 'Organik', jumlah: 1 },
    { id: 'SMPH-006', waktu: '21-05-2026 15:10:42', jenis: 'Organik', jumlah: 1 },
    { id: 'SMPH-007', waktu: '21-05-2026 14:02:11', jenis: 'Anorganik', jumlah: 3 },
  ]);

  // State filter sampah
  const [filterJenis, setFilterJenis] = useState('Semua');

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Logika memfilter data berdasarkan pilihan dropdown
  const filteredData = riwayatData.filter(item => {
    if (filterJenis === 'Semua') return true;
    return item.jenis === filterJenis;
  });

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
            <li>
              <a href="/dashboard" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">
                Dashboard Utama
              </a>
            </li>
            <li>
              <a href="/riwayat" className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg">
                Riwayat Sampah
              </a>
            </li>
            <li>
              <a href="/pengaturan" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors">
                Pengaturan
              </a>
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

      {/* KONTEN */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Riwayat Pemilahan</h1>
            <p className="text-gray-500 mt-2">Log aktivitas pemilahan sampah otomatis secara real-time.</p>
          </div>

          {/* FILTER DROPDOWN */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter" className="text-sm font-medium text-gray-600">Kategori:</label>
            <select
              id="filter"
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
            >
              <option value="Semua">Semua Sampah</option>
              <option value="Organik">Organik Only</option>
              <option value="Anorganik">Anorganik Only</option>
            </select>
          </div>
        </header>

        {/* TABEL DATA LOG */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">ID Sampah</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Jumlah</th>
                  <th className="px-6 py-4">Status Mekanik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id}</td>
                      <td className="px-6 py-4 text-gray-600">{item.waktu}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.jenis === 'Organik' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.jenis}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{item.jumlah} Item</td>
                      <td className="px-6 py-4 text-gray-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Dipilah (Servo {item.jenis === 'Organik' ? '0°' : '90°'}) 
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                      Tidak ada data log sampah yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

    </div>
  );
}