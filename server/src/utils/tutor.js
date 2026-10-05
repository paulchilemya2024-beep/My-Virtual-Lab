// The AI tutor — a thin wrapper around Gemini's REST API plus the system
// prompt that keeps it on-topic, honest about what it does and doesn't know,
// and short enough to be read aloud without losing the student's attention.
//
// Called over plain fetch rather than Google's SDK: the server only has nine
// production dependencies today, and the entire wire format is one POST with
// a JSON body — adding a whole SDK for that felt like the wrong trade.
const config = require('../config/env');

const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// The tutor never invents the lesson — it is handed the experiment's own
// title, description and learning objectives (the exact same fields
// Experiment.js and experimentContent.js already define) and told to teach
// from those, the same way the system design document always intended: feed
// the reaction/lesson data in, keep the model from freelancing.
function buildSystemPrompt(experiment) {
  const objectives = (experiment.learningObjectives || []).map((o) => `- ${o}`).join('\n');
  return `You are a patient, encouraging STEM tutor helping a student who is actively working through an interactive lab called "${experiment.title}" (${experiment.subject}).

Lab description: ${experiment.description || 'No description provided.'}

What this lab is teaching:
${objectives || '- (no specific objectives listed)'}

How to respond:
- The student is doing hands-on work in a live simulation right now — respond to what they specifically just did, not with a generic lecture.
- Never just give the final answer. Ask a guiding question, or explain WHY something happened, so the student reasons it out themselves.
- Keep it short: 2 to 4 sentences. Your reply is read aloud, so long answers lose the student's attention.
- Be warm and encouraging. A wrong attempt is data, not a failure.
- Stay on this lab's topic. If asked something unrelated, gently steer back to the experiment.
- Never use markdown formatting — this is spoken text, not a document.`;
}

// Turns a trigger + optional free-text question into the single user-turn
// message sent alongside the running conversation. `context` is a small,
// trigger-specific object the frontend already has on hand (a goal's label,
// a mistake's description, the student's own typed words) — never raw
// simulation internals, so the prompt stays small and cheap.
function describeTrigger(trigger, context) {
  switch (trigger) {
    case 'goal':
      return `The student just completed this goal in the lab: "${context.label}". Give a short, encouraging note about why that step matters — don't just say "well done."`;
    case 'mistake':
      return `The student just made this mistake in the lab: "${context.label}". Explain, briefly, why that happens — without just stating the fix outright.`;
    case 'idle':
      return `The student has been stuck on this step for a while without finishing it: "${context.label}". Offer one gentle, specific hint — not the answer.`;
    case 'question':
      return context.question;
    default:
      return context?.question || 'The student would like a hint about what to try next.';
  }
}

// In-memory daily request counter — resets automatically at UTC midnight.
// This is a single-process safety net, not a distributed rate limiter; good
// enough for one small deployment, and the whole point is just to stop a
// traffic spike from silently burning through the day's free quota.
let budget = { date: null, count: 0 };
function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}
function checkAndSpendBudget() {
  const today = currentUtcDate();
  if (budget.date !== today) budget = { date: today, count: 0 };
  if (budget.count >= config.tutorDailyBudget) return false;
  budget.count += 1;
  return true;
}
function budgetStatus() {
  const today = currentUtcDate();
  if (budget.date !== today) return { date: today, count: 0, limit: config.tutorDailyBudget };
  return { date: budget.date, count: budget.count, limit: config.tutorDailyBudget };
}

// `history` is the running conversation this session, as [{role, message}]
// with role 'student' | 'tutor' — the same shape Session.aiConversation
// already stores. Kept short by the caller; this function just maps it onto
// Gemini's role vocabulary ('user' | 'model').
async function askTutor({ experiment, trigger, context, history = [] }) {
  if (!config.geminiApiKey) {
    const err = new Error('The AI tutor is not configured on this server yet.');
    err.status = 503;
    throw err;
  }
  if (!checkAndSpendBudget()) {
    const err = new Error('The tutor has reached its free daily limit — please try again tomorrow.');
    err.status = 429;
    throw err;
  }

  const contents = [
    ...history.slice(-8).map((turn) => ({
      role: turn.role === 'tutor' ? 'model' : 'user',
      parts: [{ text: turn.message }],
    })),
    { role: 'user', parts: [{ text: describeTrigger(trigger, context) }] },
  ];

  const body = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(experiment) }] },
    contents,
    generationConfig: { maxOutputTokens: 220, temperature: 0.6 },
  };

  const url = `${GEMINI_URL(config.geminiModel)}?key=${encodeURIComponent(config.geminiApiKey)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new Error('Could not reach the AI tutor service.');
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`The AI tutor service returned an error (${response.status}).`);
    err.status = 502;
    err.detail = detail.slice(0, 500);
    throw err;
  }

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    const err = new Error('The AI tutor had nothing to say — it may have declined to answer.');
    err.status = 502;
    throw err;
  }
  return reply.trim();
}

module.exports = { buildSystemPrompt, describeTrigger, askTutor, budgetStatus };
