const { passport2 } = require("../config/facebook-oauth");
const path = require("path");
const express = require("express");
const fbrouter = express.Router();
const cookieParser = require('cookie-parser');
require("dotenv").config();
fbrouter.use(cookieParser())
// let user;

// fbrouter.get("/login", (req, res) => {
//   let z = String(user._id);
//   // res.cookie("user", JSON.stringify(req.user));
//   res.cookie("user", z);
//   let X = path.join(__dirname + "/../../frontend/masseges.html");
//   res.sendFile(X);
// });

fbrouter.get(
  "/auth/facebook",
  passport2.authenticate("facebook", { scope: ["email"] })
);

fbrouter.get(
  "/auth/facebook/callback",
  passport2.authenticate("facebook", {
    failureRedirect: "/facebook/login",
    session: false,
  }),
  function (req, res) {
    let user = req.user;


    res.redirect(`${process.env.base_url}/frontend/masseges.html?id=${user._id}`);
  }
);
module.exports = { fbrouter };
