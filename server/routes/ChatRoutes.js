import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  blockChatUser,
  clearChat,
  deleteChatForUser,
  muteChat,
} from "../controllers/ChatController.js";

const chatRoutes = Router();

chatRoutes.post("/:chatId/clear", verifyToken, clearChat);
chatRoutes.post("/:chatId/mute", verifyToken, muteChat);
chatRoutes.post("/:chatId/block", verifyToken, blockChatUser);
chatRoutes.delete("/:chatId", verifyToken, deleteChatForUser);

export default chatRoutes;
