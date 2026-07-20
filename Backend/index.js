const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
// const { githubRouter } = require("./loginRoute/github.route");
// const { googlerouter } = require("./loginRoute/g-oauthroute");
const { authmiddleware } = require("./middleware/authenticate");
// const { fbrouter } = require("./loginRoute/fb-oauthrout");
const cookieParser = require("cookie-parser");
const { detailUserRoute } = require("./routes/detailroute");
const path = require("path");
const app = express();




app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "*" }));

// Serve the static frontend from the backend so the whole app runs as a single
// same-origin service (no CORS/cookie issues, one deploy target).
app.use(express.static(path.join(__dirname, "../frontend")));
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   next();
// });

// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.setHeader(
//     "Access-Control-Allow-Methods",
//     "OPTIONS, GET, POST, PUT, PATCH, DELETE"
//   );
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   if (req.method === "OPTIONS") {
//     return res.sendStatus(200);
//   }
//   next();
// });
// <------------   Socket.io  ----------------->
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});



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
// app.use("/", githubRouter);
// app.use("/google", googlerouter);
// app.use("/facebook", fbrouter);
app.use("/details", detailUserRoute);

const PORT = process.env.port || process.env.PORT || 8080;
server.listen(PORT, async () => {
  try {
    await connection;
    console.log(`connected to port at ${PORT}`);
  } catch (error) {
    console.log(error);
  }
});
//mongodb+srv://yuvraj:yuvraj@cluster0.hhjiny0.mongodb.net/chatappu5?retryWrites=true&w=majority

//mongodb+srv://raghuvanshi:raghuvanshi@cluster0.pd5wkd1.mongodb.net/chat-application
