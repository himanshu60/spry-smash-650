//var GoogleStrategy = require('passport-google-oauth20').Strategy;
const { passport } = require("../config/google-oauth");
//const {connection}=require("./config/db")
const express = require("express");
const app = express();
const path=require("path")
const googlerouter = express.Router();

googlerouter.get("/login", (req, res) => {
  let X=path.join(__dirname+"/frontend/message.html")
  res.sendFile(X);
  //console.log()
});

googlerouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

googlerouter.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  function (req, res) {
    // Successful authentication, redirect home.
    console.log(req.user);
    res.redirect("/google/login");
  }
);

module.exports = {
  googlerouter,
};
// app.listen(4500,async ()=>{

//     try{
//         await connection
//         console.log("connected to server at port 4500")
//     }catch(err){
//             console.log(err)
//     }
// })
