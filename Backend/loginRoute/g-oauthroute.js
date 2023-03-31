const { passport } = require("../config/google-oauth");

const express = require("express");
const app = express();
const path = require("path");
const googlerouter = express.Router();

googlerouter.get("/login", (req, res) => {
  let X = path.join(__dirname + "/../../frontend/login.html");
  res.sendFile(X);
});
googlerouter.get("/msg", (req, res) => {
  let X = path.join(__dirname + "/../../frontend/masseges.html");
  res.sendFile(X);
});
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
    if (req.udata) {
      res.redirect("/google/login");
    } else {
      res.redirect("/google/msg");
    }
  }
);

module.exports = {
  googlerouter,
};
