import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  const jwtKey = process.env.JWT_KEY || "baatchit";
  jwt.verify(token, jwtKey, (error, payload) => {
    if (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(403).json({ error: "Invalid token" });
    }
    req.userId = payload.userId;
    next();
  });
};

export const optionalAuth = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return next();

  const jwtKey = process.env.JWT_KEY || "baatchit";
  jwt.verify(token, jwtKey, (error, payload) => {
    if (!error) req.userId = payload.userId;
    next();
  });
};
