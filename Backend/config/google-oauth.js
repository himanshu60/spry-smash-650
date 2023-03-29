var GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport=require("passport")
 const {UserModel}=require("../models/user.schema")
const { v4: uuidv4 } = require('uuid');
require('dotenv').config()
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8080/google/auth/google/callback"
  },
 async function(accessToken, refreshToken, profile, cb) {
  
      let email=profile._json.email
      let name=profile._json.name
      let N=name.trim().split(" ")
      let logo=N[0][0]+N[N.length-1][0]
    const user=new UserModel({
        name,
        logo,
        email,
        password:uuidv4()
    })
    await user.save()
      return cb(null, user);
    
  }
));


module.exports={passport}