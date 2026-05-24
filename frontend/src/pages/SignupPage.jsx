import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mic, Mail, Lock, User, ArrowRight, Briefcase } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'sde', label: 'SDE' },
  { value: 'frontend_developer', label: 'Frontend Dev' },
  { value: 'backend_developer', label: 'Backend Dev' },
  { value: 'fullstack_developer', label: 'Full Stack' },
  { value: 'data_analyst', label: 'Data Analyst' },
  { value: 'hr', label: 'HR' },
];

const EXPERIENCE = [
  { value: 'fresher', label: 'Fresher' },
  { value: '1-2_years', label: '1–2 Years' },
  { value: '3+_years', label: '3+ Years' },
];

const SignupPage = () => {
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await googleLogin(credentialResponse.credential);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Google signup failed');
    }
  };
  const [form, setForm] = useState({ name: '', email: '', password: '', targetRole: 'sde', experience: 'fresher' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-glow-sm">
            <Mic size={18} />
          </div>
          <span className="font-display font-bold text-xl">Interview<span className="text-primary-400">AI</span></span>
        </Link>

        <div className="glass rounded-3xl p-8">
          <h1 className="text-2xl font-display font-bold mb-1">Create your account</h1>
          <p className="text-white/50 text-sm mb-6">Start practicing interviews with AI — free forever</p>

          {/* Google Signup */}
          <div className="mb-5 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google signup failed')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              text="signup_with"
              width="100%"
            />
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs font-medium">or sign up with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type="text" placeholder="Aarav Sharma" className="input-field pl-10"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type="email" placeholder="you@example.com" className="input-field pl-10"
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters"
                    className="input-field pl-10 pr-12"
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Target Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} type="button"
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        form.targetRole === r.value
                          ? 'bg-primary-600 border-primary-500 text-white shadow-glow-sm'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                      onClick={() => setForm(p => ({ ...p, targetRole: r.value }))}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Experience Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE.map(e => (
                    <button key={e.value} type="button"
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        form.experience === e.value
                          ? 'bg-accent-600 border-accent-500 text-white'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                      onClick={() => setForm(p => ({ ...p, experience: e.value }))}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <motion.button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 mt-2"
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
            >
              {loading ? (
                <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>Create Free Account <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
