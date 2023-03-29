const express = require("express");
require("dotenv").config();

const { connection } = require("./config/db")
const { userRouter } = require("./routes/user.route")
const {githubRouter}=require("./loginRoute/github.route")

const { authmiddleware } = require("./middleware/authenticate")
const cookieParser = require("cookie-parser");
const app = express();
app.use(express.json())
app.use(cookieParser())




app.get("/weather", authmiddleware, (req, res) => {
    res.send("Welcome to weather app")
})

app.use("/", userRouter)
app.use("/",githubRouter)




app.listen(process.env.port, async () => {
    try {
        await connection
        console.log(`connected to port at ${process.env.port}`)
    } catch (error) {
        console.log(error)
    }
})
