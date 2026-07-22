const jwt = require("jsonwebtoken");
require("dotenv").config();
const { UserModel } = require("../models/user.schema");

/**
 * Stateless JWT auth. Reads `Authorization: Bearer <token>`, verifies it with
 * the signing key, and attaches `req.userId`. Does not depend on Redis (unlike
 * the legacy authenticate.js), so it works with the in-memory token store too.
 */
function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ err: "Authentication required" });
    const decoded = jwt.verify(token, process.env.key);
    req.userId = decoded.user_id;
    next();
  } catch (e) {
    return res.status(401).json({ err: "Invalid or expired session" });
  }
}

/** Requires the authenticated user to have role "admin". Use after verifyToken. */
async function requireAdmin(req, res, next) {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ err: "Admin access required" });
    }
    req.userDoc = user;
    next();
  } catch (e) {
    return res.status(403).json({ err: "Admin access required" });
  }
}

module.exports = { verifyToken, requireAdmin };
