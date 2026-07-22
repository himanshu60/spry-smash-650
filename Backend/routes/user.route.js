const express = require("express");
const jwt = require("jsonwebtoken");
const { redisclient } = require("../config/redis");
require("dotenv").config();
const bcrypt = require("bcrypt");
const { UserModel } = require("../models/user.schema");
const { verifyToken, requireAdmin } = require("../middleware/verifyToken");
const path = require("path");
const userRouter = express.Router();

// Simple in-memory login rate limiter (per IP): guards against brute force.
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 20;
  let rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + windowMs };
    loginAttempts.set(ip, rec);
  }
  rec.count++;
  if (rec.count > max) {
    return res.status(429).json({ err: "Too many attempts. Please try again later." });
  }
  next();
}

// Emails treated as admins (configurable via env). Defaults to the accounts
// documented as admins in the original project.
const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ||
  "himanshu@gmail.com,rahul@gmail.com,saloni@gmail.com,yuvraj@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);


userRouter.post("/signup", async (req, res, next) => {
  let { name, email, password } = req.body;
  // console.log(name,email,password)

  try {
    if (!name || !email || !password) {
      return res.status(400).send({ msg: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).send({ msg: "Password must be at least 6 characters" });
    }
    const userExist = await UserModel.findOne({ email });
    if (userExist) {
      return res.status(400).send({ msg: "user already exists" });
    }
    bcrypt.hash(password, 8, async (err, hash_pass) => {
      if (err) {
        res.send({ msg: "user already registered" });
      } else {
        let Y = name.trim().split(" ");
        let logo;
        if (Y.length > 1) {
          logo = Y[0][0] + Y[Y.length - 1][0];
        } else {
          logo = Y[0][0];
        }
        let user = new UserModel({
          name,
          logo,
          email,
          password: hash_pass,
        });
        let X = await user.save();
        console.log(X);
        res.send(JSON.stringify(X));
      }
    });
  } catch (err) {
    res.status(404).send({ err: err.message });
  }
});

userRouter.post("/login", rateLimitLogin, async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    bcrypt.compare(password, user.password, async (err, result) => {
      if (result) {
        const token = jwt.sign({ user_id: user._id }, process.env.key, {
          expiresIn: "1d",
        });

        // Resolve role: honor a stored admin role or the admin allowlist.
        const isAdmin =
          user.role === "admin" ||
          ADMIN_EMAILS.includes(String(user.email).toLowerCase());
        const role = isAdmin ? "admin" : "user";
        if (user.role !== role) {
          user.role = role;
          await user.save().catch(() => {});
        }

        await redisclient.SET(user.email, JSON.stringify({ token }));
        res.cookie("email", `${user.email}`, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 24 * 60 * 60 * 1000,
        });
        res.json({
          msg: "LogIn Sucessfully",
          token,
          email,
          id: user._id,
          name: user.name,
          role,
        });
      } else {
        res.status(404).json({ err: "Wrong credentials" });
      }
    });
  } catch (error) {
    res.status(500).json({ err: error.message });
  }
});

//get data (admin only)
userRouter.get("/get", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const user = await UserModel.find().select("-password")
    res.send(user)
  } catch (error) {
    console.log(error);
  }
})

//delete data (admin only)
userRouter.delete("/delete/:id", verifyToken, requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const deleteduser = await UserModel.findByIdAndRemove({ "_id": id });
    res.send(deleteduser);
    console.log(deleteduser);

  } catch (err) {
    res.send({ status: err.message });
  }
});



// logout
userRouter.get("/logout", async (req, res) => {
  try {
    let cookieMail = req.cookies.email;
    console.log(cookieMail, "1")
    let tokens
    if (cookieMail) {
      tokens = JSON.parse(await redisclient.GET(cookieMail))
      await redisclient.HSET("blockedToken", cookieMail, tokens.token);
      console.log(cookieMail)
    }
    else {
      let email = await redisclient.GET("email")
      tokens = JSON.parse(await redisclient.GET(email));
      await redisclient.HSET("blockedToken", email, tokens.token);
      console.log(email, "google")
    }

    console.log(tokens)
    // let X = path.join("/../../frontend/login.html");
    // res.redirect("/google/login");
    res.send(`Logout Successfull`);
  } catch (error) {
    res.status(404).json({ err: error.message });
  }
});

module.exports = { userRouter };
