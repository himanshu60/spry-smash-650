# HangOut

Hangout is an online communication channel that allows you to conduct real-time conversations. It involves the transmission of live text messages from the sender to the recipient.

A premium, modern chat experience with real-time messaging, dark & light themes, smooth animations, and a polished responsive UI.

## Getting Started (Local)

The Express backend serves both the API **and** the static frontend, so you only run one process.

```bash
cd Backend
cp .env.example .env      # then fill in mongoUrl and key
npm install
npm run live              # or: npm start
```

Open **http://localhost:8080/index.html**

Environment variables (see `Backend/.env.example`):

| Var         | Required | Notes                                                        |
|-------------|----------|--------------------------------------------------------------|
| `mongoUrl`  | ✅       | MongoDB connection string                                    |
| `key`       | ✅       | Secret used to sign JWT tokens                               |
| `port`      | ➖       | Defaults to `8080` (platforms set this automatically)        |
| `REDIS_URL` | ➖       | Optional. If omitted, an in-memory token store is used       |

> **Redis is optional.** The original hardcoded Redis instance is dead, so the
> app falls back to an in-memory token store (fine for a single instance).
> Provide `REDIS_URL` to use real Redis.

## Deployment (Render)

Socket.io needs a long-running server, so a persistent host (Render/Railway) is
the right fit — not serverless (Vercel/Netlify).

1. Push this repo to GitHub.
2. On [Render](https://render.com): **New → Blueprint**, select this repo — it
   reads `render.yaml` automatically. (Or **New → Web Service** with root
   directory `Backend`, build `npm install`, start `npm start`.)
3. Add the environment variables `mongoUrl` and `key` in the dashboard.
4. Deploy. The frontend is served from the same URL.

> ⚠️ **Security:** the credentials that were previously committed in
> `Backend/.env` should be rotated. `.env` is now git-ignored.

---



# Tech Stack

• Frontend: HTML | CSS | JavaScript |

• Backend: Node.js | Express.js | MongoDB |Socket.io |passport |

→ Node Modules: mongoose.js | bcrypt | cors | dotenv | jsonwebtoken | nodemon

# Site Map for Project

![hnagout-site-map](https://user-images.githubusercontent.com/65457075/229422084-c4d902a9-facd-41ff-820f-51c673d5bf29.PNG)


# API end points
```POST /users/register - to register
POST /user/login - to login
POST /user/signup - to login
GET /google/auth/google - to Google-login
GET /facebook/auth/facebook - to Facebook-login
GET /auth/github - to Github-login
GET/frontend/index.html
GET/frontend/profile.html
GET/frontend/admin.html
GET/frontend/totalCustomer.html
GET/frontend/userinfo.html
```

# Home-Page
![hangout-Home-page](https://user-images.githubusercontent.com/65457075/229265649-7e2493ab-918b-4fc9-a576-dcfc2213b3a0.PNG)


# Signup-Page
![hangout-signup-page](https://user-images.githubusercontent.com/65457075/229265665-d022e355-721b-414d-b830-a9a065689a6c.PNG)


# Login-Page
![hangout-login-page](https://user-images.githubusercontent.com/65457075/229265704-7604c883-e6b6-46ec-8cc8-a6143a77ed9e.PNG)

# Messages-Page

## User 1
![user1](https://github.com/himanshu60/spry-smash-650/assets/65457075/a07a48cc-d7de-4eea-9047-b386b24ff9d2)


## User 2

![user2](https://github.com/himanshu60/spry-smash-650/assets/65457075/1d0e82d2-500e-4930-ae61-cdfde101c477)



# Admin-Login-page
# AdminDetails:
username:himanshu@gmail.com <br>
password:admin4321
![hangout-admin-login](https://user-images.githubusercontent.com/65457075/229414100-76a409de-aae3-4d74-9f67-d072ec1a378b.PNG)

# User-Details
![user-details](https://user-images.githubusercontent.com/65457075/229416044-ee564bd9-35cf-4651-a9fe-496d91c80f74.PNG)

# Manage-User

![Mange-user](https://user-images.githubusercontent.com/65457075/229416102-a458f088-2320-49f0-9acb-6f712ef7b6a9.PNG)


# Admin-dashboard
![hangout-admin-dashboard](https://user-images.githubusercontent.com/65457075/229414186-5f39ae5b-4576-4322-927c-51085cb48993.PNG)

# FeedBack
If You want to give any feedback connect with me on- yogeshnda2018@gmail.com,
