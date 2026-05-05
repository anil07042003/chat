import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import { initiateCall, updateCallStatus, getCallHistory } from "../controllers/CallController.js";

const callRoutes = Router();

callRoutes.post("/initiate", verifyToken, initiateCall);
callRoutes.put("/status/:callId", verifyToken, updateCallStatus);
callRoutes.get("/history", verifyToken, getCallHistory);

export default callRoutes;
