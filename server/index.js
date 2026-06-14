import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";
import { networkInterfaces } from "os";

import authRoutes from "./routes/AuthRoutes.js";
import contactsRoutes from "./routes/ContactRoutes.js";
import messagesRoutes from "./routes/MessagesRoutes.js";
import groupRoutes from "./routes/GroupRoutes.js";
import friendRequestsRoutes from "./routes/FriendRequestsRoute.js";
import callRoutes from "./routes/CallRoutes.js";
import settingsRoutes from "./routes/SettingsRoutes.js";
import chatRoutes from "./routes/ChatRoutes.js";
import setupSocket from "./socket.js";
import { apiRateLimiter, authRateLimiter } from "./middlewares/RateLimiter.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const uploadDirs = ["uploads/profiles", "uploads/files", "uploads/groups"];
uploadDirs.forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
const port = process.env.PORT || 3001;

// ─── CORS ──────────────────────────────────────────────────────────────────
// In development: allow ALL origins so mobile devices on the same Wi-Fi
// and VS Code forwarded ports can connect without CORS errors.
// In production: restrict to the explicit ORIGIN list.
const allowedOrigins = process.env.ORIGIN
  ? process.env.ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:5173"];

const isDev = process.env.NODE_ENV !== "production";
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // In development allow everything — network IPs, forwarded ports, etc.
      if (isDev) return callback(null, true);
      // In production check the allowlist
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// ─── STATIC FILES ──────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── ROUTES ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/contacts", apiRateLimiter, contactsRoutes);
app.use("/api/messages", apiRateLimiter, messagesRoutes);
app.use("/api/groups", apiRateLimiter, groupRoutes);
app.use("/api/chats", apiRateLimiter, chatRoutes);
app.use("/api/friend-requests", apiRateLimiter, friendRequestsRoutes);
app.use("/api/calls", apiRateLimiter, callRoutes);
app.use("/api/settings", apiRateLimiter, settingsRoutes);

// Health check — shows DB connection state
app.get("/health", (req, res) => {
  const dbStates = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const dbState = mongoose.connection.readyState;
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? "ok" : "degraded",
    database: dbStates[dbState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

// ─── ERROR HANDLER ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ─── START SERVER ──────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so the server is reachable from:
//   - localhost (same machine)
//   - local network IP (e.g. 192.168.x.x) for mobile devices on same Wi-Fi
//   - VS Code forwarded ports / public URLs

const printNetworkUrls = (port) => {
  console.log(`🚀 BaatChit server running on port ${port}`);
  console.log(`   Local:   http://localhost:${port}`);
  try {
    const nets = networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`   Network: http://${net.address}:${port}`);
        }
      }
    }
  } catch (_) {}
};

const server = app.listen(port, "0.0.0.0", () => {
  printNetworkUrls(port);
});

setupSocket(server);

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────
// Ensures the port is released when the process exits (Ctrl+C, nodemon restart, etc.)
const shutdown = () => {
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);

// ─── DATABASE ──────────────────────────────────────────────────────────────
const connectDB = async (retries = 5, delay = 3000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(process.env.DATABASE_URL, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log("✅ Connected to MongoDB:", process.env.DATABASE_URL);
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i}/${retries} failed:`, err.message);
      if (i < retries) {
        console.log(`   Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("❌ All MongoDB connection attempts failed. Auth will return 503 until DB is available.");
        console.error("   Make sure MongoDB is running: mongod --dbpath <your-db-path>");
        console.error("   DATABASE_URL:", process.env.DATABASE_URL);
      }
    }
  }
};

connectDB();

export default app;
