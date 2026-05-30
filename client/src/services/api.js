/**
 * api.js
 * ======
 * Service terpusat untuk memanggil API backend SmartBin.
 * Semua request menyertakan JWT token dari localStorage.
 */

const API_BASE_URL = "http://127.0.0.1:3000/api";

/**
 * Helper untuk melakukan fetch dengan authorization header.
 */
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API Error: ${response.status}`);
  }

  return data;
}

// ============ BINS API ============

/**
 * Mendapatkan status satu bin.
 * @param {string} binId - ID bin (default: "bin-001")
 */
export async function getBinStatus(binId = "bin-001") {
  return fetchAPI(`/bins/status?binId=${binId}`);
}

/**
 * Mendapatkan daftar semua bin.
 */
export async function getAllBins() {
  return fetchAPI("/bins");
}

/**
 * Mendapatkan alert/peringatan bin.
 * @param {string} binId - ID bin
 * @param {string} resolved - "true" atau "false"
 */
export async function getBinAlerts(binId = "bin-001", resolved = "false") {
  return fetchAPI(`/bins/alerts?binId=${binId}&resolved=${resolved}`);
}

// ============ WASTE API ============

/**
 * Mendapatkan data sampah terbaru hari ini.
 */
export async function getWasteLatest() {
  return fetchAPI("/waste/latest");
}

/**
 * Mendapatkan riwayat pemilahan sampah.
 * @param {string} date - Tanggal format YYYY-MM-DD (opsional)
 * @param {number} limit - Jumlah data (default: 50)
 */
export async function getWasteHistory(date, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (date) params.append("date", date);
  return fetchAPI(`/waste/history?${params.toString()}`);
}

/**
 * Mendapatkan statistik sampah.
 * @param {string} period - "today", "weekly", atau "monthly"
 * @param {string} binId - ID bin (default: "bin-001")
 */
export async function getWasteStats(period = "today", binId = "bin-001") {
  return fetchAPI(`/waste/stats?period=${period}&binId=${binId}`);
}

// ============ SYSTEM API ============

/**
 * Cek apakah server online (health check).
 */
export async function getServerHealth() {
  try {
    const response = await fetch(`http://127.0.0.1:3000/`);
    return { online: response.ok };
  } catch {
    return { online: false };
  }
}
