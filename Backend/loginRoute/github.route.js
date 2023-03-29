const express = require("express");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const client_id = "568155812b74c0d612c7";
const client_secret = "6b60f85eb0c563b4227ff0697a4ac01876bf04d8"
const githubRouter = express.Router()



githubRouter.get("/login", (req, res) => {
    res.sendFile(__dirname + "../frontend/login.html");
})

githubRouter.get("/auth/github", async (req, res) => {
    // console.log(req.query.code)
    const { code } = req.query;
    const accessToken = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            client_id: client_id,
            client_secret: client_secret,
            code
        })
    }).then((res) => res.json())
    // res.send("Your code is " + code);
    const access_token = accessToken.access_token

    const userDetails = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${access_token}`
        },
    }).then((res) => res.json())
    console.log(userDetails)
    // res.send("welcome to chat app home page")
    res.sendFile(__dirname + "/frontend/chat.html");
})


module.exports = { githubRouter }