import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getWasteHistory } from "../services/api";

export default function RiwayatSampah() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || { nama: "Petugas" };

  // State data real dari Firebase
  const [riwayatData, setRiwayatData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalData, setTotalData] = useState(0);

  // State filter
  const [filterJenis, setFilterJenis] = useState("Semua");
  const [filterDate, setFilterDate] = useState(() => {
    // Default: tanggal hari ini dalam format YYYY-MM-DD
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Fetch data dari API
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await getWasteHistory(filterDate, 50);

      if (res.success) {
        setRiwayatData(res.data || []);
        setTotalData(res.total || 0);
      }
    } catch (err) {
      console.error("Gagal fetch riwayat:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Format timestamp ke string tanggal lokal
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format confidence ke persen
  const formatConfidence = (confidence) => {
    if (!confidence) return "-";
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  // Logika memfilter data berdasarkan pilihan dropdown
  const filteredData = riwayatData.filter((item) => {
    if (filterJenis === "Semua") return true;
    return item.jenis === filterJenis;
  });

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm flex-shrink-0">
        <header className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-green-600 tracking-tight">
            SmartBin
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Halo, <strong className="text-gray-700">{user.nama}</strong>!
          </p>
        </header>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <a
                href="/dashboard"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors"
              >
                Dashboard Utama
              </a>
            </li>
            <li>
              <a
                href="/riwayat"
                className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg"
              >
                Riwayat Sampah
              </a>
            </li>
            <li>
              <a
                href="/pengaturan"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors"
              >
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
            <h1 className="text-3xl font-bold text-gray-900">
              Riwayat Pemilahan
            </h1>
            <p className="text-gray-500 mt-2">
              Log aktivitas pemilahan sampah otomatis dari Firebase.
              {totalData > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  ({totalData} data ditemukan)
                </span>
              )}
            </p>
          </div>

          {/* FILTER */}
          <div className="flex items-center gap-3">
            {/* Filter Tanggal */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-date"
                className="text-sm font-medium text-gray-600"
              >
                Tanggal:
              </label>
              <input
                id="filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
              />
            </div>

            {/* Filter Kategori */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter"
                className="text-sm font-medium text-gray-600"
              >
                Kategori:
              </label>
              <select
                id="filter"
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
              >
                <option value="Semua">Semua Sampah</option>
                <option value="Organik">Organik </option>
                <option value="Anorganik">Anorganik </option>
              </select>
            </div>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
            <p className="text-sm text-yellow-700">
              ⚠️ Gagal memuat data: {error}
            </p>
          </div>
        )}

        {/* TABEL DATA LOG */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Confidence</th>
                  <th className="px-6 py-4">Bin ID</th>
                  <th className="px-6 py-4">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {loading ? (
                  // Loading skeleton rows
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-8"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatTimestamp(item.timestamp)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.jenis === "Organik"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.jenis}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatConfidence(item.confidence)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                        {item.binId || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {item.source === "esp32cam_http"
                          ? "📷 ESP32-CAM"
                          : "📡 MQTT"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-10 text-center text-gray-400"
                    >
                      {riwayatData.length === 0
                        ? "Tidak ada data sampah pada tanggal ini."
                        : "Tidak ada data yang cocok dengan filter."}
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
