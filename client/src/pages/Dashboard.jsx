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
import { getBinStatus, getWasteStats, getWasteLatest } from "../services/api";

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

  // State untuk Real-time AI Camera Feed & Scanning
  const [latestWaste, setLatestWaste] = useState(null);
  const [prevTimestamp, setPrevTimestamp] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Fetch data dari API backend
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [binRes, statsRes, latestRes] = await Promise.all([
        getBinStatus("bin-001"),
        getWasteStats("today", "bin-001"),
        getWasteLatest(),
      ]);

      if (binRes.success) {
        setBinStatus(binRes.data);
      }

      if (statsRes.success) {
        setTodayStats(statsRes.data);
      }

      if (latestRes.success && latestRes.data) {
        const currentWaste = latestRes.data;
        setLatestWaste(currentWaste);

        setPrevTimestamp((prev) => {
          // Pertama kali load dashboard, simpan timestamp dasar saja tanpa animasi scanning
          if (prev === 0) {
            setShowResult(true);
            return currentWaste.timestamp;
          }

          // Jika ada data klasifikasi sampah baru masuk
          if (currentWaste.timestamp > prev) {
            setIsScanning(true);
            setShowResult(false);

            // Tampilkan animasi scanning laser selama 800ms, baru tampilkan bounding box AI
            setTimeout(() => {
              setIsScanning(false);
              setShowResult(true);
            }, 800);

            return currentWaste.timestamp;
          }

          return prev;
        });
      } else if (latestRes.success && !latestRes.data) {
        setLatestWaste(null);
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

  // Fetch awal + polling setiap 1.5 detik agar respon kamera & deteksi real-time
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
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
                <span>
                  Update: {lastUpdate.toLocaleTimeString("id-ID")}
                </span>
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

              {/* Kamera Terakhir (AI Object Detection Feed) */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-full">
                <style>
                  {`
                    @keyframes scan {
                      0% { top: 0%; opacity: 0.8; }
                      50% { top: 98%; opacity: 1; }
                      100% { top: 0%; opacity: 0.8; }
                    }
                  `}
                </style>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800">
                    Kamera Deteksi AI (Real-time)
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                    LIVE FEED
                  </span>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden relative group aspect-square lg:aspect-auto lg:h-72 shadow-inner border border-gray-900">
                  {/* The camera image */}
                  <img
                    src={`http://127.0.0.1:3000/uploads/latest.jpg?t=${imgTimestamp}`}
                    alt="Terdeteksi Terakhir"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://placehold.co/600x400/111827/4b5563?text=Koneksi+Kamera...";
                    }}
                  />

                  {/* 1. SCANNING LASER EFFECT (when isScanning is true) */}
                  {isScanning && (
                    <>
                      {/* Laser Line */}
                      <div className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_15px_#22c55e] pointer-events-none" 
                           style={{
                             animation: "scan 1.5s ease-in-out infinite"
                           }}
                      />
                      {/* Grid Pattern overlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.4))] pointer-events-none" />
                      {/* Scanning status banner */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs">
                        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-green-400 font-mono text-xs tracking-widest font-bold uppercase animate-pulse">
                          MENGANALISIS OBJEK...
                        </span>
                      </div>
                    </>
                  )}

                  {/* 2. OBJECT DETECTION BOUNDING BOXES (when showResult is true and we have latestWaste) */}
                  {showResult && latestWaste && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Bounding Box 1: Simulated Main Object */}
                      <div 
                        className={`absolute border-3 rounded-lg shadow-lg flex flex-col justify-between transition-all duration-300`}
                        style={{
                          left: "20%",
                          top: "20%",
                          width: "60%",
                          height: "60%",
                          borderColor: latestWaste.jenis === "Organik" ? "#22c55e" : "#3b82f6",
                          boxShadow: latestWaste.jenis === "Organik" ? "0 0 20px rgba(34,197,94,0.5)" : "0 0 20px rgba(59,130,246,0.5)",
                        }}
                      >
                        {/* Label Tag on top-left of box */}
                        <div 
                          className="absolute -top-7 -left-[3px] px-2 py-0.5 rounded-t-md text-[11px] font-mono font-bold text-white flex items-center gap-1 shadow-md"
                          style={{
                            backgroundColor: latestWaste.jenis === "Organik" ? "#22c55e" : "#3b82f6",
                          }}
                        >
                          <span>{latestWaste.jenis.toUpperCase()}</span>
                          <span>{(latestWaste.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Small corner decorative items like standard AI interfaces */}
                      <div className="absolute top-2 left-2 text-[9px] font-mono text-gray-400">
                        FPS: 15.2 | RES: 320x240
                      </div>
                      <div className="absolute top-2 right-2 text-[9px] font-mono text-gray-400">
                        CONF: THRESH 0.5
                      </div>
                    </div>
                  )}

                  {/* Bottom overlay status info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-xs text-white text-xs p-3 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-200">
                        {showResult && latestWaste ? `Terakhir: ${latestWaste.jenis}` : "Siap mendeteksi..."}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {showResult && latestWaste ? new Date(latestWaste.timestamp).toLocaleTimeString("id-ID") : "Menunggu objek masuk..."}
                      </span>
                    </div>
                    <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-semibold">
                      AUTO
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