const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const { githubRouter } = require("./loginRoute/github.route");
const { googlerouter } = require("./loginRoute/g-oauthroute");
const { authmiddleware } = require("./middleware/authenticate");
const { fbrouter } = require("./loginRoute/fb-oauthrout");
const cookieParser = require("cookie-parser");
const app = express();
 
 
 
 
app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use("/user", userRouter);
app.use("/", githubRouter);
app.use("/google", googlerouter);
app.use("/facebook", fbrouter);

 
app.listen(process.env.port, async () => {
  try {
    await connection;
    console.log(`connected to port at ${process.env.port}`);
  } catch (error) {
    console.log(error);
  }
});
//mongodb+srv://yuvraj:yuvraj@cluster0.hhjiny0.mongodb.net/chatappu5?retryWrites=true&w=majority

//mongodb+srv://raghuvanshi:raghuvanshi@cluster0.pd5wkd1.mongodb.net/chat-application
