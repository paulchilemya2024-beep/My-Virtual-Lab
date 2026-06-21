const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');

// Initialise Gemini only if a key is configured. Without a key we fall back to
// rule-based responses so the app still works during local development.
let genAI = null;
if (config.gemini.apiKey) {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
}

// Section 8 — the system prompt is the most important thing in the AI tutor.
// It constrains Gemini to behave like a Socratic science teacher and feeds it
// the correct reaction data so it never invents wrong science.
function buildSystemPrompt(experiment, studentLevel = 'beginner') {
  const objectives = (experiment.learningObjectives || []).join('\n- ');
  const steps = (experiment.steps || []).map((step) => `- ${step.instruction}`).join('\n');
  const chemicals = (experiment.availableChemicals || []).join(', ') || 'none';
  const variables = (experiment.availableVariables || []).join(', ') || 'none';
  const reactionData = JSON.stringify(experiment.reactions || {}, null, 2);

  return `You are a friendly, encouraging science teacher named SIMI.
You are helping a ${studentLevel} student complete the following experiment.
Title: "${experiment.title}"
Subject: ${experiment.subject || 'science'}
Description: ${experiment.description || 'No description provided.'}
Available chemicals: ${chemicals}
Available variables: ${variables}

The expected learning outcomes are:
- ${objectives || 'Understand the core concept of this experiment.'}

Experiment steps:
${steps || '- No step list available.'}

The correct reaction/outcome data is (use this — never contradict it):
${reactionData}

Your teaching style:
- NEVER give the student the answer directly.
- Ask guiding questions to help them think.
- If they make a mistake, explain WHY it is wrong scientifically.
- Keep explanations simple — use analogies the student will understand.
- Be encouraging. Mistakes are part of learning.
- Limit your response to 3 sentences unless the student asks for more detail.
- If the student is on the right track, affirm them and push them further.
- Only discuss chemistry concepts like acid-base neutralization when they are directly relevant to this experiment.
- If this experiment is not chemistry-focused, do not use acid-base language or pH-specific advice.

The current experiment state is provided with each message. Respond as SIMI.`;
}

// Builds the per-message user turn from the live experiment state + question.
function buildUserMessage(experiment, experimentContext, question) {
  return `Experiment: "${experiment.title}" (${experiment.subject || 'science'})
Current experiment state:
${JSON.stringify(experimentContext || {}, null, 2)}

Student's question or action: ${question || '(the student just opened the experiment)'}`;
}

// Ask the tutor a question. Returns { reply, source } where source is
// "gemini" or "fallback" so the frontend/logs know which path was used.
async function askTutor({ experiment, studentLevel, experimentContext, question }) {
  if (!genAI) {
    return { reply: fallbackReply({ experiment, experimentContext, question }), source: 'fallback' };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: buildSystemPrompt(experiment, studentLevel),
    });

    const result = await model.generateContent(buildUserMessage(experiment, experimentContext, question));
    const reply = result.response.text().trim();
    return { reply, source: 'gemini' };
  } catch (error) {
    console.error('Gemini request failed, using fallback:', error.message);
    return { reply: fallbackReply({ experiment, experimentContext, question }), source: 'fallback' };
  }
}

// Rule-based responses for when Gemini is unavailable. Experiment-agnostic so
// chemistry AND physics labs still get sensible Socratic prompts offline.
function fallbackReply({ experiment, experimentContext = {}, question }) {
  const subject = (experiment.subject || '').toLowerCase();
  const ph = Number(experimentContext.currentPH ?? experimentContext.ph);
  const lastAction = (experimentContext.lastAction || '').toLowerCase();

  if (question && question.trim()) {
    if (/why|how|what|explain/i.test(question)) {
      return "Great question — think it through step by step. What do the readings or arrows on screen tell you right now, and what do you think is causing that?";
    }
    return 'Good thinking. Try the next small change and watch how the readings respond — what do you expect to happen?';
  }

  if (subject === 'physics') {
    if (lastAction.includes('conductor') || lastAction.includes('insulator')) {
      if (lastAction.includes('lit up') || lastAction.includes('conductor')) {
        return 'Nice — the bulb lit, so charge flowed through it. Metals have free electrons that carry the current. Why do you think we wrap wires in rubber or plastic?';
      }
      return "The bulb stayed dark, so no current got through — this material is an insulator. What do its particles lack that metals have?";
    }
    if (lastAction.includes('slide')) {
      return 'The block started sliding! At that exact angle the down-slope pull (mg·sinθ) finally beat the maximum friction (μ·mg·cosθ). What happens to the net force the instant it moves?';
    }
    if (lastAction.includes('hit!') || lastAction.includes('hit target') || lastAction.includes('hit')) {
      return "Bullseye! Now look at your table — can you find the angle that sends it furthest for the same speed? What is special about 45°?";
    }
    if (lastAction.includes('overshot') || lastAction.includes('fell short')) {
      return 'Close! Compare this shot with your last one — did raising the angle increase or decrease the range? Try nudging it back toward 45°.';
    }
    if (lastAction.includes('mass') && lastAction.includes('period')) {
      return "Notice the period didn't change when you changed the mass! Gravity pulls harder on a heavier bob, but it also takes more force to move it — the two effects cancel. What does the formula T = 2π√(L/g) tell you about what DOES matter?";
    }
  }

  if (subject === 'biology') {
    if (lastAction.includes('swells') || lastAction.includes('shrinks') || lastAction.includes('cell')) {
      return 'That observation is important — water is moving across the membrane. Which side has higher solute concentration, and which way should the water flow?';
    }
    return 'Observe what is happening to the cell model and compare it to the solution around it. What does that tell you about the direction of water movement?';
  }

  if (subject === 'chemistry') {
    if (lastAction.includes('too much') || lastAction.includes('overshot')) {
      return 'Oops — you added too much at once. See how the pH jumped past 7? In a real lab you would have to restart. Try again and slow right down near pH 6.';
    }
    if (lastAction.includes('danger')) {
      return 'Whoa — that combination is hazardous! In a real lab that could be dangerous. What made the reaction so violent, and which chemicals should never be mixed?';
    }
    if (lastAction.includes('precipitate')) {
      return 'A solid appeared — that is a precipitate, an insoluble product dropping out of solution. What does its colour tell you about the metal ion involved?';
    }
    if (lastAction.includes('gas')) {
      return 'Bubbles! A gas is being produced. How could you test which gas it is?';
    }
    if (!Number.isNaN(ph)) {
      if (ph >= 6.8 && ph <= 7.2) {
        return 'Beautiful! You found the equivalence point. At pH 7 the acid and base have completely neutralised each other — well done!';
      }
      if (ph < 6.8) {
        return 'You are still on the acidic side. Add the base slowly, one drop at a time, and watch the pH climb toward 7.';
      }
      return 'You have gone slightly past neutral into basic territory. What does that tell you about how much base to add next time?';
    }
  }

  return `Welcome to "${experiment.title}"! ${
    experiment.description || ''
  } Start with the first step and tell me what you observe.`;
}

module.exports = { askTutor, buildSystemPrompt, buildUserMessage };
