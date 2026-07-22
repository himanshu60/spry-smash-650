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
const { messageRouter } = require("./routes/message.route");
const { MessageModel } = require("./models/message.schema");
const path = require("path");
const app = express();




// CORS: since the backend also serves the frontend (same-origin), CORS isn't
// needed for normal use. Lock it to an allowlist when ALLOWED_ORIGINS is set;
// otherwise reflect the request origin (with credentials support).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
  credentials: true,
};

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

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
  cors: {
    origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
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

  // Direct message → persist, then deliver to the recipient's personal room.
  socket.on("send-dm", (msg) => {
    if (!msg || !msg.to || !msg.from) return;
    socket.to(`user:${msg.to}`).emit("recv-dm", msg);
    MessageModel.create({
      cid: msg.id,
      from: msg.from,
      to: msg.to,
      text: msg.text,
      time: msg.time || Date.now(),
    }).catch((e) => console.log("msg save error:", e.message));
  });

  // Typing indicator → recipient only.
  socket.on("set-typing", (state) => {
    if (!state || !state.to) return;
    socket.to(`user:${state.to}`).emit("peer-typing", state);
  });

  // Delivery / read receipts → relayed back to the original sender.
  socket.on("dm-delivered", (ack) => {
    if (!ack || !ack.to) return;
    socket.to(`user:${ack.to}`).emit("dm-delivered", ack);
  });
  socket.on("dm-read", (ack) => {
    if (!ack || !ack.to || !ack.from) return;
    socket.to(`user:${ack.to}`).emit("dm-read", ack);
    // Persist read state: messages sent by ack.to → ack.from are now read.
    MessageModel.updateMany(
      { from: ack.to, to: ack.from, read: false },
      { $set: { read: true } }
    ).catch((e) => console.log("read update error:", e.message));
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
app.use("/messages", messageRouter);

// Prefer the platform-provided PORT (Render/Railway set this) over a stray
// lowercase `port` from a .env, so hosting always binds the right port.
const PORT = process.env.PORT || process.env.port || 8080;
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
