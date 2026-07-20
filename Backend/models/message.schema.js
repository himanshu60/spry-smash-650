const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    cid: { type: String }, // client-generated id (for receipt matching)
    from: { type: String, required: true }, // sender userId
    to: { type: String, required: true }, // recipient userId
    text: { type: String, required: true },
    time: { type: Number, required: true }, // client timestamp (ms)
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast lookup of a conversation between two users, in order.
messageSchema.index({ from: 1, to: 1, time: 1 });

const MessageModel = mongoose.model("message", messageSchema);

module.exports = { MessageModel };
