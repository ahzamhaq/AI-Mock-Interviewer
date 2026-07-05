// AI service — high-level interview AI logic.
// Provider selection + multi-provider fallback is delegated to aiProviderManager.
const aiManager = require('./aiProviderManager');
const topicGraph = require('./topicGraph');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Fallback category inference when the model doesn't return a valid category.
// Uses the same thresholds the evaluator prompt describes.
function inferCategoryFromScores({ relevance, techAccuracy, implDepth, conceptGround, finalScore }) {
  if (relevance <= 2) return 'off_topic';
  if (techAccuracy <= 3) return 'technically_incorrect';
  if (conceptGround <= 3 && relevance >= 5) return 'shallow';
  if (implDepth <= 3 && techAccuracy >= 6) return 'implementation_weak';
  if (finalScore >= 8.5) return 'excellent';
  if (finalScore >= 7) return 'strong';
  if (finalScore >= 5) return 'partially_correct';
  return 'vague';
}

class AIService {
  async generateText(prompt, options = {}) {
    try {
      return await aiManager.generate(prompt, options);
    } catch (error) {
      console.error('AI generation error:', error.message);
      throw error;
    }
  }

  async generateInterviewQuestions(config) {
    const { role, experienceLevel, companyType, targetCompany, interviewType, difficulty, totalQuestions, jobDescription, resumeText, memoryContext } = config;
    const safeTotal = Math.min(parseInt(totalQuestions) || 5, 8); // cap at 8 to save tokens

    const roleMap = {
      frontend_developer: 'Frontend Developer',
      backend_developer: 'Backend Developer',
      fullstack_developer: 'Full Stack Developer',
      sde: 'Software Development Engineer',
      data_analyst: 'Data Analyst',
      hr: 'HR Manager',
    };

    const prompt = `You are a senior technical interviewer conducting a real interview. Generate exactly ${safeTotal} UNIQUE, high-quality interview questions for a ${roleMap[role] || role} (${experienceLevel}, ${difficulty}, ${interviewType}).
${targetCompany ? `Company: ${targetCompany}. Use their known interview style.` : ''}
${jobDescription ? `JD hint: ${jobDescription.substring(0, 200)}` : ''}
${resumeText ? `Resume hint: ${resumeText.substring(0, 200)}` : ''}
${memoryContext ? `MEMORY: ${memoryContext}` : ''}

RULES:
- Do NOT ask generic textbook questions. Ask varied, realistic interview questions.
- Each question must include a topic label (e.g. "React", "DBMS", "System Design", "Behavioral").
- For technical: mix DSA, design, debugging, real-world scenarios.
- For HR/behavioral: use STAR-style prompts.

Return ONLY a valid JSON array (no markdown, no commentary):
[{"id":"q1","text":"question","type":"technical|hr|behavioral|system_design","topic":"Topic Name","expectedDuration":120,"hints":["hint"],"followUp":"follow-up"}]`;

    const text = await this.generateText(prompt, { temperature: 0.85 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse AI questions response');
    return JSON.parse(jsonMatch[0]);
  }

  // Generate ONE replacement question (used when anti-repetition rejects a candidate).
  async generateReplacementQuestion(config, topic) {
    const { role, experienceLevel, difficulty, interviewType } = config;
    const prompt = `Generate ONE unique interview question about "${topic}" for a ${role} (${experienceLevel}, ${difficulty}, ${interviewType}). Avoid generic phrasing.

Return ONLY valid JSON object (no markdown):
{"id":"rq","text":"the question","type":"${interviewType === 'mixed' ? 'technical' : interviewType}","topic":"${topic}","expectedDuration":120,"hints":["hint"],"followUp":"follow-up?"}`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.9, maxTokens: 400 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      return null;
    }
  }

  // Personalized greeting based on memory context.
  async generatePersonalizedGreeting(memoryContext, config) {
    const { role, targetCompany, companyType } = config;
    const company = targetCompany || companyType || '';
    const prompt = `You are a friendly senior interviewer starting an interview session.

${memoryContext || 'This is the user\'s first interview.'}

Write a warm, natural 2-3 sentence greeting that:
- Welcomes the candidate
- References the target role ("${role}")${company ? ` and company ("${company}")` : ''}
- Acknowledges past performance if any, otherwise encourages a first attempt
- Ends with "Let's begin!"

Return ONLY the greeting text. No quotes, no markdown.`;

    try {
      return (await this.generateText(prompt, { temperature: 0.9, maxTokens: 200 })).trim();
    } catch {
      return `Welcome! I'm your AI interviewer today. We'll go through a ${role} interview together. Let's begin!`;
    }
  }

  // Contextual follow-up question based on the user's actual answer.
  async generateFollowUpQuestion(originalQuestion, userAnswer, config) {
    if (!userAnswer || userAnswer.trim().length < 10) return '';
    const prompt = `You are interviewing a ${config.experienceLevel} ${config.role}.

They were asked: "${originalQuestion}"
They answered: "${userAnswer.substring(0, 400)}"

Generate ONE natural follow-up question that:
- Digs deeper into something they actually said
- Tests understanding, not just recall
- Sounds like a real interviewer reaction

Return ONLY the follow-up question text. No quotes, no JSON, no commentary.`;
    try {
      return (await this.generateText(prompt, { temperature: 0.8, maxTokens: 150 })).trim();
    } catch {
      return '';
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Adaptive engine helpers — phrase the question that the engine decided to ask.
  //  The engine has already chosen: action, topic, type, difficulty. Our job is
  //  to write a *natural* question with the right tone for the persona.
  // ───────────────────────────────────────────────────────────────────────────

  // Generate the next adaptive question after the engine picks an action.
  // `context` shape:
  //   {
  //     action,                 // 'follow_up' | 'revisit_weak' | 'pivot' | 'memorized_probe'
  //     topic,
  //     questionType,
  //     difficulty,
  //     intent,                 // hidden interviewer intent (drives phrasing)
  //     persona,                // legacy { style, tone, rigor }
  //     personality,            // NEW: rich personality object from registry
  //     pacingHint,             // NEW: short tempo instruction ("keep it short" etc.)
  //     pressure,               // NEW: 'relaxed' | 'standard' | 'intense'
  //     projectAxis,            // NEW: optional { id, label, intent, exampleAngles } for deep-dive
  //     config,                 // full interview config
  //     parentQuestion, parentAnswer,
  //     askedQuestions, resumeText, jobDescription, graphHint,
  //     callback, answerLength, consecutiveLowScores,
  //   }
  async generateAdaptiveQuestion(context) {
    const {
      action, topic, questionType, difficulty, intent, qualityIntentHint, missingConcepts, persona, personality, pacingHint, pressure,
      projectAxis, round, config,
      parentQuestion, parentAnswer, askedQuestions = [], resumeText, jobDescription, graphHint,
      callback, answerLength, consecutiveLowScores,
    } = context;

    const askedDigest = askedQuestions.slice(-6).map((q, i) => `  ${i + 1}. ${q.text}`).join('\n');

    // ── Personality line — use rich personality if available, else fall back to persona
    let personaLine;
    if (personality) {
      personaLine = `You are a ${personality.style}. Tone: ${personality.tone}. Rigor: ${personality.rigor}.`;
    } else if (persona) {
      personaLine = `You are a ${persona.style} (tone: ${persona.tone}, rigor: ${persona.rigor}).`;
    } else {
      personaLine = 'You are a senior technical interviewer.';
    }

    // Voice guidelines from the personality registry
    const voiceGuidelinesLine = personality?.voiceGuidelines?.length
      ? 'Personality guidelines:\n' + personality.voiceGuidelines.map(g => `  - ${g}`).join('\n')
      : '';

    // Pressure framing
    let pressureLine = '';
    if (pressure === 'intense') {
      pressureLine = 'Pressure mode: INTENSE. Be more direct. Push harder. Less encouragement. Shorter framing.';
    } else if (pressure === 'relaxed') {
      pressureLine = 'Pressure mode: RELAXED. Be patient. Allow the candidate room to think. Soft framing.';
    }

    const company = config.targetCompany || config.companyType || '';
    const companyLine = company ? `Company context: ${company}. Bias toward their interview style.` : '';

    // ── Build action-specific instruction ──────────────────────────────────
    let actionInstruction = '';
    if (action === 'follow_up' && projectAxis) {
      // Project deep-dive follow-up — drive toward a specific axis
      actionInstruction = `PROJECT DEEP-DIVE follow-up. The candidate is describing a project, and you want to probe a specific dimension: ${projectAxis.label} (${projectAxis.intent}).

The previous question was: "${parentQuestion}"
They answered: "${(parentAnswer || '').substring(0, 500)}"

Generate ONE pointed question that probes ${projectAxis.label} based on what they actually said. Reference something specific from their answer (tech they named, a decision they mentioned). Example angles (use as inspiration, don't quote): ${projectAxis.exampleAngles.slice(0, 2).join(' | ')}.

This must feel like a senior engineer who's actually listened and is now asking the next obvious question — not a checklist.`;
    } else if (action === 'follow_up') {
      actionInstruction = `Ask a FOLLOW-UP question that digs deeper into the candidate's previous answer.
The previous question was: "${parentQuestion}"
They answered: "${(parentAnswer || '').substring(0, 400)}"
Probe one specific claim, ask for tradeoffs, an edge case, or how they'd implement it. Sound like you're actually listening — reference something they said.`;
    } else if (action === 'revisit_weak') {
      actionInstruction = `The candidate struggled with "${topic}" earlier. Revisit it with a SIMPLER, more practical question that reinforces understanding. Don't make them feel quizzed — frame it like a real-world scenario.`;
    } else if (action === 'memorized_probe') {
      actionInstruction = `The candidate's last answer sounded generic/textbook.
The previous question was: "${parentQuestion}"
They answered: "${(parentAnswer || '').substring(0, 400)}"
Ask a PRACTICAL, implementation-oriented question they can't fake. Examples: "Walk me through how you actually built X", "What specific bug did you hit?", "What edge case broke this?"`;
    } else {
      actionInstruction = `Ask a NEW primary question on the topic "${topic}". Avoid topics already covered. Make it feel like a natural turn in the conversation, not a quiz item.`;
    }

    // Length-aware tone adjustment
    let lengthLine = '';
    if (answerLength === 'too_long') {
      lengthLine = `Note: their previous answer rambled. Make this question very specific and narrow — they should know exactly what to focus on.`;
    } else if (answerLength === 'too_short') {
      lengthLine = `Note: their previous answer was very brief. Phrase this so it invites a more detailed response.`;
    }

    // Recovery tone
    let recoveryLine = '';
    if ((consecutiveLowScores || 0) >= 2) {
      recoveryLine = `Note: the candidate has struggled on the last few questions. Keep the tone supportive, not hostile. Ask something approachable.`;
    }

    // Callback hint
    const callbackLine = callback
      ? `Conversational callback: if it fits naturally, reference "${callback}" which the candidate mentioned earlier. Don't force it.`
      : '';

    const intentLine = intent ? `Hidden interviewer intent (do NOT mention this to the candidate): ${intent}.` : '';
    const pacingLine = pacingHint ? `Pacing: ${pacingHint}` : '';

    // Round framing — drives focus when an explicit round was set
    const roundLine = round
      ? `Round: ${round.label}. Focus: ${round.focus}. Question style: ${round.questionStyleHint || 'standard'}.`
      : '';

    // Quality-flag-driven intent hint — bias the question toward fixing the
    // weakness in the previous answer (vague → ask for implementation detail, etc.)
    const qualityHintLine = qualityIntentHint
      ? `Previous answer signal: ${qualityIntentHint}. Bias this question accordingly (without explaining why).`
      : '';

    // Missing-concept hint — when the evaluator identified specific concepts
    // the candidate failed to ground, the follow-up can target one of them.
    const missingConceptsLine = (Array.isArray(missingConcepts) && missingConcepts.length)
      ? `The candidate did not demonstrate understanding of: ${missingConcepts.join(', ')}. If natural, probe one of these specifically — but phrase it as a question, not an accusation.`
      : '';

    const prompt = `${personaLine}
${companyLine}
${pressureLine}
${roundLine}
${voiceGuidelinesLine}
Role: ${config.role} | Experience: ${config.experienceLevel} | Interview type: ${config.interviewType} | Current difficulty: ${difficulty}
${intentLine}
${qualityHintLine}
${pacingLine}

${actionInstruction}
${lengthLine}
${recoveryLine}
${callbackLine}
${missingConceptsLine}

Question type to ask: ${questionType}
Target topic: ${topic}
${graphHint ? `Adjacent topics (inspiration only — don't list them): ${graphHint}` : ''}

${resumeText ? `Candidate resume excerpt:\n${resumeText.substring(0, 400)}\n` : ''}
${jobDescription ? `Job description excerpt:\n${jobDescription.substring(0, 400)}\n` : ''}

Already asked this session (DO NOT repeat or paraphrase):
${askedDigest || '  (none)'}

Voice rules (always):
- One or two sentences. Conversational.
- No "Here's your next question:" preambles, no numbering.
- Don't over-praise the candidate.
- Sound like a human, not a quiz prompt.

Return ONLY valid JSON, no markdown:
{"text":"the question","topic":"${topic}","type":"${questionType}","hints":["short hint 1","short hint 2"],"expectedDuration":120}`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.85, maxTokens: 350 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse adaptive question response');
      const q = JSON.parse(jsonMatch[0]);
      return {
        text: q.text,
        topic: q.topic || topic,
        type: q.type || questionType,
        hints: Array.isArray(q.hints) ? q.hints.slice(0, 3) : [],
        expectedDuration: q.expectedDuration || 120,
      };
    } catch (err) {
      console.error('Adaptive question generation failed:', err.message);
      // Fallback to a minimal generic question rather than crashing the interview
      return {
        text: action === 'follow_up'
          ? `Can you elaborate on the implementation details of what you just described?`
          : `Tell me about ${topic}.`,
        topic,
        type: questionType,
        hints: [],
        expectedDuration: 120,
      };
    }
  }

  // Generate a natural conversational closing line at the end of the interview.
  // Should sound like a real interviewer wrapping up — brief, professional,
  // honest, and adapted to personality + round + performance.
  async generateClosingLine(interview) {
    const { results, persona, questions, round: roundId } = interview;
    const answered = questions.filter(q => !q.skipped && q.aiFeedback?.score > 0);
    const score = results?.overallScore || 0;

    const topStrengths = (results?.strengths || []).slice(0, 2).join('; ');
    const topWeakness = (results?.weaknesses || [])[0] || '';

    const tone = persona?.tone || 'professional';
    const style = persona?.style || 'senior interviewer';

    const roundLine = (roundId && roundId !== 'general')
      ? `This was a ${roundId.replace(/_/g, ' ')} round.`
      : '';

    const prompt = `You are a ${style} (tone: ${tone}) wrapping up a mock interview.
${roundLine}

Facts to incorporate (use them naturally — don't list them as bullets):
- Candidate answered ${answered.length} of ${questions.filter(q => !q.isFollowUp).length} planned questions
- Overall score: ${score.toFixed(1)}/10
${topStrengths ? `- Notable strengths: ${topStrengths}` : ''}
${topWeakness ? `- Area to grow: ${topWeakness}` : ''}

Write a 2–3 sentence closing that:
- Thanks the candidate
- Acknowledges what went well (be honest — don't oversell if score is low)
- Suggests one concrete area to focus on next
- Matches your tone (warm if friendly, neutral if strict)
- Sounds like a real human ending an interview, not a report card

Return ONLY the closing text. No quotes, no markdown, no JSON.`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.75, maxTokens: 220 });
      return text.trim().replace(/^["']|["']$/g, '');
    } catch {
      return `Thanks for going through the session. Keep practicing — focus on the areas we discussed today.`;
    }
  }

  // Detect memorized / generic answers with an LLM second-opinion.
  // Returns { memorized: boolean, reason: string } — used by the engine
  // when the heuristic in adaptiveEngine.js is ambiguous.
  async detectMemorized(question, answer) {
    if (!answer || answer.trim().length < 30) return { memorized: false, reason: 'too short' };
    const prompt = `A candidate was asked: "${question}"
They answered: "${answer.substring(0, 500)}"

Does this answer sound memorized/textbook/generic (vs. genuinely understood)?
Signs of memorized: textbook phrasing, no specific examples, no implementation details, no opinions/tradeoffs, very fluent grammar but shallow content.
Signs of genuine: concrete examples, "I" statements, specific tools/versions, edge cases mentioned, opinions/tradeoffs.

Return ONLY JSON: {"memorized": true|false, "reason": "one short sentence"}`;
    try {
      const text = await this.generateText(prompt, { temperature: 0.2, maxTokens: 150 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { memorized: false, reason: 'parse error' };
      const obj = JSON.parse(jsonMatch[0]);
      return { memorized: !!obj.memorized, reason: obj.reason || '' };
    } catch {
      return { memorized: false, reason: 'detection failed' };
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Question understanding phase.
  //
  // Extracts the core technical concepts an answer should touch. Called once
  // per question (lazily, the first time we evaluate an answer for it) and
  // cached on the Interview document so future operations can reuse it.
  //
  // The output is intentionally small — 4 to 7 concept tokens. The evaluator
  // then checks which of these the candidate actually mentioned/explained.
  // ───────────────────────────────────────────────────────────────────────
  async extractExpectedConcepts(questionText, config) {
    if (!questionText || questionText.trim().length < 5) return [];

    const prompt = `You are preparing to evaluate an answer to this interview question:
"${questionText}"

Role: ${config.role || 'engineer'} | Level: ${config.experienceLevel || 'mid'}

List 4 to 7 SHORT concept tokens (1-3 words each) that a good answer MUST touch to demonstrate
real understanding. These are the mechanisms / ideas / techniques the answer should ground itself in.

Examples:
- For "What is useMemo?": ["memoization","dependency array","recomputation","performance","cached value"]
- For "How does JWT auth work?": ["signed token","header.payload.signature","stateless","verification","secret/key","expiration"]
- For "Explain React reconciliation": ["virtual DOM","diffing","keys","component types","fiber","render tree"]

Rules:
- Pick concepts ESSENTIAL to demonstrating understanding, not nice-to-haves.
- No filler ("the question", "answer", "developer", "code").
- Concepts should be specific enough that an off-topic answer would clearly miss them.

Return ONLY a JSON array of strings, no markdown:
["concept1","concept2","concept3","concept4","concept5"]`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.2, maxTokens: 200 });
      const m = text.match(/\[[\s\S]*?\]/);
      if (!m) return [];
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(x => typeof x === 'string')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 60)
        .slice(0, 7);
    } catch {
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Strict evaluator.
  //
  // Design principles (driven by user requirements):
  //
  //   - RELEVANCE is the gatekeeper. If the answer doesn't actually answer
  //     the question, the overall score collapses regardless of fluency.
  //   - Communication/grammar have very low weight in the final score.
  //   - Buzzwords without mechanisms → low technical_accuracy.
  //   - Imperfect grammar / broken transcripts are tolerated when the
  //     technical meaning is visible.
  //   - The LLM proposes scores; we then apply DETERMINISTIC caps in code so
  //     the model can't over-score regardless of what it returns.
  //
  // `expectedConcepts` is required for full strictness; if absent, the
  // evaluator falls back to a less strict (but still skeptical) evaluation.
  // ───────────────────────────────────────────────────────────────────────
  async evaluateAnswer(question, answer, config, options = {}) {
    if (!answer || answer.trim().length < 5) {
      return this._getDefaultFeedback('Answer too short or empty');
    }

    const expectedConcepts = options.expectedConcepts || [];
    const conceptList = expectedConcepts.length
      ? expectedConcepts.map(c => `- ${c}`).join('\n')
      : '(not provided — evaluate based on question alone)';

    const prompt = `You are a SKEPTICAL SENIOR INTERVIEWER evaluating an answer.
Role: ${config.role} | Level: ${config.experienceLevel}

QUESTION: "${question}"

CANDIDATE ANSWER: "${answer.substring(0, 900)}"

CORE CONCEPTS expected in a good answer:
${conceptList}

═══════════════════════════════════════════════════════════════════════════
EVALUATION PHILOSOPHY (CRITICAL — follow strictly):
═══════════════════════════════════════════════════════════════════════════

You are NOT a supportive teacher. You are NOT scoring an essay.
You evaluate technical UNDERSTANDING, not presentation.

REWARD:
  - Technical mechanisms ("the dependency array tells React when to recompute")
  - Implementation details ("we used Redis with a 30s TTL")
  - Reasoning ("we chose this because the alternative would cause stale reads")
  - Tradeoff awareness, edge cases, production thinking
  - Concrete examples / first-person experience

PENALIZE HEAVILY:
  - Vague tech-speak: "JWT is secure and scalable", "React is performant"
  - Buzzwords without mechanisms: "leverages best practices", "robust ecosystem"
  - Off-topic answers that drift away from what was asked
  - Restating the question without answering it
  - Confident-sounding fluff that contains no mechanism or example

IGNORE / TOLERATE:
  - Imperfect grammar, broken sentences, missing words
  - Filler words, repetition, transcription noise
  - Hesitation, pauses, informal phrasing
  - Accent / pronunciation issues (you only see text)

  → As long as TECHNICAL MEANING is visible, do NOT penalize for delivery.

═══════════════════════════════════════════════════════════════════════════
RUBRIC — score each dimension INDEPENDENTLY, 0-10
═══════════════════════════════════════════════════════════════════════════

1. relevanceScore (GATEKEEPER):
   - 0-2  = does not address the question / off-topic
   - 3-4  = tangentially related, mostly drifts
   - 5-6  = touches the question but stays at surface level
   - 7-8  = directly answers the question with on-target content
   - 9-10 = directly answers AND covers what matters

2. technicalAccuracyScore:
   - How CORRECT is the content actually said?
   - Wrong claims with confidence = LOW.
   - Right reasoning with hedging = HIGH.

3. completenessScore:
   - Does the answer cover the parts the question asks for?
   - Multi-part question only partially covered = LOW.
   - Concise but covers all parts = HIGH.

4. implementationDepthScore:
   - Does it sound like the candidate has BUILT something with this?
   - Concrete examples, debugging stories, version numbers, real numbers = HIGH.
   - Textbook-only / no first-person depth = LOW.

5. reasoningScore:
   - Quality of THINKING — even if the final answer is incomplete.
   - "I'd try X first because Y" = HIGH even if X is wrong.
   - No reasoning visible / pure recall = LOW.

6. conceptualGroundingScore:
   - How many of the CORE CONCEPTS (listed above) were actually explained
     (not just name-dropped)?
   - Naming a concept ≠ explaining it.

7. practicalScore:
   - Production / real-world awareness.

LOW-WEIGHT dimensions (these should NOT drive the overall score):
- communicationScore (0-10): light credit for coherence; do NOT reward eloquence
- grammarScore (0-10): ignore unless it makes the answer literally unintelligible
- confidenceScore (0-100): SEPARATE from correctness. Confident + wrong = low.

═══════════════════════════════════════════════════════════════════════════
CONCEPT GROUNDING
═══════════════════════════════════════════════════════════════════════════

Compare the answer against the CORE CONCEPTS above. For each concept:
  - If the candidate explained the underlying mechanism → "mentioned"
  - If they only name-dropped without explanation → NOT mentioned
  - If they didn't touch it at all → "missing"

Return:
  - mentionedConcepts: subset of CORE CONCEPTS actually explained (not just named)
  - missingConcepts:   CORE CONCEPTS the candidate didn't ground

═══════════════════════════════════════════════════════════════════════════
RESPONSE CATEGORY
═══════════════════════════════════════════════════════════════════════════

Classify the response as exactly one of:
  excellent          — comprehensive, accurate, concrete, with reasoning
  strong             — covers most concepts well, minor gaps
  partially_correct  — right direction, missing pieces
  vague              — relates to the topic but lacks substance
  off_topic          — doesn't address the question
  memorized          — textbook phrasing, no personal/practical grounding
  buzzword_heavy     — keywords with no mechanism
  shallow            — names ideas without explaining them
  technically_incorrect — contains factual errors
  implementation_weak — conceptually OK but no implementation grounding

═══════════════════════════════════════════════════════════════════════════
OVERALL SCORE
═══════════════════════════════════════════════════════════════════════════

Propose an overall "score" 0-10. Weight it as:
  - 35% relevance
  - 25% technicalAccuracy
  - 15% conceptualGrounding
  - 10% implementationDepth
  - 10% reasoning
  -  5% completeness

Communication and grammar should NOT factor into the overall score.

DO NOT inflate. Moderate/high scores must be EARNED with mechanisms,
examples, and reasoning — not fluency.

═══════════════════════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no commentary):
{
  "score": 6.5,
  "relevanceScore": 8,
  "technicalAccuracyScore": 6,
  "completenessScore": 5,
  "implementationDepthScore": 4,
  "reasoningScore": 7,
  "conceptualGroundingScore": 6,
  "practicalScore": 5,
  "technicalScore": 6,
  "communicationScore": 7,
  "grammarScore": 8,
  "confidenceScore": 65,
  "mentionedConcepts": ["concept actually explained","..."],
  "missingConcepts": ["concept not touched","..."],
  "responseCategory": "partially_correct",
  "strengths": ["specific thing they did well"],
  "weaknesses": ["specific gap, not a general critique"],
  "betterAnswer": "a 2-3 sentence model answer focused on mechanisms",
  "improvements": ["concrete improvement 1","concrete improvement 2"],
  "followUpQuestion": "a probing follow-up",
  "summary": "one sentence honest assessment"
}`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.3 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Parse error');
      const fb = JSON.parse(jsonMatch[0]);

      // Clamp helper
      const clamp10 = (n) => Math.min(10, Math.max(0, Number(n) || 0));
      const clamp100 = (n) => Math.min(100, Math.max(0, Number(n) || 0));

      // ── Pull rubric values ────────────────────────────────────────────
      const relevance       = clamp10(fb.relevanceScore);
      const techAccuracy    = clamp10(fb.technicalAccuracyScore ?? fb.technicalScore);
      const completeness    = clamp10(fb.completenessScore);
      const implDepth       = clamp10(fb.implementationDepthScore ?? fb.practicalScore);
      const reasoning       = clamp10(fb.reasoningScore);
      const conceptGround   = clamp10(fb.conceptualGroundingScore);
      const practical       = clamp10(fb.practicalScore);

      // Low-weight dimensions
      const communication   = clamp10(fb.communicationScore);
      const grammar         = clamp10(fb.grammarScore);
      const confidence      = clamp100(fb.confidenceScore);

      // ── Deterministic weighted overall score ──────────────────────────
      // Communication & grammar deliberately have 0 weight here. The LLM
      // proposes a score; we ignore it and compute our own to enforce policy.
      const computed =
        0.35 * relevance +
        0.25 * techAccuracy +
        0.15 * conceptGround +
        0.10 * implDepth +
        0.10 * reasoning +
        0.05 * completeness;

      const rawScore = Math.round(computed * 10) / 10;

      // ── Strict caps (the "skeptical interviewer" guarantees) ──────────
      let finalScore = rawScore;
      let capReason = '';

      // Off-topic / irrelevant → cap at 3
      if (relevance <= 3) {
        finalScore = Math.min(finalScore, 3);
        capReason = 'low_relevance';
      }
      // Tangential answer → cap at 5
      else if (relevance <= 5 && !capReason) {
        finalScore = Math.min(finalScore, 5.5);
        capReason = 'tangential';
      }

      // Buzzword-heavy / no mechanisms → cap at 5
      const category = (fb.responseCategory || '').toLowerCase();
      if (category === 'buzzword_heavy' || category === 'memorized') {
        finalScore = Math.min(finalScore, 5);
        if (!capReason) capReason = category;
      }

      // Technically incorrect → cap at 4
      if (category === 'technically_incorrect' || techAccuracy <= 3) {
        finalScore = Math.min(finalScore, 4);
        if (!capReason) capReason = 'technically_incorrect';
      }

      // Off-topic category override
      if (category === 'off_topic') {
        finalScore = Math.min(finalScore, 2.5);
        if (!capReason) capReason = 'off_topic';
      }

      // Vague / shallow → cap at 6
      if (category === 'vague' || category === 'shallow') {
        finalScore = Math.min(finalScore, 6);
        if (!capReason) capReason = category;
      }

      // High score requires implementation depth — engineers don't get 8+ from theory alone
      if (finalScore >= 8 && implDepth < 6) {
        finalScore = Math.min(finalScore, 7.5);
        if (!capReason) capReason = 'no_implementation_depth';
      }

      finalScore = clamp10(finalScore);

      // ── Concept grounding lists ───────────────────────────────────────
      const mentionedConcepts = Array.isArray(fb.mentionedConcepts)
        ? fb.mentionedConcepts.filter(x => typeof x === 'string').slice(0, 10)
        : [];
      const missingConcepts = Array.isArray(fb.missingConcepts)
        ? fb.missingConcepts.filter(x => typeof x === 'string').slice(0, 10)
        : [];

      // ── Response category fallback ────────────────────────────────────
      const validCategories = new Set([
        'excellent', 'strong', 'partially_correct', 'vague', 'off_topic',
        'memorized', 'buzzword_heavy', 'shallow', 'technically_incorrect',
        'implementation_weak', 'empty',
      ]);
      const responseCategory = validCategories.has(category) ? category : inferCategoryFromScores({
        relevance, techAccuracy, implDepth, conceptGround, finalScore,
      });

      // Legacy `technicalScore` field — keep populated for backward compat
      // but use the strict accuracy value, not the LLM's loose number.
      const technicalScore = techAccuracy;

      return {
        score: finalScore,
        rawScore,
        scoreCapReason: capReason,

        // Strict rubric
        relevanceScore: relevance,
        technicalAccuracyScore: techAccuracy,
        completenessScore: completeness,
        implementationDepthScore: implDepth,
        reasoningScore: reasoning,
        conceptualGroundingScore: conceptGround,
        practicalScore: practical,

        // Legacy / low-weight
        technicalScore,
        communicationScore: communication,
        grammarScore: grammar,
        confidenceScore: confidence,

        // Concept grounding evidence
        mentionedConcepts,
        missingConcepts,

        // Category + narrative
        responseCategory,
        strengths: Array.isArray(fb.strengths) ? fb.strengths : [],
        weaknesses: Array.isArray(fb.weaknesses) ? fb.weaknesses : [],
        betterAnswer: fb.betterAnswer || '',
        improvements: Array.isArray(fb.improvements) ? fb.improvements : [],
        followUpQuestion: fb.followUpQuestion || '',
        summary: fb.summary || '',
      };
    } catch (err) {
      console.error('[evaluateAnswer] failed:', err?.message, err?.stack?.split('\n')[1]);
      return this._getDefaultFeedback('Unable to evaluate answer');
    }
  }

  async generateOverallFeedback(interview) {
    const answeredQs = interview.questions.filter(q => !q.skipped && q.aiFeedback.score > 0);
    if (!answeredQs.length) return 'No answers to evaluate.';

    const qaSummary = answeredQs.slice(0, 5).map((q, i) =>
      `Q${i + 1}: ${q.questionText}\nA: ${q.userAnswer?.substring(0, 200)}\nScore: ${q.aiFeedback.score}/10`
    ).join('\n\n');

    const prompt = `As a senior interviewer, provide overall interview feedback.

Interview Summary:
- Role: ${interview.config.role}
- Overall Score: ${interview.results.overallScore}/10
- Technical Score: ${interview.results.technicalScore}/10
- Communication Score: ${interview.results.communicationScore}/10
- Confidence: ${interview.results.confidenceScore}%
- Questions Answered: ${answeredQs.length}/${interview.questions.length}

Sample Q&A:
${qaSummary}

Provide:
1. Overall performance assessment (2-3 sentences)
2. Top 3 strengths demonstrated
3. Top 3 areas for improvement
4. Hiring recommendation (Strong Hire / Hire / Maybe / No Hire)
5. One key advice for their next interview

Return as JSON:
{
  "overallFeedback": "...",
  "strengths": ["s1","s2","s3"],
  "weaknesses": ["w1","w2","w3"],
  "recommendation": "Hire|Maybe|No Hire|Strong Hire",
  "keyAdvice": "..."
}`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.5 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return 'Thank you for completing the interview. Review your scores above for detailed feedback.';
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { overallFeedback: 'Interview completed.', strengths: [], weaknesses: [], recommendation: 'Review needed', keyAdvice: 'Practice more.' };
    }
  }

  async generateResumeQuestions(resumeText, role) {
    const prompt = `Based on this resume, generate 3 specific questions an interviewer would ask:
Resume: ${resumeText.substring(0, 1000)}
Role: ${role}

Return JSON array:
[{"text": "question", "type": "technical", "resumeBased": true}]`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.7 });
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      return [];
    }
  }

  _getDefaultFeedback(reason) {
    return {
      score: 0,
      rawScore: 0,
      scoreCapReason: 'empty',

      relevanceScore: 0,
      technicalAccuracyScore: 0,
      completenessScore: 0,
      implementationDepthScore: 0,
      reasoningScore: 0,
      conceptualGroundingScore: 0,
      practicalScore: 0,

      technicalScore: 0,
      communicationScore: 0,
      grammarScore: 0,
      confidenceScore: 0,

      mentionedConcepts: [],
      missingConcepts: [],

      responseCategory: 'empty',
      strengths: [],
      weaknesses: [reason],
      betterAnswer: '',
      improvements: ['Please provide a more detailed answer'],
      followUpQuestion: '',
      summary: reason,
    };
  }
}

module.exports = new AIService();
