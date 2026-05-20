const path = require("path");

// Tambahkan "../" agar Node.js mundur satu folder ke 'server/' untuk mencari .env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcrypt");
const { db } = require("../config/firebase");

async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database structure...\n");

    // 1️⃣ Test connection first
    console.log("1️⃣ Testing Firebase connection...");
    // Tambah timeout agar jika .env salah, script tidak menggantung selamanya
    const connectedRef = db.ref(".info/connected");
    const connectionTimeout = setTimeout(() => {
      console.error(
        "\n❌ Connection Timeout! Periksa apakah FIREBASE_DATABASE_URL di .env sudah benar.",
      );
      process.exit(1);
    }, 10000);

    await connectedRef.once("value");
    clearTimeout(connectionTimeout);
    console.log("   ✅ Connection successful\n");

    // 2️⃣ Create bin structure
    console.log("2️⃣ Creating bin structure...");
    const binRef = db.ref("bins/bin-001");
    await binRef.set({
      info: {
        nama: "SmartBin Kampus A",
        lokasi: "Gedung Teknik Lt.1",
        lokasi_detail: {
          latitude: -6.862347,
          longitude: 107.919235,
        },
        kapasitas_max: 100,
        created_at: Date.now(),
      },
      status: {
        kapasitas_persen: 0,
        level_cm: 0,
        status: "normal",
        lastUpdate: Date.now(),
        servo_position: 0,
        is_online: true,
      },
      stats: {
        today: {
          total: 0,
          organik: 0,
          anorganik: 0,
          last_reset: Date.now(),
        },
        weekly: {
          total: 0,
          organik: 0,
          anorganik: 0,
        },
        monthly: {
          total: 0,
          organik: 0,
          anorganik: 0,
        },
      },
    });
    console.log("   ✅ Bin structure created\n");

    // 3️⃣ Create system status
    console.log("3️⃣ Creating system status...");
    const systemRef = db.ref("system");
    await systemRef.set({
      mqtt_status: {
        broker_connected: false,
        last_message: null,
        topics: {
          classification: "smartbin/classification",
          capacity: "smartbin/capacity",
          status: "smartbin/status",
        },
      },
      api_status: {
        server_online: true,
        uptime: 0,
        last_heartbeat: Date.now(),
      },
    });
    console.log("   ✅ System status created\n");

    // 4️⃣ Add sample data
    console.log("4️⃣ Adding sample waste data...");
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const sampleRef = db.ref(`sampah/${year}-${month}/${day}`);
    const timestamp1 = Date.now();
    const timestamp2 = timestamp1 + 5000;

    const sampleData = {
      [`${timestamp1}_sample1`]: {
        jenis: "Organik",
        confidence: 0.92,
        timestamp: timestamp1,
        binId: "bin-001",
        imageUrl: null,
      },
      [`${timestamp2}_sample2`]: {
        jenis: "Anorganik",
        confidence: 0.88,
        timestamp: timestamp2,
        binId: "bin-001",
        imageUrl: null,
      },
    };

    await sampleRef.set(sampleData);
    console.log("   ✅ Sample data added\n");

    // 5️⃣ Creating users structure
    console.log("5️⃣ Creating users structure...");
    const usersRef = db.ref("users");

    // Hash password 'admin123' sebelum disimpan ke Firebase
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await usersRef.set({
      admin_kampus_a: {
        username: "admin_bin",
        password: hashedPassword,
        nama: "Petugas Kampus A",
        role: "petugas",
      },
    });
    console.log("   ✅ User admin_bin successfully created\n");

    console.log("═══════════════════════════════════════════");
    console.log("✅ Database initialized successfully!");
    console.log("═══════════════════════════════════════════");
    console.log("📦 Created Nodes:");
    console.log(`   ✓ bins/bin-001`);
    console.log(`   ✓ system/mqtt_status & system/api_status`);
    console.log(`   ✓ sampah/${year}-${month}/${day}`);
    console.log(`   ✓ users/admin_kampus_a`);
    console.log("═══════════════════════════════════════════\n");

    console.log("🌐 Check your Firebase Console directly to see the updates.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error initializing database:");
    console.error("─────────────────────────────────");
    console.error(error);
    console.error("─────────────────────────────────\n");
    process.exit(1);
  }
}

initializeDatabase();
