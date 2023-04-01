const { passport2 } = require("../config/facebook-oauth");
const path = require("path");
const express = require("express");
const fbrouter = express.Router();

fbrouter.get("/login", (req, res) => {
  let X = path.join(__dirname + "/../../frontend/masseges.html");
  res.sendFile(X);
});

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
    console.log(req.user);
    res.redirect("/facebook/login");
  }
);
module.exports = { fbrouter };
