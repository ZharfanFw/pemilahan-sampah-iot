require("dotenv").config();
const { db, getData, setData } = require("./config/firebase");

async function testFirebase() {
  try {
    console.log("🧪 Testing Firebase connection...\n");

    // Test 1: Write data
    console.log("1️⃣ Writing test data...");
    await setData("system/test", {
      message: "Hello from backend!",
      timestamp: Date.now(),
    });
    console.log("   ✅ Write successful\n");

    // Test 2: Read data
    console.log("2️⃣ Reading test data...");
    const testData = await getData("system/test");
    console.log("   📦 Data:", testData, "\n");

    // Test 3: Read bin status
    console.log("3️⃣ Reading bin status...");
    const binStatus = await getData("bins/bin-001/status");
    if (binStatus) {
      console.log("   📦 Bin Status:", binStatus, "\n");
    } else {
      console.log("   ⚠️  No bin data found. Run: npm run init-db\n");
    }

    console.log("✅ All tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testFirebase();
