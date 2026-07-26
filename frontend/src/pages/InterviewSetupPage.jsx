import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft,
  Code, Users, Layers, Database, Briefcase, Cpu, Play,
} from 'lucide-react';
import { interviewAPI } from '../services/api';
import Navbar from '../components/layout/Navbar';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'frontend_developer', label: 'Frontend Dev', icon: Code, color: 'from-blue-500 to-cyan-500' },
  { value: 'backend_developer', label: 'Backend Dev', icon: Database, color: 'from-green-500 to-emerald-500' },
  { value: 'fullstack_developer', label: 'Full Stack', icon: Layers, color: 'from-purple-500 to-violet-500' },
  { value: 'sde', label: 'SDE', icon: Cpu, color: 'from-orange-500 to-red-500' },
  { value: 'data_analyst', label: 'Data Analyst', icon: Briefcase, color: 'from-pink-500 to-rose-500' },
  { value: 'hr', label: 'HR Interview', icon: Users, color: 'from-yellow-500 to-amber-500' },
];

const EXPERIENCE = [
  { value: 'fresher', label: 'Fresher', desc: '0–6 months, entry-level' },
  { value: '1-2_years', label: '1–2 Years', desc: 'Junior to mid-level' },
  { value: '3+_years', label: '3+ Years', desc: 'Senior / lead level' },
];

const COMPANY_TYPES = [
  { value: 'faang', label: 'FAANG', desc: 'Google, Amazon, Meta, Apple, Netflix' },
  { value: 'product_based', label: 'Product-Based', desc: 'Atlassian, Razorpay, Zepto...' },
  { value: 'startup', label: 'Startup', desc: 'Fast-paced, generalist roles' },
  { value: 'service_based', label: 'Service-Based', desc: 'TCS, Infosys, Wipro...' },
];

const COMPANIES = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Netflix', 'Adobe', 'Flipkart', 'Razorpay', 'TCS', 'Infosys', 'Wipro', 'Deloitte', 'Other'];
const PRESET_COMPANIES = COMPANIES.filter(c => c !== 'Other');

const INTERVIEW_TYPES = [
  { value: 'technical', label: 'Technical', desc: 'DSA, system design, CS fundamentals' },
  { value: 'hr', label: 'HR', desc: 'Behavioral, culture fit, situational' },
  { value: 'behavioral', label: 'Behavioral', desc: 'STAR method, soft skills' },
  { value: 'system_design', label: 'System Design', desc: 'Architecture, scalability (senior)' },
  { value: 'mixed', label: 'Mixed', desc: 'Combo of technical + HR' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: 'text-green-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'hard', label: 'Hard', color: 'text-red-400' },
];

const OptionCard = ({ selected, onClick, children, className = '' }) => (
  <motion.button
    type="button"
    onClick={onClick}
    className={`p-4 rounded-xl border text-left transition-all duration-200 ${
      selected
        ? 'border-primary-500 bg-primary-600/10 shadow-glow-sm'
        : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
    } ${className}`}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    {children}
  </motion.button>
);

const STEPS = ['Role', 'Experience', 'Company', 'Interview Type', 'Details'];

const InterviewSetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  // Sprint 5 Commit 2: the Interview Hub passes { initialConfig } via
  // router state to preselect fields (e.g. useResume=true for the
  // Resume-Based card). Absent state = default behavior — zero regression
  // for every existing call site (retry, direct nav, coach actions).
  const [config, setConfig] = useState(() => {
    const defaults = {
      role: '', experienceLevel: '', companyType: 'any', targetCompany: '',
      interviewType: 'mixed', difficulty: 'medium', totalQuestions: 5,
      jobDescription: '', useResume: false,
      lengthIntent: 'auto',     // 'auto' | 'breadth' | 'depth'
      pressure: 'standard',     // 'relaxed' | 'standard' | 'intense' — interview pressure level
      personalityId: '',        // '' = auto-derive from company/role; otherwise explicit pick
      round: 'general',         // interview round type — drives focus / type mix / persona hint
    };
    return { ...defaults, ...(location.state?.initialConfig || {}) };
  });
  const [customCompany, setCustomCompany] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Load available interviewer personalities + round profiles for pickers
  const [personalities, setPersonalities] = useState([]);
  const [rounds, setRounds] = useState([]);
  useEffect(() => {
    interviewAPI.getPersonalities()
      .then(res => setPersonalities(res.personalities || []))
      .catch(() => {});
    interviewAPI.getRounds()
      .then(res => setRounds(res.rounds || []))
      .catch(() => {});
  }, []);

  const update = (key, val) => setConfig(p => ({ ...p, [key]: val }));

  const canNext = () => {
    if (step === 0) return !!config.role;
    if (step === 1) return !!config.experienceLevel;
    if (step === 2) return true;
    if (step === 3) return !!config.interviewType;
    return true;
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await interviewAPI.create(config);
      // Forward the personalized greeting via router state so InterviewPage can speak it
      navigate(`/interview/${res.interview.id}`, { state: { greeting: res.greeting || '' } });
    } catch (err) {
      toast.error(err.message || 'Failed to start interview');
    } finally {
      setLoading(false);
    }
  };

  const stepContent = [
    // Step 0: Role
    <div key={0}>
      <h2 className="text-xl font-semibold mb-2">Choose your target role</h2>
      <p className="text-white/50 text-sm mb-6">AI will generate questions specific to this role</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ROLES.map(r => (
          <OptionCard key={r.value} selected={config.role === r.value} onClick={() => update('role', r.value)}>
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center mb-3`}>
              <r.icon size={18} className="text-white" />
            </div>
            <p className="font-medium text-sm">{r.label}</p>
          </OptionCard>
        ))}
      </div>
    </div>,

    // Step 1: Experience
    <div key={1}>
      <h2 className="text-xl font-semibold mb-2">Your experience level</h2>
      <p className="text-white/50 text-sm mb-6">Determines question difficulty and depth</p>
      <div className="space-y-3">
        {EXPERIENCE.map(e => (
          <OptionCard key={e.value} selected={config.experienceLevel === e.value} onClick={() => update('experienceLevel', e.value)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{e.label}</p>
                <p className="text-white/40 text-sm mt-0.5">{e.desc}</p>
              </div>
              {config.experienceLevel === e.value && (
                <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </OptionCard>
        ))}
      </div>
    </div>,

    // Step 2: Company
    <div key={2}>
      <h2 className="text-xl font-semibold mb-2">Target company type</h2>
      <p className="text-white/50 text-sm mb-6">Questions are tailored to company culture</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {COMPANY_TYPES.map(c => (
          <OptionCard key={c.value} selected={config.companyType === c.value} onClick={() => update('companyType', c.value)}>
            <p className="font-medium text-sm">{c.label}</p>
            <p className="text-white/40 text-xs mt-1">{c.desc}</p>
          </OptionCard>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">Specific Company (Optional)</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COMPANIES.map(c => (
            <button key={c} type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                config.targetCompany === c ? 'border-primary-500 bg-primary-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
              onClick={() => {
                update('targetCompany', config.targetCompany === c ? '' : c);
                setShowCustomInput(false);
                setCustomCompany('');
              }}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              showCustomInput ? 'border-primary-500 bg-primary-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/20'
            }`}
            onClick={() => {
              setShowCustomInput(v => !v);
              if (showCustomInput) { setCustomCompany(''); update('targetCompany', ''); }
              else update('targetCompany', customCompany || '');
            }}
          >
            + Other
          </button>
        </div>
        {showCustomInput && (
          <input
            type="text"
            className="input-field text-sm w-full max-w-xs"
            placeholder="Enter company name…"
            value={customCompany}
            onChange={e => { setCustomCompany(e.target.value); update('targetCompany', e.target.value); }}
            autoFocus
          />
        )}
      </div>
    </div>,

    // Step 3: Interview Type
    <div key={3}>
      <h2 className="text-xl font-semibold mb-2">Interview type</h2>
      <p className="text-white/50 text-sm mb-6">Select what kind of questions to practice</p>
      <div className="space-y-3">
        {INTERVIEW_TYPES.map(t => (
          <OptionCard key={t.value} selected={config.interviewType === t.value} onClick={() => update('interviewType', t.value)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-white/40 text-sm">{t.desc}</p>
              </div>
              {config.interviewType === t.value && (
                <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </OptionCard>
        ))}
      </div>
    </div>,

    // Step 4: Details
    <div key={4}>
      <h2 className="text-xl font-semibold mb-2">Fine-tune your session</h2>
      <p className="text-white/50 text-sm mb-6">Customize question count, difficulty, and context</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">
            Number of Questions: <span className="text-primary-400 font-bold">{config.totalQuestions}</span>
          </label>
          <input type="range" min="3" max="15" value={config.totalQuestions}
            onChange={e => update('totalQuestions', parseInt(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>3 (Quick)</span><span>15 (Comprehensive)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Difficulty Level</label>
          <div className="flex gap-3">
            {DIFFICULTIES.map(d => (
              <button key={d.value} type="button"
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  config.difficulty === d.value
                    ? `border-current bg-white/5 ${d.color}` : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
                onClick={() => update('difficulty', d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/30 mt-2">
            Difficulty adapts during the interview based on your performance.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Interview Style</label>
          <div className="flex gap-3">
            {[
              { value: 'auto',    label: 'Auto',    desc: 'Adapts to question count' },
              { value: 'breadth', label: 'Breadth', desc: 'More topics, lighter probing' },
              { value: 'depth',   label: 'Depth',   desc: 'Fewer topics, deeper follow-ups' },
            ].map(opt => (
              <button key={opt.value} type="button"
                className={`flex-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                  config.lengthIntent === opt.value
                    ? 'border-primary-500 bg-primary-600/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
                onClick={() => update('lengthIntent', opt.value)}
              >
                <div className="text-sm">{opt.label}</div>
                <div className="text-white/40 mt-0.5 leading-tight">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {rounds.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Interview Round
              <span className="text-white/40 text-xs ml-2">(shapes focus + question style)</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {rounds.map(r => (
                <button key={r.id} type="button"
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left ${
                    config.round === r.id
                      ? 'border-primary-500 bg-primary-600/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                  onClick={() => update('round', r.id)}
                >
                  <div className="text-sm">{r.label}</div>
                  <div className="text-white/40 mt-0.5 leading-tight truncate" title={r.focus}>{r.focus}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Pressure Level</label>
          <div className="flex gap-3">
            {[
              { value: 'relaxed',  label: 'Relaxed',  desc: 'Supportive, patient interviewer' },
              { value: 'standard', label: 'Standard', desc: 'Balanced, realistic pacing' },
              { value: 'intense',  label: 'Intense',  desc: 'Direct, fast, tougher probing' },
            ].map(opt => (
              <button key={opt.value} type="button"
                className={`flex-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                  config.pressure === opt.value
                    ? 'border-primary-500 bg-primary-600/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
                onClick={() => update('pressure', opt.value)}
              >
                <div className="text-sm">{opt.label}</div>
                <div className="text-white/40 mt-0.5 leading-tight">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {personalities.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Interviewer Personality
              <span className="text-white/40 text-xs ml-2">(optional — auto-picked if left blank)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left ${
                  config.personalityId === ''
                    ? 'border-primary-500 bg-primary-600/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
                onClick={() => update('personalityId', '')}
              >
                <div className="text-sm">Auto</div>
                <div className="text-white/40 mt-0.5 leading-tight">Based on company &amp; role</div>
              </button>
              {personalities.map(p => (
                <button key={p.id} type="button"
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left ${
                    config.personalityId === p.id
                      ? 'border-primary-500 bg-primary-600/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                  onClick={() => update('personalityId', p.id)}
                >
                  <div className="text-sm">{p.label}</div>
                  <div className="text-white/40 mt-0.5 leading-tight truncate">{p.style}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Job Description (Optional)</label>
          <textarea
            className="input-field resize-none h-24 text-sm"
            placeholder="Paste job description for more targeted questions..."
            value={config.jobDescription}
            onChange={e => update('jobDescription', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-white/3 rounded-xl border border-white/10">
          <input type="checkbox" id="useResume" checked={config.useResume}
            onChange={e => update('useResume', e.target.checked)}
            className="w-4 h-4 accent-primary-500"
          />
          <label htmlFor="useResume" className="cursor-pointer">
            <p className="text-sm font-medium">Use my resume for personalized questions</p>
            <p className="text-white/40 text-xs">AI will ask about your specific projects and experience</p>
          </label>
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/50">Step {step + 1} of {STEPS.length}</span>
            <span className="text-sm text-white/50">{STEPS[step]}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-xs ${i <= step ? 'text-primary-400' : 'text-white/20'}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="glass rounded-3xl p-8 min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="flex-1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <motion.button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
                whileHover={{ scale: canNext() ? 1.01 : 1 }}
                whileTap={{ scale: canNext() ? 0.99 : 1 }}
              >
                Next <ChevronRight size={16} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={handleStart}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? (
                  <>
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Generating questions...
                  </>
                ) : (
                  <><Play size={18} /> Start Interview</>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Config summary */}
        {config.role && (
          <motion.div
            className="mt-4 glass rounded-2xl p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-xs text-white/40 mb-2 font-medium">YOUR SETUP</p>
            <div className="flex flex-wrap gap-2">
              {config.role && <span className="badge bg-primary-500/20 text-primary-400">{config.role.replace(/_/g, ' ')}</span>}
              {config.experienceLevel && <span className="badge bg-accent-600/20 text-accent-400">{config.experienceLevel.replace(/_/g, ' ')}</span>}
              {config.interviewType && <span className="badge bg-green-500/20 text-green-400">{config.interviewType}</span>}
              {config.difficulty && <span className="badge bg-yellow-500/20 text-yellow-400">{config.difficulty}</span>}
              {config.targetCompany && <span className="badge bg-pink-500/20 text-pink-400">{config.targetCompany}</span>}
              <span className="badge bg-white/10 text-white/50">{config.totalQuestions} questions</span>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default InterviewSetupPage;
