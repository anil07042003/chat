import { Router } from "express";
import {
  createFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  searchFriendRequests,
  removeFriend,
} from "../controllers/FriendRequestsControllers.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";

const friendRequestsRoutes = Router();

friendRequestsRoutes.post("/create-friend-request", verifyToken, createFriendRequest);
friendRequestsRoutes.get("/get-friend-requests", verifyToken, getFriendRequests);
friendRequestsRoutes.put("/accept-friend-request", verifyToken, acceptFriendRequest);
friendRequestsRoutes.put("/reject-friend-request", verifyToken, rejectFriendRequest);
friendRequestsRoutes.post("/search-friend-requests", verifyToken, searchFriendRequests);
friendRequestsRoutes.delete("/remove-friend", verifyToken, removeFriend);

export default friendRequestsRoutes;
