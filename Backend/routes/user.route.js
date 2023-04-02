const express = require("express");
const jwt = require("jsonwebtoken");
const { redisclient } = require("../config/redis");
require("dotenv").config();
const bcrypt = require("bcrypt");
const { UserModel } = require("../models/user.schema");
const { authmiddleware } = require("../middleware/authenticate");
const path = require("path");
const userRouter = express.Router();


userRouter.post("/signup", async (req, res, next) => {
  let { name, email, password } = req.body;
  // console.log(name,email,password)

  try {
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

userRouter.post("/login", async (req, res, next) => {
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

        await redisclient.SET(user.email, JSON.stringify({ token }));
        res.cookie("email", `${user.email}`);
        // await redisclient.SET("tokens", JSON.stringify({token}));
        res.json({ msg: "LogIn Sucessfully", token, email, id: user._id });
      } else {
        res.status(404).json({ err: "Wrong credentials" });
      }
    });
  } catch (error) {
    res.status(500).json({ err: error.message });
  }
});

//get data
userRouter.get("/get", async (req, res, next) => {
  // const payload = req.body;
  try {
    const user = await UserModel.find()
    res.send(user)
  } catch (error) {
    console.log(error);
  }
})

//delete data
userRouter.delete("/delete/:id", async (req, res) => {
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
