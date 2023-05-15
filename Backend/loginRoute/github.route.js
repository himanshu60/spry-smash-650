const express = require("express");
require("dotenv").config();
const { passport3 } = require("../config/github-oauth");
const githubRouter = express.Router();
const path = require("path");
const cookieParser = require('cookie-parser');
githubRouter.use(cookieParser())

// githubRouter.get("/login", (req, res) => {
//   let z = String(user._id);
//   // res.cookie("user", JSON.stringify(req.user));
//   res.cookie("user", z);
//   // let X = path.join(__dirname + "/../../frontend/masseges.html");
//   res.sendFile(X);
// });

githubRouter.get(
  "/auth/github",
  passport3.authenticate("github", { scope: ["user:email"] })
);

githubRouter.get(
  "/auth/github/callback",
  passport3.authenticate("github", {
    failureRedirect: "/login",
    session: false,
  }),
  function (req, res) {
    let user = req.user;
    res.redirect(`${process.env.base_url}/masseges.html?id=${user._id}`);

  }
);

module.exports = { githubRouter };
