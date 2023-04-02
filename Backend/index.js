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
const { detailUserRoute } = require("./routes/detailroute");
const app = express();




app.use(express.json());
app.use(cookieParser());
app.use(cors());
// <------------   Socket.io  ----------------->
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);



io.on("connection", (socket) => {
  socket.on("roomName", (data) => {
    console.log(data);
    let roomName = data.roomid;

    let users = [roomName, data.loggedUser];
    socket.join(`${roomName}`);
    console.log("room joined", roomName);
    io.to(`${roomName}`).emit("join", users);
    let x;
    socket.on("friend_msg", (msg) => {
      console.log(msg);
      x = msg;
      console.log(data.id);
      // io.to(`${roomName}`).emit("display_friend_msg", msg);
      socket.to(`${data.id}`).to(`${roomName}`).emit("display_friend_msg", x);
    })

  })

});


// <------------   Socket end ----------------->
app.use("/user", userRouter);
app.use("/", githubRouter);
app.use("/google", googlerouter);
app.use("/facebook", fbrouter);
app.use("/details", detailUserRoute);

server.listen(process.env.port, async () => {
  try {
    await connection;
    console.log(`connected to port at ${process.env.port}`);
  } catch (error) {
    console.log(error);
  }
});
//mongodb+srv://yuvraj:yuvraj@cluster0.hhjiny0.mongodb.net/chatappu5?retryWrites=true&w=majority

//mongodb+srv://raghuvanshi:raghuvanshi@cluster0.pd5wkd1.mongodb.net/chat-application
