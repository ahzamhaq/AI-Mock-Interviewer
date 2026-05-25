// AI service — high-level interview AI logic.
// Provider selection + multi-provider fallback is delegated to aiProviderManager.
const aiManager = require('./aiProviderManager');
const topicGraph = require('./topicGraph');

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
      action, topic, questionType, difficulty, intent, qualityIntentHint, persona, personality, pacingHint, pressure,
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

  async evaluateAnswer(question, answer, config) {
    if (!answer || answer.trim().length < 5) {
      return this._getDefaultFeedback('Answer too short or empty');
    }

    // Nuanced multi-dimensional scoring. The prompt instructs the model to
    // award PARTIAL CREDIT — strong reasoning with incomplete answers should
    // not collapse to a low score, and shallow-but-fluent answers should not
    // be inflated. Each dimension is scored independently.
    const prompt = `You are evaluating an interview answer for a ${config.role} (${config.experienceLevel}).

Q: "${question}"
A: "${answer.substring(0, 700)}"

Evaluate across these INDEPENDENT dimensions. Score nuanced — partial credit matters:

- technicalScore (0-10): correctness, accuracy of facts/concepts
- communicationScore (0-10): clarity, structure, conciseness
- confidenceScore (0-100): how grounded vs. hedged the answer sounds
- completenessScore (0-10): coverage of the question (edge cases, all parts addressed)
- grammarScore (0-10): language quality
- reasoningScore (0-10): quality of thinking even when the answer is wrong/incomplete
- practicalScore (0-10): implementation/production awareness, real-world grounding

PARTIAL CREDIT RULES:
- A wrong final answer with strong reasoning may still score 6-7 on technicalScore.
- A technically correct but textbook-sounding answer should score lower on practicalScore.
- High grammar + low completeness often signals memorization — note it in weaknesses.
- Strong reasoning toward the right direction (even if not finished) → high reasoningScore.

The overall "score" should NOT be a simple average. Weight technical correctness
more for technical questions; weight communication/reasoning more for behavioral.

Return ONLY valid JSON (no markdown):
{"score":7,"technicalScore":7,"communicationScore":7,"confidenceScore":70,"completenessScore":7,"grammarScore":8,"reasoningScore":7,"practicalScore":6,"strengths":["s1","s2"],"weaknesses":["w1"],"betterAnswer":"model answer here","improvements":["i1","i2"],"followUpQuestion":"follow up?","summary":"brief summary"}`;

    try {
      const text = await this.generateText(prompt, { temperature: 0.4 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Parse error');
      const feedback = JSON.parse(jsonMatch[0]);

      return {
        score: Math.min(10, Math.max(0, Number(feedback.score) || 5)),
        technicalScore: Math.min(10, Math.max(0, Number(feedback.technicalScore) || 5)),
        communicationScore: Math.min(10, Math.max(0, Number(feedback.communicationScore) || 5)),
        confidenceScore: Math.min(100, Math.max(0, Number(feedback.confidenceScore) || 50)),
        completenessScore: Math.min(10, Math.max(0, Number(feedback.completenessScore) || 5)),
        grammarScore: Math.min(10, Math.max(0, Number(feedback.grammarScore) || 5)),
        // New partial-credit dimensions — fall back to a reasonable default
        // if the model didn't return them (handles older responses gracefully).
        reasoningScore: Math.min(10, Math.max(0, Number(feedback.reasoningScore) || Number(feedback.technicalScore) || 5)),
        practicalScore: Math.min(10, Math.max(0, Number(feedback.practicalScore) || Number(feedback.completenessScore) || 5)),
        strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
        weaknesses: Array.isArray(feedback.weaknesses) ? feedback.weaknesses : [],
        betterAnswer: feedback.betterAnswer || '',
        improvements: Array.isArray(feedback.improvements) ? feedback.improvements : [],
        followUpQuestion: feedback.followUpQuestion || '',
        summary: feedback.summary || '',
      };
    } catch {
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
      technicalScore: 0,
      communicationScore: 0,
      confidenceScore: 0,
      completenessScore: 0,
      grammarScore: 0,
      reasoningScore: 0,
      practicalScore: 0,
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
