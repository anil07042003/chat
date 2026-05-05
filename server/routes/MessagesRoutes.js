import { Router } from "express";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  getMessages,
  createMessage,
  markDelivered,
  markSeen,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  pinMessage,
  starMessage,
  searchMessages,
  uploadFile,
} from "../controllers/MessagesController.js";

// Ensure upload directory exists
if (!existsSync("uploads/files")) {
  mkdirSync("uploads/files", { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/files/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

const messagesRoutes = Router();

messagesRoutes.post("/get-messages", verifyToken, getMessages);
messagesRoutes.post("/create", verifyToken, createMessage);
messagesRoutes.put("/delivered/:messageId", verifyToken, markDelivered);
messagesRoutes.put("/seen", verifyToken, markSeen);
messagesRoutes.get("/:chatId", verifyToken, getMessages);
messagesRoutes.put("/edit/:messageId", verifyToken, editMessage);
messagesRoutes.delete("/delete/:messageId", verifyToken, deleteMessage);
messagesRoutes.post("/react/:messageId", verifyToken, addReaction);
messagesRoutes.delete("/react/:messageId", verifyToken, removeReaction);
messagesRoutes.put("/pin/:messageId", verifyToken, pinMessage);
messagesRoutes.put("/star/:messageId", verifyToken, starMessage);
messagesRoutes.post("/search", verifyToken, searchMessages);
messagesRoutes.post("/upload-file", verifyToken, upload.single("file"), uploadFile);

export default messagesRoutes;
