import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  searchContacts,
  getContactsForDMList,
  getAllContacts,
  getContactFiles,
  getUserProfile,
  blockUser,
  unblockUser,
} from "../controllers/ContactsController.js";

const contactsRoutes = Router();

contactsRoutes.post("/search", verifyToken, searchContacts);
contactsRoutes.get("/get-contacts-for-dm", verifyToken, getContactsForDMList);
contactsRoutes.get("/get-all-contacts", verifyToken, getAllContacts);
contactsRoutes.get("/get-contact-files/:contactId", verifyToken, getContactFiles);
contactsRoutes.get("/profile/:userId", verifyToken, getUserProfile);
contactsRoutes.post("/block", verifyToken, blockUser);
contactsRoutes.post("/unblock", verifyToken, unblockUser);

export default contactsRoutes;
