const { passport } = require("../config/google-oauth");
require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const googlerouter = express.Router();
const cookieParser = require('cookie-parser');
googlerouter.use(cookieParser())
// let user;

// googlerouter.get("/login", (req, res) => {
//   let z = String(user._id);
//   // res.cookie("user", JSON.stringify(req.user));
//   res.cookie("user", z);
//   let X = path.join(__dirname + "/../../frontend/login.html");
//   res.sendFile(X);
// });
// googlerouter.get("/msg", (req, res) => {
//   let X = path.join(__dirname + "/../../frontend/masseges.html");
//   res.sendFile(X);
// });
googlerouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

googlerouter.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/google/login",
    session: false,
  }),
  function (req, res) {
    let user = req.user;

    res.redirect(`${process.env.base_url}/frontend/masseges.html?id=${user._id}`);
  }
);

module.exports = {
  googlerouter
};
