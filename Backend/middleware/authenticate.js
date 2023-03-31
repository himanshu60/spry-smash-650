const jwt = require("jsonwebtoken");
require("dotenv").config();

const { UserModel } = require("../models/user.schema");
const { redisclient } = require("../config/redis");

const authmiddleware = async (req, res, next) => {
  try {
    const cookieMail = req.cookies.email;
    const tokens = JSON.parse(await redisclient.GET(cookieMail));
    const blacklistToken = await redisclient.HGET("blockedToken", cookieMail);
    if (blacklistToken == tokens.token) {
      return res.send("Userloggedout Please login Again");
    }
    const decodedverifyToken = jwt.verify(tokens.token, process.env.key);
    const { user_id } = decodedverifyToken;
    // old user
    const user = await UserModel.findById(user_id);
    if (!user) {
      return res.status(401).json({ message: "You are not authorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: error.message });
  }
};

module.exports = { authmiddleware };
