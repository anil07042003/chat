import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "./.env" });

const uri = process.env.DATABASE_URL;
console.log("Testing MongoDB URI:", uri ? uri.replace(/:[^@]+@/, ":<redacted>@") : uri);

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log("✅ Direct mongoose connection succeeded");
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("❌ Direct mongoose connection failed:", err && err.message ? err.message : err);
  console.error(err);
  process.exit(1);
}
