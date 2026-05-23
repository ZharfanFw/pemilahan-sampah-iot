import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Pengaturan() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || { nama: "Petugas" };

  // 1. STATE UNTUK KALIBRASI SENSOR (Sesuai Logika Ultrasonic di Canvas)
  const [config, setConfig] = useState({
    tinggiMaks: 50, // cm
    batasPenuh: 5, // cm
    mqttBroker: "broker.emqx.io",
    deviceId: "smartbin-001",
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleSave = (e) => {
    e.preventDefault();
    alert("Konfigurasi berhasil disimpan ke sistem!");
    // Nantinya di sini akan memanggil API POST /api/config
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      {/* SIDEBAR (Tetap Konsisten) */}
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
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition-colors"
              >
                Dashboard Utama
              </a>
            </li>
            <li>
              <a
                href="/riwayat"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition-colors"
              >
                Riwayat Sampah
              </a>
            </li>
            <li>
              <a
                href="/pengaturan"
                className="block px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg"
              >
                Pengaturan
              </a>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Pengaturan Sistem
          </h1>
          <p className="text-gray-500 mt-2">
            Kelola kalibrasi perangkat IoT dan preferensi akun.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* BAGIAN 1: KALIBRASI SENSOR ULTRASONIC */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg text-green-600">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold">Kalibrasi Jarak Bin</h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Tinggi Maksimal Tong (Kosong) - cm
                </label>
                <input
                  type="number"
                  value={config.tinggiMaks}
                  onChange={(e) =>
                    setConfig({ ...config, tinggiMaks: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Batas Jarak Penuh (100%) - cm
                </label>
                <input
                  type="number"
                  value={config.batasPenuh}
                  onChange={(e) =>
                    setConfig({ ...config, batasPenuh: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors mt-4"
              >
                Simpan Kalibrasi
              </button>
            </form>
          </section>

          {/* BAGIAN 2: STATUS PERANGKAT & KONEKSI */}
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Status Konektivitas</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">
                    MQTT Broker Status
                  </span>
                  <span className="flex items-center gap-1.5 text-green-600 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>{" "}
                    CONNECTED
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">
                    Last Sync ESP32-CAM
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    22-05-2026 14:02:11
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Informasi Akun</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {user.nama.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{user.nama}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                    Petugas Administrasi
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
