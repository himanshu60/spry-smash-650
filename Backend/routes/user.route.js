const express = require("express");
const jwt = require("jsonwebtoken");
const { redisclient } = require("../config/redis")

const bcrypt = require("bcrypt");
const { UserModel } = require("../models/user.schema")
const userRouter = express.Router();

userRouter.post("/signup", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const userExist = await UserModel.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: "user already exists" })
        }
        bcrypt.hash(password, 8, async (err, hash_pass) => {
            if (hash_pass) {
                const user = new UserModel({ name, email, password: hash_pass })
                await user.save();
                res.status(201).json({ msg: "Signup sucessfully" });
            } else {
                res.status(500).json({ error: error.message })
            }
        })
    } catch (error) {
        res.status(500).json({ err: error.message })
    }
})

// login part
userRouter.post("/login", async (req, res, next) => {
    const { email, password } = req.body;
    try {

        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }
        bcrypt.compare(password, user.password, async (err, result) => {
            if (result) {
                const token = jwt.sign({ user_id: user._id }, process.env.key, { expiresIn: "1d" })
                let obj = {
                    token
                }
                await redisclient.SET(user.email, JSON.stringify(obj))
                res.cookie("email", `${user.email}`)
                res.json({ msg: "LogIn Sucessfully", token })
            } else {
                res.status(404).json({ err: "Wrong credentials" })
            }
        })
    } catch (error) {
        res.status(500).json({ err: error.message })
    }
})

// logout
userRouter.post("/logout", async (req, res) => {
    try {
        const cookieMail = req.cookies.email
        const tokens = JSON.parse(await redisclient.GET(cookieMail));
        // console.log(tokens)
        await redisclient.HSET("blockedToken", cookieMail, tokens.token);
        res.send("Logout Sucessfully blocked token store in redis")
    } catch (error) {
        res.status(404).json({ err: error.message })
    }
})


module.exports = { userRouter }