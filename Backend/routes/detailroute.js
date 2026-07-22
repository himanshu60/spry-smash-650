const express = require("express");

const detailUserRoute = express.Router();
const { UserModel } = require("../models/user.schema");
const { verifyToken } = require("../middleware/verifyToken");

detailUserRoute.get("/get", verifyToken, async (req, res) => {
    let users = await UserModel.find().select("-password");
    res.send(users);
})




module.exports = {
    detailUserRoute
}