import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { getBinStatus, getWasteStats } from "../services/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || { nama: "Petugas" };

  // State data real dari Firebase via API
  const [binStatus, setBinStatus] = useState(null);
  const [todayStats, setTodayStats] = useState({
    total: 0,
    organik: 0,
    anorganik: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [imgTimestamp, setImgTimestamp] = useState(Date.now());

  // Fetch data dari API backend
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [binRes, statsRes] = await Promise.all([
        getBinStatus("bin-001"),
        getWasteStats("today", "bin-001"),
      ]);

      if (binRes.success) {
        setBinStatus(binRes.data);
      }

      if (statsRes.success) {
        setTodayStats(statsRes.data);
      }

      setLastUpdate(new Date());
      setImgTimestamp(Date.now());
    } catch (err) {
      console.error("Gagal fetch data dashboard:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch awal + polling setiap 5 detik
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived state
  const capacity = binStatus?.status?.kapasitas_persen ?? 0;
  const isOnline = binStatus?.status?.is_online ?? false;
  const isBinFull = capacity >= 90;

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  // Konfigurasi Chart.js — data dari statistik
  const chartData = {
    labels: ["Organik", "Anorganik"],
    datasets: [
      {
        label: "Jumlah Hari Ini",
        data: [todayStats.organik || 0, todayStats.anorganik || 0],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(59, 130, 246, 0.8)",
        ],
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Jumlah Sampah (Item)" },
        ticks: { stepSize: 1 },
      },
    },
  };

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
                className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg"
              >
                Dashboard Utama
              </a>
            </li>
            <li>
              <a
                href="/riwayat"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium rounded-lg transition-colors"
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
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ringkasan Data</h1>
            <p className="text-gray-500 mt-2">
              Pemantauan klasifikasi dan kapasitas sampah real-time.
            </p>
          </div>

          {/* Indikator update terakhir */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {loading && !binStatus ? (
              <span className="animate-pulse">Memuat data...</span>
            ) : lastUpdate ? (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${error ? "bg-red-400" : "bg-green-400"}`}
                ></span>
                <span>Update: {lastUpdate.toLocaleTimeString("id-ID")}</span>
              </>
            ) : null}
          </div>
        </header>

        {/* ERROR BANNER */}
        {error && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
            <p className="text-sm text-yellow-700">
              ⚠️ Gagal memuat data: {error}. Akan coba lagi otomatis...
            </p>
          </div>
        )}

        {/* KOMPONEN ALERT NOTIFIKASI — BIN PENUH */}
        {isBinFull && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm animate-pulse">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-bold">
                  Peringatan Sistem: Kapasitas SmartBin telah mencapai{" "}
                  {capacity}%! Segera lakukan pengangkutan sampah.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LOADING SKELETON */}
        {loading && !binStatus ? (
          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section>
            {/* Widget Kartu Data */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* STATUS ALAT */}
              <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Status Alat
                </h3>
                <p
                  className={`text-2xl font-bold mt-2 ${isOnline ? "text-green-600" : "text-red-500"}`}
                >
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </p>
              </article>

              {/* WIDGET KAPASITAS */}
              <article
                className={`bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden transition-colors ${isBinFull ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              >
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Kapasitas Bin
                </h3>
                <p
                  className={`text-3xl font-bold mt-2 ${isBinFull ? "text-red-600" : "text-blue-600"}`}
                >
                  {capacity}%
                </p>

                {/* Indikator Bar Dinamis di bawah widget */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-100">
                  <div
                    className={`h-full transition-all duration-500 ease-in-out ${isBinFull ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${capacity}%` }}
                  ></div>
                </div>
              </article>

              {/* TOTAL HARI INI */}
              <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Total Hari Ini
                </h3>
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {todayStats.total}{" "}
                  <span className="text-lg text-gray-500 font-medium">
                    Item
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  🟢 {todayStats.organik} Organik · 🔵 {todayStats.anorganik}{" "}
                  Anorganik
                </p>
              </article>
            </div>

            {/* Grafik & Foto Hasil Deteksi */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Grafik */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Statistik Klasifikasi Sampah Hari Ini
                  </h3>
                </div>
                <div className="w-full h-72 relative">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* Kamera Terakhir */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Foto Hasil Deteksi Terakhir
                  </h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 border border-gray-100 rounded-lg overflow-hidden relative group aspect-square lg:aspect-auto lg:h-72">
                  <img
                    src={`http://localhost:3000/uploads/latest.jpg?t=${imgTimestamp}`}
                    alt="Terdeteksi Terakhir"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image doesn't exist yet
                      e.target.onerror = null;
                      e.target.src =
                        "https://placehold.co/600x400/f3f4f6/9ca3af?text=Belum+Ada+Foto";
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs text-white text-xs p-3 flex justify-between items-center opacity-90 transition-opacity">
                    <span className="font-semibold">ESP32-CAM Preview</span>
                    <span className="text-[10px] text-gray-300">
                      Auto-refresh aktif
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
