import { Router } from "express";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  createGroup,
  getUserGroups,
  getGroupMessages,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  updateGroupInfo,
  updateGroupImage,
  promoteToAdmin,
  demoteFromAdmin,
  getGroupFiles,
  getGroupsInCommon,
  searchGroups,
} from "../controllers/GroupControllers.js";

if (!existsSync("uploads/groups")) {
  mkdirSync("uploads/groups", { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/groups/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-group${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const groupRoutes = Router();

groupRoutes.post("/create-group", verifyToken, createGroup);
groupRoutes.get("/get-user-groups", verifyToken, getUserGroups);
groupRoutes.get("/get-group-messages/:groupId", verifyToken, getGroupMessages);
groupRoutes.get("/get-group-members/:groupId", verifyToken, getGroupMembers);
groupRoutes.post("/add-members/:groupId", verifyToken, addGroupMembers);
groupRoutes.delete("/remove-member/:groupId/:memberId", verifyToken, removeGroupMember);
groupRoutes.put("/update-info/:groupId", verifyToken, updateGroupInfo);
groupRoutes.post("/update-image/:groupId", verifyToken, upload.single("group-image"), updateGroupImage);
groupRoutes.put("/promote/:groupId/:memberId", verifyToken, promoteToAdmin);
groupRoutes.put("/demote/:groupId/:memberId", verifyToken, demoteFromAdmin);
groupRoutes.get("/get-group-files/:groupId", verifyToken, getGroupFiles);
groupRoutes.get("/get-groups-in-common/:contactId", verifyToken, getGroupsInCommon);
groupRoutes.post("/search-groups", verifyToken, searchGroups);

export default groupRoutes;
