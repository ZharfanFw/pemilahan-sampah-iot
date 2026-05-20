// initAdmin.js
const path = require("path");

// Tambahkan "../" agar Node.js mundur satu folder ke 'server/' untuk mencari .env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const bcrypt = require("bcrypt");
const { db } = require("../config/firebase");

async function injectAdmin() {
  try {
    console.log("🔄 Injecting Admin User...");
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await db.ref("users/admin_kampus_a").set({
      username: "admin_bin",
      password: hashedPassword,
      nama: "Petugas Kampus A",
      role: "petugas",
    });

    console.log("✅ Admin 'admin_bin' successfully created!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

injectAdmin();
