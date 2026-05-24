// AI service — high-level interview AI logic.
// Provider selection + multi-provider fallback is delegated to aiProviderManager.
const aiManager = require('./aiProviderManager');

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

  async evaluateAnswer(question, answer, config) {
    if (!answer || answer.trim().length < 5) {
      return this._getDefaultFeedback('Answer too short or empty');
    }

    const prompt = `Evaluate this interview answer. Role: ${config.role}, Level: ${config.experienceLevel}.

Q: "${question}"
A: "${answer.substring(0, 600)}"

Return ONLY valid JSON:
{"score":7,"technicalScore":7,"communicationScore":7,"confidenceScore":70,"completenessScore":7,"grammarScore":8,"strengths":["s1","s2"],"weaknesses":["w1"],"betterAnswer":"model answer here","improvements":["i1","i2"],"followUpQuestion":"follow up?","summary":"brief summary"}`;

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
