const requestCounts = new Map();

export const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const data = requestCounts.get(key);

    if (now > data.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (data.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests, please try again later" });
    }

    data.count++;
    next();
  };
};

export const authRateLimiter = rateLimiter(20, 60000); // 20 auth requests per minute
export const apiRateLimiter = rateLimiter(200, 60000); // 200 API requests per minute
