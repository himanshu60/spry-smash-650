const express = require("express");
const { MessageModel } = require("../models/message.schema");

const messageRouter = express.Router();

// Conversation history between two users, oldest first.
messageRouter.get("/:me/:peer", async (req, res) => {
  const { me, peer } = req.params;
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
