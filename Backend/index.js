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



// Each user gets a personal room `user:<id>`. Direct messages are delivered to
// the recipient's personal room, so they arrive whether or not the recipient
// currently has that conversation open. Presence is tracked by counting live
// sockets per user (a user may have several tabs open).
const onlineUsers = new Map(); // userId -> Set<socketId>

io.on("connection", (socket) => {
  // Client announces who it is.
  socket.on("identify", (data) => {
    const userId = data && data.userId;
    if (!userId) return;
    socket.data.userId = userId;
    socket.join(`user:${userId}`);

    let set = onlineUsers.get(userId);
    const wasOffline = !set || set.size === 0;
    if (!set) { set = new Set(); onlineUsers.set(userId, set); }
    set.add(socket.id);

    // Tell this socket who is already online, then announce this user.
    socket.emit("presence-init", [...onlineUsers.keys()]);
    if (wasOffline) io.emit("presence", { userId, online: true });
  });

  // Direct message → deliver to the recipient's personal room.
  socket.on("send-dm", (msg) => {
    if (!msg || !msg.to) return;
    socket.to(`user:${msg.to}`).emit("recv-dm", msg);
  });

  // Typing indicator → recipient only.
  socket.on("set-typing", (state) => {
    if (!state || !state.to) return;
    socket.to(`user:${state.to}`).emit("peer-typing", state);
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (!userId) return;
    const set = onlineUsers.get(userId);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      onlineUsers.delete(userId);
      io.emit("presence", { userId, online: false });
    }
  });
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
