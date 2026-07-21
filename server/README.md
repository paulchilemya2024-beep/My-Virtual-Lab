# Virtual STEM Lab — Backend API

Node.js + Express + MongoDB backend for the Virtual STEM Lab, built to the
[System Design document](../STEM_Lab_System_Design.md). It provides
authentication, experiment data, and progress/gamification tracking.

## Tech stack

| Piece | Library |
|---|---|
| Web framework | Express |
| Database | MongoDB Atlas via Mongoose |
| Auth | jsonwebtoken + bcryptjs |
| Security | helmet, express-rate-limit |
| Config / CORS | dotenv, cors |

## Folder structure

```
server/
├── src/
│   ├── index.js            # entry point — connects DB, starts server
│   ├── app.js              # builds the Express app + mounts routes
│   ├── seed.js             # loads data/experiments.json into MongoDB
│   ├── config/             # env.js (config), db.js (Mongo connection)
│   ├── models/             # User, Experiment, Session, Progress (Mongoose)
│   ├── middleware/         # auth (JWT), error handling, async wrapper
│   ├── routes/             # auth, experiments, progress
│   ├── utils/              # token.js (JWT), gamification.js (XP/ranks/badges)
│   └── data/experiments.json   # seed data (titration, circuit, osmosis)
├── .env.example
└── package.json
```

## Setup

```bash
cd server
npm install
cp .env.example .env      # then edit .env with your values (Windows: copy .env.example .env)
```

Fill in `.env`:
- **MONGODB_URI** — free cluster from [MongoDB Atlas](https://mongodb.com/atlas), or a local MongoDB.
- **JWT_SECRET** — any long random string. Generate one:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Seed the experiments, then run:

```bash
npm run seed      # loads the 3 experiments into MongoDB
npm run dev       # starts on http://localhost:5000 with auto-reload
```

## API reference

All responses are JSON. Protected routes need an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/register` | `{ name, email, password, grade?, country? }` | `{ token, user }` |
| POST | `/login` | `{ email, password }` | `{ token, user }` |
| GET | `/me` 🔒 | — | `{ user }` |

### Experiments — `/api/experiments`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | List all. Supports `?subject=chemistry` and `?search=titration`. |
| GET | `/:id` | Full experiment (steps, reactions, success criteria). |

### Progress — `/api/progress`
| Method | Path | Notes |
|---|---|---|
| POST | `/session` 🔒 | Save a session. Computes score, XP, rank, and new badges. |
| GET | `/me` 🔒 | Rolled-up progress + 10 recent sessions. |
| GET | `/badges/me` 🔒 | All badges with `earned: true/false`. |
| GET | `/:userId` 🔒 | A user's full session history. |

### Misc
- `GET /api/health` — health check (point UptimeRobot here to keep Render awake).
- `GET /api/badges` — badge catalogue (no auth).

## Gamification rules (Sections 14 & 17 of the design doc)

- **Score** = `100 − (mistakes × 10) − (volumeOvershot × 2)`, clamped 0–100.
- **XP** = 50 for completing + 25 if no mistakes + 10 for a perfect score.
- **Ranks**: Curious Student → Lab Technician (100) → Junior Scientist (300) →
  Chemist / Physicist (600) → Professor (1000+).
- **Badges**: First Experiment, Perfect Score, No Mistakes, Speed Scientist,
  Explorer, Great Questions, Precision, Lab Champion.

## Deploying to Render.com (free)

1. Push this repo to GitHub.
2. On Render, create a **Web Service** from the repo, root directory `server`.
3. Build command `npm install`, start command `npm start`.
4. Add the environment variables from your `.env`.
5. The free tier sleeps after 15 min — use [UptimeRobot](https://uptimerobot.com)
   to ping `/api/health` every 10 minutes.

## Connecting the React frontend

In `my-react-app`, point requests at this server (e.g. `VITE_API_URL=http://localhost:5000`),
store the returned `token` in `localStorage`, and send it as
`Authorization: Bearer <token>` on protected calls. The experiment IDs
(`titration`, `circuit`, `osmosis`) already match the frontend's `/labs/:labId` routes.
```
