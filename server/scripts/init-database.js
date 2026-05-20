require("dotenv").config();

// Delayed require to ensure .env is loaded first
const { db } = require("../config/firebase");

async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database structure...\n");

    // Test connection first
    console.log("1️⃣ Testing Firebase connection...");
    await db.ref(".info/connected").once("value");
    console.log("   ✅ Connection successful\n");

    // 2. Create bin structure
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

    // 3. Create system status
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

    // 4. Add sample data
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

    console.log("═══════════════════════════════════════════");
    console.log("✅ Database initialized successfully!");
    console.log("═══════════════════════════════════════════");
    console.log("📦 Created:");
    console.log(`   ✓ bins/bin-001`);
    console.log(`   ✓ system/mqtt_status`);
    console.log(`   ✓ system/api_status`);
    console.log(`   ✓ sampah/${year}-${month}/${day} (2 sample entries)`);
    console.log("═══════════════════════════════════════════\n");

    console.log("🌐 View in Firebase Console:");
    console.log("   https://console.firebase.google.com/\n");

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
