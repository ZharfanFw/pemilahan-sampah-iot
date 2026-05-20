const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

let db;

function initializeFirebase() {
  try {
    // Check if .env is loaded
    if (!process.env.FIREBASE_DATABASE_URL) {
      throw new Error("FIREBASE_DATABASE_URL not found in .env file");
    }

    // Path to service account file
    const serviceAccountPath = path.join(
      __dirname,
      "../smart-waste-iot-firebase-adminsdk.json",
    );

    // Check if file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Service account file not found at: ${serviceAccountPath}`,
      );
    }

    // Load service account
    const serviceAccount = require(serviceAccountPath);

    // Validate service account structure
    if (
      !serviceAccount.project_id ||
      !serviceAccount.private_key ||
      !serviceAccount.client_email
    ) {
      throw new Error("Invalid service account JSON structure");
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    db = admin.database();

    console.log("✅ Firebase Admin initialized successfully");
    console.log(`📦 Project: ${serviceAccount.project_id}`);
    console.log(`🔗 Database: ${process.env.FIREBASE_DATABASE_URL}`);

    return db;
  } catch (error) {
    console.error("\n❌ Firebase Initialization Error:");
    console.error("─────────────────────────────────");
    console.error(`Message: ${error.message}`);
    console.error("─────────────────────────────────\n");

    if (error.message.includes("FIREBASE_DATABASE_URL")) {
      console.error("💡 Solution:");
      console.error("   1. Create .env file in server/ folder");
      console.error(
        "   2. Add: FIREBASE_DATABASE_URL=https://your-project.firebaseio.com\n",
      );
    }

    if (error.message.includes("Service account file not found")) {
      console.error("💡 Solution:");
      console.error(
        "   1. Go to Firebase Console → Project Settings → Service Accounts",
      );
      console.error('   2. Click "Generate new private key"');
      console.error(
        "   3. Save as: server/smart-waste-iot-firebase-adminsdk.json\n",
      );
    }

    process.exit(1);
  }
}

// Initialize on module load
db = initializeFirebase();

// Helper functions
const firebaseHelpers = {
  // Get reference by path
  getRef: (path) => {
    if (!db) throw new Error("Firebase not initialized");
    return db.ref(path);
  },

  // Get data once
  getData: async (path) => {
    if (!db) throw new Error("Firebase not initialized");
    const snapshot = await db.ref(path).once("value");
    return snapshot.val();
  },

  // Set data
  setData: async (path, data) => {
    if (!db) throw new Error("Firebase not initialized");
    await db.ref(path).set(data);
  },

  // Update data
  updateData: async (path, data) => {
    if (!db) throw new Error("Firebase not initialized");
    await db.ref(path).update(data);
  },

  // Push new data (auto-generated key)
  pushData: async (path, data) => {
    if (!db) throw new Error("Firebase not initialized");
    const newRef = await db.ref(path).push(data);
    return newRef.key;
  },

  // Delete data
  deleteData: async (path) => {
    if (!db) throw new Error("Firebase not initialized");
    await db.ref(path).remove();
  },

  // Query with filters
  queryData: async (path, orderBy, limitTo) => {
    if (!db) throw new Error("Firebase not initialized");
    let query = db.ref(path).orderByChild(orderBy);
    if (limitTo) {
      query = query.limitToLast(limitTo);
    }
    const snapshot = await query.once("value");
    return snapshot.val();
  },
};

module.exports = { admin, db, ...firebaseHelpers };
