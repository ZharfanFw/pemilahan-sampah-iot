// server/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../config/firebase"); // Sesuaikan path config firebase kamu

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_bukan_siapa_siapa";

// POST: /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validasi input
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username dan password wajib diisi" });
    }

    // 2. Cari user di Firebase Realtime DB berdasarkan username
    const usersRef = db.ref("users");
    const snapshot = await usersRef
      .orderByChild("username")
      .equalTo(username)
      .once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Username tidak ditemukan" });
    }

    // Ambil data user pertama yang cocok
    const userKey = Object.keys(snapshot.val())[0];
    const userData = snapshot.val()[userKey];

    // 3. Cek apakah password cocok dengan hash di database
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password salah" });
    }

    // 4. Buat JWT Token
    const token = jwt.sign(
      { uid: userKey, username: userData.username, role: userData.role },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    // 5. Kirim response ke React Frontend
    return res.status(200).json({
      message: "Login berhasil",
      token,
      user: {
        nama: userData.nama,
        role: userData.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
});

module.exports = router;
