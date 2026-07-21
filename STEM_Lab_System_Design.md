# Virtual STEM Lab — Full System Design Document
**Version 1.0 | Prepared for first-time implementation**

---

## Table of Contents
1. Project Overview
2. Zero-Cost Infrastructure Plan
3. Complete Tech Stack
4. System Architecture
5. Frontend Structure & All HTML Pages
6. Backend Structure
7. Simulation Engine Design//Moving well
8. AI Tutor Architecture// Not available at the moment
9. Database Design
10. Folder Structure
11. User Flow & UI/UX Guide
12. Implementation Roadmap (Week-by-Week)
13. Month 1 / Month 3 / Month 6 Milestones//Not yet solidified.Will be solidified after the project goes live on the internet
14. MVP Experiment: Acid-Base Titration — Full Build Plan//Not the MVP as of now and the experiment implementation is still i the works because we have not found the best way to implement this
15. What the Final Product Looks Like// A scientific Laboratory but jus virtual at the moment
16. Potential Challenges & Solutions//Might need some money to get this started honestly
17. Gamification System/ getting there to be honest
18. Startup Path/ Not yet solidified at the moment though

---

## 1. Project Overview

**What we are building?** A web application where students anywhere in the world open a browser, log into a Virtual Science Laboratory, pick the topic they want to dig deep into, read some material on that topic, get into the lab to visualise what they read and also what they might have learnt in school, interact with a realistic digital simulation, and (receive real-time guidance from an AI science teacher)-Not available at the moment, — all for free, on any phone or computer. 

**My inspiration for building this project:** Students in developing countries memorize experiments instead of performing them, because their schools lack labs, chemicals, and equipment. The platform gives every student a real lab in their pocket.

<!-- **Why this is buildable by a beginner:** Every piece of this system uses JavaScript — the language you already know. The frontend is React (organized JavaScript). The backend is Node.js + Express (you already know Node). The simulations are JavaScript objects and a drawing library. The AI is an API call. -->

---

## 2. Zero-Cost Infrastructure Plan

Every piece of this system runs on a free tier. Here is exactly where to sign up:

| Service | What it does | Free tier limit | Sign up |
|---|---|---|---|
| **Vercel** | Hosts your React frontend | Unlimited deploys, free custom domain | vercel.com |
| **Render.com** | Hosts your Node.js backend | 750 hours/month (enough for 24/7) | render.com |
| **MongoDB Atlas** | Your database | 512MB storage, free forever | mongodb.com/atlas |
| **Google Gemini API** | Powers your AI tutor | 60 requests/minute free | aistudio.google.com |
| **GitHub** | Stores your code, auto-deploys | Free for public repos | github.com |

**How deployment works at zero cost:**
- You push code to GitHub
- Vercel automatically detects and deploys your frontend
- Render.com automatically deploys your backend
- Total monthly cost: **$0**

**Important note on Render.com free tier:** The free backend "sleeps" after 15 minutes of inactivity and takes ~30 seconds to wake up on the first request. This is fine for an MVP. To fix this later for free, use a service like UptimeRobot (free) to ping your server every 10 minutes to keep it awake.

---

## 3. Complete Tech Stack

### Frontend (what the student sees)
- **React** — organizes your UI into reusable components
- **P5.js** — draws chemistry simulations on the screen (beakers, liquids, color changes)
- **Matter.js** — handles physics math (gravity, collisions, projectile motion)
- **Tailwind CSS** — styles your app quickly with utility classes
- **React Router** — handles navigation between pages

### Backend (the server)
- **Node.js** — JavaScript runtime (you know this)
- **Express** — web framework that handles incoming requests
- **Mongoose** — makes MongoDB easy to work with
- **jsonwebtoken** — handles user login sessions
- **cors** — lets your frontend talk to your backend
- **dotenv** — keeps your API keys secret

### Database
- **MongoDB Atlas** — stores users, experiments, sessions, and progress

### AI
- **Google Gemini API** (gemini-1.5-flash model — this is free) — powers the AI tutor
- **@google/generative-ai** npm package — official SDK

### Hosting
- **Vercel** — frontend
- **Render.com** — backend
- **GitHub** — version control + auto-deploy trigger

---

## 4. System Architecture

The system has five layers that talk to each other:

```
[Student's browser / phone]
         ↕ loads page
[React Frontend — Vercel]
    ├── Lab Canvas (P5.js / Matter.js simulation)
    ├── Control Panel (sliders, buttons)
    ├── AI Tutor Chat (chat window)
    └── Dashboard (progress, badges)
         ↕ HTTP REST API calls
[Node.js + Express Backend — Render.com]
    ├── /auth       — register, login
    ├── /experiments — get lab data
    ├── /agent      — send context to AI, get response
    └── /progress   — save/load student progress
         ↕                    ↕
[MongoDB Atlas]        [Google Gemini API]
  Users                  AI Tutor responses
  Experiments            (context-aware)
  Sessions
  Progress
```

**Data flow during an experiment (step by step):**
1. Student opens the app and logs in → backend verifies login → MongoDB stores session
2. Student picks "Acid-Base Titration" → frontend asks backend for experiment data → backend sends reaction database + steps to frontend
3. Student drags hydrochloric acid into beaker → frontend checks reaction database → P5.js animates color change
4. Frontend sends experiment state to backend agent route: `{ step: 3, chemicals: ["HCl", "NaOH"], lastAction: "added too much NaOH" }`
5. Backend builds a prompt and sends it to Gemini: "You are a science teacher. Student is doing titration. They just added too much NaOH. Guide them."
6. Gemini responds → backend returns response → frontend shows it in chat
7. Session data (steps completed, mistakes, AI conversation) saved to MongoDB

---

## 5. Frontend Structure & All HTML Pages

Your app has 6 main pages. Here is what each page contains and how it should look.

---

### Page 1: Landing Page (`/`)

**Purpose:** First thing any visitor sees. Explains what the platform is and invites them to sign up.

**Layout:**
```
┌─────────────────────────────────────────┐
│  LOGO          [Login]  [Sign Up]        │
├─────────────────────────────────────────┤
│                                         │
│   🔬 Virtual STEM Lab                   │
│   Real science. Zero equipment.         │
│                                         │
│   [Start Learning Free]                 │
│                                         │
├─────────────────────────────────────────┤
│  Chemistry   Physics   Biology          │
│  [icon]      [icon]    [icon]           │
│  50+ labs    Physics   Cell             │
│              sims      explorer         │
├─────────────────────────────────────────┤
│  "Used by students in 12 countries"     │
└─────────────────────────────────────────┘
```

**Key elements:**
- Hero section with a short animated preview (a beaker with a color-changing liquid)
- Three subject cards (Chemistry, Physics, Biology)
- "How it works" section with 3 steps: Pick a lab → Run the experiment → Learn with AI
- Sign up / Login buttons

---

### Page 2: Login / Register (`/login`, `/register`)

**Purpose:** Student creates account or logs in.

**Layout:**
```
┌─────────────────────────────────┐
│                                 │
│   Welcome to STEM Lab           │
│                                 │
│   [Email input]                 │
│   [Password input]              │
│   [Sign In button]              │
│                                 │
│   ─── or ───                    │
│                                 │
│   [Continue with Google]        │
│                                 │
│   Don't have an account?        │
│   [Create one]                  │
│                                 │
└─────────────────────────────────┘
```

**What happens on submit:**
- POST /api/auth/register or /api/auth/login
- Backend checks MongoDB for user / creates new user
- Backend returns a JWT token
- Frontend stores token in localStorage
- Student redirected to Dashboard

---

### Page 3: Experiment Browser (`/labs`)

**Purpose:** Student browses all available experiments.

**Layout:**
```
┌─────────────────────────────────────────┐
│  [All] [Chemistry] [Physics] [Biology]  │
│  Search: [___________________]          │
├─────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │🧪 Acid-  │ │⚡ Circuit│ │🔬 Cell   ││
│  │Base      │ │  Building│ │  Explorer││
│  │Titration │ │          │ │          ││
│  │Chemistry │ │ Physics  │ │ Biology  ││
│  │★★★☆☆    │ │ ★★★★☆   │ │ ★★☆☆☆   ││
│  │[Start]   │ │ [Start]  │ │ [Start]  ││
│  └──────────┘ └──────────┘ └──────────┘│
└─────────────────────────────────────────┘
```

**Each card shows:**
- Experiment name
- Subject (Chemistry / Physics / Biology)
- Difficulty (1–5 stars)
- Short description (1 sentence)
- "Start Lab" button
- Completion checkmark if student has done it before

---

### Page 4: The Lab Page (`/lab/:experimentId`) — THE MOST IMPORTANT PAGE

**Purpose:** Where the student actually does the experiment.

**Desktop layout (3-panel):**
```
┌──────────────────────────────┬──────────┐
│                              │ Controls │
│   LAB CANVAS                 │          │
│   (Simulation runs here)     │ [Slider] │
│   - Beakers, equipment       │ Temp: 25°│
│   - Color changes animate    │          │
│   - Draggable chemicals      │ [Slider] │
│   - pH meter updates live    │ pH: 7.0  │
│                              │          │
│                              │ [Reset]  │
│                              │ [Run]    │
├──────────────────────────────┴──────────┤
│  🤖 AI Tutor                            │
│  "Try adding a small amount of NaOH    │
│  first — what color does the indicator │
│  turn? That's your first clue about    │
│  the current pH..."                    │
│                                         │
│  [Type your question...]    [Send]      │
└─────────────────────────────────────────┘
```

**Mobile layout (stacked):**
- Canvas takes full width, 55% of height
- AI Tutor chat below, 35% of height
- Controls hidden behind a "⚙️" button that opens a bottom sheet

**What the canvas shows for the titration experiment:**
- A burette (glass tube with a stopcock) at the top
- A conical flask / Erlenmeyer flask below it
- A pH meter probe in the flask
- Liquid in the flask that changes color gradually as pH changes
- A pH scale on the side showing the live reading
- Bubbles animating when gas is produced

---

### Page 5: Student Dashboard (`/dashboard`)

**Purpose:** Student sees their progress, badges, and history.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Hello, Amara 👋                        │
│  Rank: Lab Technician  ⭐ 340 XP        │
├─────────────────────────────────────────┤
│  Continue where you left off:           │
│  ┌──────────────────────────────────┐   │
│  │ Acid-Base Titration — Step 4/6   │   │
│  │ [Resume Lab]                     │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  Your badges:                           │
│  🏅 First Experiment  🏅 No Mistakes    │
│  🏅 Fast Learner                        │
├─────────────────────────────────────────┤
│  Recent experiments:                    │
│  ✅ Acid-Base Titration   Score: 94%    │
│  ✅ Pendulum Physics      Score: 87%    │
│  🔄 Circuit Building      In progress   │
└─────────────────────────────────────────┘
```

---

### Page 6: Experiment Results (`/results/:sessionId`)

**Purpose:** After finishing an experiment, student sees what they did well and what to improve.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Experiment Complete! 🎉                 │
│  Acid-Base Titration  Score: 91/100     │
├─────────────────────────────────────────┤
│  What went well:                        │
│  ✅ Correct endpoint identified         │
│  ✅ Used indicator correctly            │
│                                         │
│  What to work on:                       │
│  ⚠️ Added NaOH too quickly (3 times)   │
│     Tip: Add drop-by-drop near the     │
│     endpoint for accuracy              │
├─────────────────────────────────────────┤
│  +50 XP earned  🏅 New badge unlocked  │
│                                         │
│  [Try Again]  [Next Experiment]         │
└─────────────────────────────────────────┘
```

---

## 6. Backend Structure

Your Express server has four route groups:

### Auth routes (`/api/auth`)
```
POST /api/auth/register   → creates new user in MongoDB
POST /api/auth/login      → checks password, returns JWT token
GET  /api/auth/me         → returns current user from token
```

### Experiments routes (`/api/experiments`)
```
GET /api/experiments           → returns list of all experiments
GET /api/experiments/:id       → returns full experiment data
                                 (chemicals, steps, reaction database)
```

### Agent routes (`/api/agent`)
```
POST /api/agent/ask    → receives experiment context + student question
                         sends to Gemini with system prompt
                         returns AI response text
```

What you send to this route:
```json
{
  "experimentId": "acid-base-titration",
  "studentLevel": "beginner",
  "currentStep": 3,
  "chemicals": ["HCl 0.1M", "NaOH 0.05M"],
  "temperature": 22,
  "lastAction": "added too much NaOH",
  "reactionResult": "overshoot - pH went above 7",
  "question": "Why did the color change so suddenly?"
}
```

### Progress routes (`/api/progress`)
```
POST /api/progress/session     → saves completed experiment session
GET  /api/progress/:userId     → returns student's full history
GET  /api/progress/badges/:id  → returns earned badges
```

---

## 7. Simulation Engine Design

The simulation engine is the most unique part of the project. It is not a video — it is a **rule-based system** that calculates what happens and then shows it visually.

### Chemistry simulation approach

**Step 1: The reaction database**
You store all possible chemical reactions as JavaScript objects:

```javascript
// src/simulations/chemistry/reactions.js
export const reactions = {
  "HCl + NaOH": {
    products: ["NaCl", "H2O"],
    colorChange: { indicator: "phenolphthalein", fromColor: "#FF69B4", toColor: "clear" },
    temperatureChange: +5,
    gasProduced: false,
    precipitate: false,
    pHChange: "increases toward 7",
    description: "Acid-base neutralization"
  },
  "HCl + Na2CO3": {
    products: ["NaCl", "H2O", "CO2"],
    colorChange: null,
    temperatureChange: +2,
    gasProduced: true,
    gasName: "CO2",
    description: "Acid-carbonate reaction — bubbles form"
  },
  "AgNO3 + NaCl": {
    products: ["AgCl", "NaNO3"],
    colorChange: null,
    temperatureChange: 0,
    gasProduced: false,
    precipitate: true,
    precipitateColor: "#FFFFFF",
    description: "White precipitate forms (silver chloride)"
  }
}
```

**Step 2: The experiment state**
Your simulation always has a "current state" object:

```javascript
const experimentState = {
  beakerContents: [],
  currentVolume: 0,
  currentPH: 7.0,
  currentTemperature: 25,
  colorOfLiquid: "clear",
  gasPresent: false,
  precipitatePresent: false,
  step: 1
}
```

**Step 3: The reaction checker**
When a student adds a chemical, you run a function:

```javascript
function checkReaction(chemical1, chemical2) {
  const key = `${chemical1} + ${chemical2}`;
  const reverseKey = `${chemical2} + ${chemical1}`;
  return reactions[key] || reactions[reverseKey] || null;
}
```

**Step 4: The visual renderer**
P5.js reads the experiment state and draws it every frame:
- If `colorOfLiquid` changed → animate liquid color transition over 1.5 seconds
- If `gasPresent === true` → animate rising bubble particles
- If `precipitatePresent === true` → draw settling white particles
- If `temperature` changed → update the thermometer reading with animation

### Physics simulation approach

Matter.js handles all the physics math automatically. You just:
1. Create "bodies" (a ball, a pendulum bob, a ramp)
2. Set their properties (mass, friction, bounciness)
3. Tell Matter.js about gravity
4. Render the result with P5.js

```javascript
// Example: Pendulum setup
import Matter from 'matter-js';

const { Engine, Bodies, Constraint, World } = Matter;

const engine = Engine.create();
const bob = Bodies.circle(300, 300, 20, { mass: 1 });
const pivot = { x: 300, y: 100 };
const pendulum = Constraint.create({
  pointA: pivot,
  bodyB: bob,
  length: 200
});

World.add(engine.world, [bob, pendulum]);
// Matter.js now calculates all physics automatically
```

### Making simulations feel realistic

**Consequence system** — these are the most important details:
- Student adds too much acid → liquid boils over → screen shakes, error message, must restart
- Student heats too fast → substance decomposes instead of melting → different (wrong) product forms
- Student connects circuit wire wrong → bulb doesn't light → AI tutor asks "what do you think is wrong?"
- Student gets titration endpoint exactly right → small celebration animation

**Sound effects** — add these audio files (all free to download from freesound.org):
- Bubbling liquid (gas production)
- Liquid pouring sound (adding chemicals)
- Glass clinking (mixing)
- Beep (measurement taken)
- Sizzle (exothermic reaction)

**Gradual visual changes** — never instant:
- Color changes: animate over 1.5–2 seconds using P5.js `lerpColor()`
- Temperature: tick up 1 degree at a time
- pH meter: update every 100ms, showing the number changing live

---

## 8. AI Tutor Architecture

### How it works

Every time a student does something in the lab, your frontend sends a small "context packet" to your backend, which combines it with a system prompt and sends it to Gemini.

### The system prompt (this is the most important thing you write)

```javascript
// server/agent/tutor.js

const buildSystemPrompt = (experiment, studentLevel) => `
You are a friendly, encouraging science teacher named Dr. Kwame.
You are helping a ${studentLevel} student complete the following experiment:
${experiment.title}: ${experiment.description}

The expected learning outcomes are:
${experiment.learningObjectives.join('\n')}

The correct reaction/outcome data is:
${JSON.stringify(experiment.reactions)}

Your teaching style:
- NEVER give the student the answer directly
- Ask guiding questions to help them think
- If they make a mistake, explain WHY it is wrong scientifically
- Keep explanations simple — use analogies the student will understand
- Be encouraging. Mistakes are part of learning
- Limit your response to 3 sentences unless the student asks for more detail
- If the student is on the right track, affirm them and push them further

Current experiment state will be provided with each message.
`;
```

### The agent route (server/routes/agent.js)

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/ask', async (req, res) => {
  const { experimentContext, question, experiment, studentLevel } = req.body;

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemPrompt = buildSystemPrompt(experiment, studentLevel);

  const userMessage = `
Current experiment state:
${JSON.stringify(experimentContext)}

Student's question or action: ${question}
`;

  const result = await model.generateContent(systemPrompt + '\n\n' + userMessage);
  const response = result.response.text();

  res.json({ reply: response });
});
```

### When the AI speaks automatically (proactive tutoring)

Your frontend triggers an AI message automatically when:
- The student opens a new experiment (welcome + intro)
- The student makes the same mistake twice
- The student has been idle for 60 seconds on a step
- The student completes a step successfully (positive reinforcement)
- A reaction produces an unexpected result (teachable moment)

---

## 9. Database Design

### MongoDB Collections

**Users collection:**
```json
{
  "_id": "ObjectId",
  "name": "Amara Osei",
  "email": "amara@example.com",
  "passwordHash": "bcrypt hash",
  "grade": "Grade 10",
  "country": "Ghana",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Experiments collection:**
```json
{
  "_id": "acid-base-titration",
  "title": "Acid-Base Titration",
  "subject": "chemistry",
  "difficulty": 3,
  "description": "Determine the concentration of an unknown acid using a known base",
  "estimatedTime": 20,
  "availableChemicals": ["HCl", "NaOH", "Phenolphthalein", "Distilled water"],
  "availableVariables": ["concentration", "volume", "temperature"],
  "reactions": { "...reaction database here..." },
  "steps": [
    { "stepNumber": 1, "instruction": "Fill the burette with 0.1M NaOH solution", "hint": "..." },
    { "stepNumber": 2, "instruction": "Add 3 drops of phenolphthalein to the conical flask", "hint": "..." }
  ],
  "learningObjectives": ["Understand neutralization", "Identify equivalence point"],
  "successCriteria": { "finalPH": { "min": 6.8, "max": 7.2 } }
}
```

**Sessions collection:**
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "experimentId": "acid-base-titration",
  "startedAt": "2024-01-15T14:00:00Z",
  "completedAt": "2024-01-15T14:22:00Z",
  "stepsCompleted": 6,
  "totalSteps": 6,
  "mistakes": [
    { "step": 3, "action": "added too much NaOH", "timestamp": "..." }
  ],
  "score": 91,
  "xpEarned": 50,
  "aiConversation": [
    { "role": "tutor", "message": "...", "timestamp": "..." },
    { "role": "student", "message": "...", "timestamp": "..." }
  ]
}
```

**Progress collection:**
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "totalXP": 340,
  "rank": "Lab Technician",
  "experimentsCompleted": 4,
  "badges": ["first-experiment", "no-mistakes", "fast-learner"],
  "lastActive": "2024-01-15T14:22:00Z"
}
```

---

## 10. Folder Structure

```
stem-lab/
│
├── client/                          ← React frontend (deploy to Vercel)
│   ├── public/
│   │   ├── index.html
│   │   └── sounds/                  ← bubbling.mp3, pour.mp3, etc.
│   ├── src/
│   │   ├── components/
│   │   │   ├── LabCanvas.jsx        ← main simulation viewport
│   │   │   ├── ControlPanel.jsx     ← sliders and experiment controls
│   │   │   ├── AITutor.jsx          ← chat window component
│   │   │   ├── ExperimentCard.jsx   ← card on the browse page
│   │   │   ├── ProgressBadge.jsx    ← badge display component
│   │   │   └── Navbar.jsx           ← top navigation bar
│   │   ├── pages/
│   │   │   ├── Landing.jsx          ← homepage
│   │   │   ├── Login.jsx            ← login page
│   │   │   ├── Register.jsx         ← register page
│   │   │   ├── LabBrowser.jsx       ← browse all experiments
│   │   │   ├── Lab.jsx              ← main lab page (3-panel layout)
│   │   │   ├── Dashboard.jsx        ← student progress dashboard
│   │   │   └── Results.jsx          ← post-experiment results
│   │   ├── simulations/
│   │   │   ├── chemistry/
│   │   │   │   ├── reactions.js     ← reaction database (JS objects)
│   │   │   │   ├── ChemCanvas.jsx   ← P5.js chemistry renderer
│   │   │   │   └── state.js         ← experiment state management
│   │   │   └── physics/
│   │   │       ├── PhysicsCanvas.jsx ← Matter.js renderer
│   │   │       └── experiments/
│   │   │           └── pendulum.js  ← pendulum setup config
│   │   ├── hooks/
│   │   │   ├── useExperiment.js     ← custom hook: loads experiment data
│   │   │   ├── useAITutor.js        ← custom hook: manages AI messages
│   │   │   └── useAuth.js           ← custom hook: login state
│   │   ├── api/
│   │   │   └── index.js             ← all API call functions (axios)
│   │   ├── App.jsx                  ← root component + routes
│   │   └── index.js                 ← React entry point
│   ├── package.json
│   └── .env                         ← REACT_APP_API_URL=your-backend-url
│
├── server/                          ← Node.js backend (deploy to Render.com)
│   ├── routes/
│   │   ├── auth.js                  ← register, login, me
│   │   ├── experiments.js           ← get all, get by id
│   │   ├── agent.js                 ← AI tutor endpoint
│   │   └── progress.js             ← save sessions, get progress
│   ├── models/
│   │   ├── User.js                  ← Mongoose schema
│   │   ├── Experiment.js            ← Mongoose schema
│   │   ├── Session.js               ← Mongoose schema
│   │   └── Progress.js             ← Mongoose schema
│   ├── data/
│   │   └── experiments.json         ← seed data for all experiments
│   ├── agent/
│   │   └── tutor.js                 ← Gemini integration + prompt builder
│   ├── middleware/
│   │   └── auth.js                  ← JWT verification middleware
│   ├── index.js                     ← Express server + MongoDB connection
│   ├── package.json
│   └── .env                         ← MONGODB_URI, GEMINI_API_KEY, JWT_SECRET
│
├── .gitignore                       ← ignore node_modules, .env files
└── README.md
```

---

## 11. User Flow & UI/UX Guide

### Complete user journey (first visit to first completed experiment)

```
1. Student lands on homepage
   → Reads what the platform does
   → Clicks "Start Learning Free"

2. Registration page
   → Enters name, email, password, grade, country
   → Account created → redirected to dashboard

3. Dashboard (empty first time)
   → Sees welcome message
   → AI tutor says: "Welcome! Ready to start your first experiment? I recommend the Acid-Base Titration."
   → Clicks "Browse Labs"

4. Lab Browser page
   → Sees grid of experiment cards
   → Filters by "Chemistry"
   → Clicks "Acid-Base Titration"

5. Lab page loads
   → Canvas shows: burette, flask, pH meter, chemicals panel
   → AI tutor sends first message: "Welcome to your first titration! 
      Your goal is to find the exact point where the acid and base 
      neutralize each other. Start by adding 25mL of HCl to the flask."

6. Student follows steps
   → Drags HCl into flask → liquid appears, pH meter reads 2.5
   → Adds phenolphthalein → no color change (acid is clear with this indicator)
   → Starts adding NaOH from burette
   → At equivalence point: color flashes pink
   → AI: "Excellent! Did you see how quickly it turned pink? 
      That's the equivalence point. What does that tell you about the pH right now?"

7. Student types question
   → "Why did it change color so suddenly?"
   → AI explains the chemistry in simple terms

8. Experiment complete
   → Results page shows score, mistakes, XP earned
   → Badge awarded: "First Experiment Complete"
   → Student redirected to dashboard with updated progress
```

### Mobile-specific design rules

- All tap targets must be at least 44×44px (Apple guideline)
- Chemical "drag to mix" becomes "tap to select, then tap beaker to pour"
- Font size minimum 16px for body text (prevents iOS auto-zoom)
- AI chat uses bottom sheet on mobile (slides up from bottom)
- Canvas is touch-friendly: pinch to zoom, one-finger drag to interact

---

## 12. Implementation Roadmap — Week by Week

### Month 1: Foundation (Weeks 1–4)

**Week 1: Project Setup & "Hello World"**
- [ ] Create GitHub repository
- [ ] Set up folder structure exactly as shown above
- [ ] Create React app with `npx create-react-app client`
- [ ] Create Node.js server with Express
- [ ] Connect to MongoDB Atlas (get a free cluster)
- [ ] Get a "Hello World" message to appear in the browser from your server
- [ ] Deploy empty frontend to Vercel, empty backend to Render.com
- **Success check:** You can open your Vercel URL and see "Connected to backend"

**Week 2: Authentication System**
- [ ] Build User model in MongoDB
- [ ] Build `/auth/register` and `/auth/login` routes
- [ ] Build Login.jsx and Register.jsx pages
- [ ] Add JWT token storage in frontend
- [ ] Add protected routes (redirect to login if not logged in)
- **Success check:** You can create an account and log in

**Week 3: First Simulation — Static Version**
- [ ] Build the 3-panel Lab.jsx layout (Canvas + Controls + Chat)
- [ ] Install P5.js and draw a beaker on the canvas
- [ ] Create the reactions.js database with 5 reactions
- [ ] Make chemicals appear in the control panel
- [ ] When student clicks "Mix", look up reaction and log result to console
- **Success check:** Canvas shows a beaker; clicking Mix logs the correct reaction

**Week 4: First Simulation — Animated Version**
- [ ] Add liquid to the beaker that changes color when chemicals are mixed
- [ ] Add a pH meter that updates live
- [ ] Add bubble animation for gas-producing reactions
- [ ] Add failure state (liquid boiling over)
- [ ] Add sound effects
- **Success check:** The acid-base titration looks and behaves realistically

### Month 2: AI Integration & Polish (Weeks 5–8)

**Week 5: AI Tutor Integration**
- [ ] Get Gemini API key from Google AI Studio (free)
- [ ] Build `/agent/ask` route with Gemini integration
- [ ] Build the AITutor.jsx chat component
- [ ] Connect frontend: when student mixes chemicals, send context to AI
- [ ] AI sends opening message when lab page loads
- **Success check:** Student can ask a question and get a science answer

**Week 6: Progress Tracking**
- [ ] Build Session model and `/progress/session` route
- [ ] Save session data after each experiment
- [ ] Build Dashboard.jsx with progress display
- [ ] Add XP system (50 XP per completed experiment)
- [ ] Build Results.jsx page
- **Success check:** Finishing an experiment shows a score and earns XP

**Week 7: Second Experiment (Physics)**
- [ ] Install Matter.js
- [ ] Build PhysicsCanvas.jsx
- [ ] Implement pendulum experiment
- [ ] Add variable controls (string length, gravity, initial angle)
- [ ] Connect to AI tutor context
- **Success check:** Pendulum swings correctly; changing length affects period

**Week 8: Badges, Polish & Mobile**
- [ ] Implement badge system (5 badges minimum)
- [ ] Mobile-responsive layout testing on real phones
- [ ] Loading states and error handling
- [ ] Landing page design
- **Success check:** App works well on an Android phone

### Month 3: Growth & Content (Weeks 9–12)

**Week 9: Third experiment** — Circuit Building (Physics/Electronics)
**Week 10: Fourth experiment** — Cell Explorer (Biology, no physics engine needed — just interactive diagram)
**Week 11: Lab browser** — full browsing page with filters and search
**Week 12: Performance, SEO, and sharing** — share results link, invite a friend

---

## 13. Month 1 / Month 3 / Month 6 Milestones

### End of Month 1: Working MVP
- 1 working experiment (acid-base titration)
- Login / register
- Basic AI tutor
- XP system
- Deployed and publicly accessible at a URL

### End of Month 3: Real Product
- 4 experiments (2 chemistry, 1 physics, 1 biology)
- Full progress tracking with badges
- Mobile-responsive design
- 50+ students using it from real outreach

### End of Month 6: Early Startup
- 10+ experiments across all three subjects
- Teacher accounts (teachers can assign experiments to classes)
- Class progress dashboard for teachers
- 500+ registered students
- First partnerships with schools

---

## 14. MVP Experiment: Acid-Base Titration — Full Build Plan

This is the single experiment you build in Month 1. Here is exactly what it includes.

### What the student does:
1. Reads the experiment introduction (AI delivers this)
2. Adds HCl to the conical flask (from a list, drag or click)
3. Adds phenolphthalein indicator (3 drops)
4. Fills the burette with NaOH solution
5. Opens the stopcock to slowly add NaOH to the flask
6. Watches pH meter and color indicator
7. Stops when the indicator turns pink (equivalence point)
8. Records their result

### Visual elements to build:
- Burette: tall vertical rectangle with a stopcock (tap to open/close or slider)
- Conical flask: triangle shape with rounded bottom
- pH meter: digital display that updates live
- Color indicator: the liquid in the flask changes from clear → pink at equivalence point
- Bubbles: if wrong chemicals mixed, bubbles animate
- Volume tracker: shows how much NaOH has been added

### Success criteria:
- Student reaches pH 7.0 ± 0.2
- Score calculation: 100 - (number_of_mistakes × 10) - (volume_overshot × 2)

### AI tutor messages for this experiment:
1. Opening: "Today we're doing an acid-base titration. Your goal is to find the exact neutralization point. Start by adding 25mL of HCl to the flask."
2. After HCl added: "Good. Now add 3 drops of phenolphthalein — this is your indicator. It changes color to tell you when the pH changes."
3. After indicator added: "Perfect. Now comes the careful part. Add NaOH very slowly — one drop at a time near the end. Why do you think we need to be careful here?"
4. If student adds too much at once: "Oops! You added too much NaOH at once. See how the pH jumped past 7? In a real lab, you'd have to restart. Try again — this time, slow down near pH 6."
5. On success: "Beautiful! You found the equivalence point. At exactly pH 7, the acid and base have completely neutralized each other. This is called the equivalence point. Well done!"

---

## 15. What the Final Product Looks Like

### Version 1 (Month 1) demo flow:
1. Student opens URL on phone
2. Sees a clean landing page with a beaker icon and "Virtual STEM Lab"
3. Signs up in 30 seconds
4. Clicks "Acid-Base Titration"
5. Lab opens: canvas shows beaker + burette, AI says hello
6. Student drags HCl in, adds indicator, slowly adds NaOH
7. At the equivalence point, liquid turns pink, confetti animation plays
8. Results page shows score 94/100, "You earned 50 XP!"
9. Dashboard shows first badge: "First Experiment"

### Look and feel:
- Clean, modern design — white background, teal/green accent colors (scientific feel)
- Professional but approachable — not childish, not intimidating
- Dark mode for low-light study environments
- Canvas is the centerpiece — takes 60%+ of screen space
- AI chat uses a friendly avatar (a test tube icon, not a robot)

---

## 16. Potential Challenges & Solutions

| Challenge | Why it happens | Solution |
|---|---|---|
| Simulation looks fake | Instant changes, no consequences | Add gradual transitions, add failure states, add sound |
| AI gives wrong science answers | Gemini without constraints | Write a detailed system prompt that constrains the subject matter; feed it the reaction database |
| Backend sleeps on Render.com free tier | Free tier limitation | Use UptimeRobot (free) to ping server every 10 minutes |
| Canvas is hard to code | Low-level API | Use P5.js — it's designed for beginners. `p.ellipse()` is much easier than raw canvas |
| Mobile touch doesn't work | Canvas uses mouse events | Add P5.js touch handlers alongside mouse handlers |
| Getting overwhelmed | Too many things at once | Follow the week-by-week plan strictly. Only open files for your current week |
| Gemini API rate limit | Free tier is 60 req/min | Only call the AI when student submits a message or after key actions — not on every keypress |
| Students in rural areas have slow internet | Large JS bundles | Use code splitting in React (lazy loading), keep images small, use audio files under 50KB |

---

## 17. Gamification System

### XP (Experience Points) system
- Complete an experiment: +50 XP
- Complete with no mistakes: +25 XP bonus
- Answer AI's question correctly: +10 XP
- Deliberately try a wrong reaction (curiosity): +5 XP
- Help a classmate (future feature): +15 XP

### Rank progression
| XP Range | Rank |
|---|---|
| 0–99 | Curious Student |
| 100–299 | Lab Technician |
| 300–599 | Junior Scientist |
| 600–999 | Chemist / Physicist |
| 1000+ | Professor |

### Badges (first 10)
1. 🏅 First Experiment — Complete your first lab
2. ⭐ Perfect Score — Score 100/100
3. 🔬 No Mistakes — Complete a lab with zero errors
4. ⚡ Speed Scientist — Complete a lab in under 10 minutes
5. 🧪 Curious Mind — Deliberately trigger 5 different failure states
6. 🌍 Explorer — Complete an experiment in each subject
7. 💬 Great Questions — Ask the AI tutor 20 questions total
8. 📈 Streak — Do experiments 5 days in a row
9. 🎯 Precision — Get within 0.1 pH of the correct endpoint
10. 🏆 Lab Champion — Earn 1000 XP

### The Mistake Log (turns errors into learning)
After each experiment, students see a personalized "What I learned from my mistakes" section:
- "You added NaOH too quickly 3 times — tip: slow down when pH is between 5–9"
- "You forgot the indicator twice — tip: set up indicator before starting the titration"

The AI tutor references the mistake log in future sessions.

---

## 18. Startup Path

### Phase 1: Build & Validate (Months 1–3)
- Build MVP and deploy it free
- Share with 5 students you know personally
- Ask them to use it and tell you honestly what is confusing
- Fix everything they report

### Phase 2: First Real Users (Months 3–6)
- Email 10 science teachers in your country directly
- Offer the platform completely free for their class
- Collect email testimonials and usage statistics
- Ask teachers to share on WhatsApp teacher groups

### Phase 3: Funding Applications (Month 6+)
Apply to these programs (all free to apply, no equity required):
- **Google for Startups Africa** — free cloud credits + mentorship
- **ALX Ventures** — African tech startup support
- **Mastercard Foundation** — education grants for Africa
- **UNESCO Innovation Fund** — education technology grants

### Business model (when ready)
- Individual students: **free forever** (this is your growth engine)
- Schools and institutions: **$29/month** per school (unlimited students)
- Government partnerships: **custom pricing** (ministry of education contracts)

The fact that the individual experience is free is your biggest advantage over Western edtech companies. You gain users who then convince their schools to pay.

---

*This document covers everything you need to start building. Begin with Week 1 — set up the folder structure, connect to MongoDB, and get a Hello World running. Everything else follows from that first working connection.*

*Last updated: 2024 | Target audience: Beginner JavaScript developers building for the first time*
