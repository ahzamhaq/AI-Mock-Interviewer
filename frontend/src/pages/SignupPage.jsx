import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mic, Mail, Lock, User, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1117' }}>
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: '#238636' }}>
            <Mic size={18} style={{ color: '#fff' }} />
          </div>
          <span className="text-xl font-semibold" style={{ color: '#F0F6FC' }}>InterviewAI</span>
        </Link>

        <div className="surface p-8">
          <h1 className="text-xl font-semibold mb-1" style={{ color: '#F0F6FC' }}>Create your account</h1>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Start practicing interviews with AI — free forever</p>

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
            <div className="flex-1 h-px" style={{ background: '#30363D' }} />
            <span className="text-xs" style={{ color: '#484F58' }}>or sign up with email</span>
            <div className="flex-1 h-px" style={{ background: '#30363D' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#484F58' }} />
                  <input type="text" placeholder="Aarav Sharma" className="input-field" style={{ paddingLeft: 36 }}
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#484F58' }} />
                  <input type="email" placeholder="you@example.com" className="input-field" style={{ paddingLeft: 36 }}
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#484F58' }} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters"
                    className="input-field" style={{ paddingLeft: 36, paddingRight: 40 }}
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#484F58', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                    onMouseLeave={e => e.currentTarget.style.color = '#484F58'}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>Target Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} type="button"
                      className="px-3 py-2 rounded-md text-xs font-medium border transition-all"
                      style={form.targetRole === r.value
                        ? { background: '#1F6FEB', borderColor: '#1F6FEB', color: '#fff' }
                        : { background: '#0D1117', borderColor: '#30363D', color: '#9CA3AF' }}
                      onClick={() => setForm(p => ({ ...p, targetRole: r.value }))}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>Experience Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE.map(e => (
                    <button key={e.value} type="button"
                      className="px-3 py-2 rounded-md text-xs font-medium border transition-all"
                      style={form.experience === e.value
                        ? { background: '#238636', borderColor: '#238636', color: '#fff' }
                        : { background: '#0D1117', borderColor: '#30363D', color: '#9CA3AF' }}
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

          <p className="text-center text-xs mt-5" style={{ color: '#6B7280' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              className="transition-colors"
              style={{ color: '#58A6FF' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7CBDFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#58A6FF')}
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
