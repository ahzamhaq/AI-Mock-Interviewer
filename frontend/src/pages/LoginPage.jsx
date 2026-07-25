import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mic, Mail, Lock, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await googleLogin(credentialResponse.credential);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Google login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#0D1117' }}>
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#238636' }}>
            <Mic size={13} style={{ color: '#fff' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>InterviewAI</span>
        </Link>

        <h1 className="text-xl font-semibold mb-1" style={{ color: '#F0F6FC' }}>Sign in</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Continue your interview preparation
        </p>

        {/* Google OAuth */}
        <div className="mb-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error('Google login failed. Make sure localhost:5173 is in your Google OAuth authorized origins.')}
            theme="filled_black"
            shape="rectangular"
            size="large"
            text="signin_with"
            width="368"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: '#30363D' }} />
          <span className="text-xs" style={{ color: '#484F58' }}>or</span>
          <div className="flex-1 h-px" style={{ background: '#30363D' }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>
              Email address
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#484F58' }} />
              <input
                type="email"
                placeholder="you@example.com"
                className="input-field"
                style={{ paddingLeft: 36 }}
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9CA3AF' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#484F58' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="input-field"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#484F58', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
                onMouseLeave={e => e.currentTarget.style.color = '#484F58'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-colors"
            style={{
              background: loading ? '#238636aa' : '#238636',
              color: '#fff',
              border: '1px solid rgba(240,246,252,0.1)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2EA043'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#238636'; }}
          >
            {loading ? (
              <motion.div
                className="w-4 h-4 rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <>Sign in <ArrowRight size={14} /></>
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div
          className="mt-4 px-3 py-2.5 rounded text-xs"
          style={{ background: '#161B22', border: '1px solid #30363D' }}
        >
          <div>
            <span style={{ color: '#6B7280' }}>Demo: </span>
            <button
              className="transition-colors"
              style={{ color: '#58A6FF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
              onClick={() => setForm({ email: 'demo@interviewai.com', password: 'demo1234' })}
              onMouseEnter={e => e.currentTarget.style.color = '#7CBDFF'}
              onMouseLeave={e => e.currentTarget.style.color = '#58A6FF'}
            >
              demo@interviewai.com / demo1234
            </button>
          </div>
          {/* Shared-account disclosure — see backend/middleware/demoGuard.js.
              GitHub connect, private-repo import, and preset save are
              blocked server-side on this account; sessions and configs are
              periodically reset by the nightly cleanup job. */}
          <div
            className="font-mono mt-1.5"
            style={{ color: '#484F58', fontSize: 10, lineHeight: 1.5 }}
          >
            Shared account · GitHub connect and preset save are disabled ·
            data resets nightly
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#6B7280' }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="transition-colors"
            style={{ color: '#58A6FF' }}
            onMouseEnter={e => e.currentTarget.style.color = '#7CBDFF'}
            onMouseLeave={e => e.currentTarget.style.color = '#58A6FF'}
          >
            Create one free
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
