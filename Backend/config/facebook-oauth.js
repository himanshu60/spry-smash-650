const FacebookStrategy = require("passport-facebook").Strategy;
const passport2 = require("passport");
const { UserModel } = require("../models/user.schema");
const { v4: uuidv4 } = require("uuid");
const {redisclient}=require("./redis")
const { JsonWebTokenError } = require("jsonwebtoken");
require("dotenv").config();
passport2.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:8080/facebook/auth/facebook/callback",
      profileFields: ["id", "displayName", "photos", "email"],
    },
    async function (accessToken, refreshToken, profile, cb) {
      await redisclient.SET("tokens", JSON.stringify({"token":accessToken}));
      let email = profile._json.email;
      let udata = await UserModel.findOne({ email });
      if (udata) {
        return cb(null, udata);
      }
      let name = profile._json.name;
      let N = name.trim().split(" ");
      let logo = N[0][0] + N[N.length - 1][0];
      const user = new UserModel({
        name,
        logo,
        email,
        password: uuidv4(),
      });
      await user.save();
      return cb(null, user);
      console.log(profile);
    }
  )
);

module.exports = { passport2 };
