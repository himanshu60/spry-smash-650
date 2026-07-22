const express = require("express");
const { MessageModel } = require("../models/message.schema");
const { verifyToken } = require("../middleware/verifyToken");

const messageRouter = express.Router();

// Conversation history between two users, oldest first.
// Requires auth, and the caller may only read their own conversations.
messageRouter.get("/:me/:peer", verifyToken, async (req, res) => {
  const { me, peer } = req.params;
  if (String(req.userId) !== String(me)) {
    return res.status(403).json({ err: "Forbidden" });
  }
  try {
    const messages = await MessageModel.find({
      $or: [
        { from: me, to: peer },
        { from: peer, to: me },
      ],
    })
      .sort({ time: 1 })
      .limit(500);
    res.send(messages);
  } catch (error) {
    res.status(500).send({ err: error.message });
  }
});

module.exports = { messageRouter };
