import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  User, Briefcase, Upload, Save, Lock, CheckCircle, Star,
  Flame, Trophy, Target, Eye, EyeOff
} from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import GitHubConnectionCard from '../components/settings/GitHubConnectionCard';
import ProgressTab from '../components/profile/ProgressTab';
import AchievementsTab from '../components/profile/AchievementsTab';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'frontend_developer', label: 'Frontend Dev' },
  { value: 'backend_developer', label: 'Backend Dev' },
  { value: 'fullstack_developer', label: 'Full Stack' },
  { value: 'sde', label: 'SDE' },
  { value: 'data_analyst', label: 'Data Analyst' },
  { value: 'hr', label: 'HR' },
];
const EXPERIENCE = [
  { value: 'fresher', label: 'Fresher' },
  { value: '1-2_years', label: '1–2 Years' },
  { value: '3+_years', label: '3+ Years' },
];

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    targetRole: user?.targetRole || 'sde',
    targetCompany: user?.targetCompany || '',
    experience: user?.experience || 'fresher',
    showOnLeaderboard: user?.showOnLeaderboard ?? true,
  });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Default tab honors two query params:
  //   • ?github=… → jump to Connections (GitHub OAuth callback lands here)
  //   • ?tab=…    → explicit deep-link (used by badge-unlock toast to open
  //                 the Achievements tab). Falls through to 'profile'.
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'profile';
    const params = new URLSearchParams(window.location.search);
    if (params.has('github')) return 'connections';
    const requested = params.get('tab');
    const valid = ['profile', 'progress', 'achievements', 'security', 'resume', 'connections', 'privacy'];
    if (requested && valid.includes(requested)) return requested;
    return 'profile';
  })();
  const [tab, setTab] = useState(initialTab);

  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const res = await userAPI.uploadResume(fd);
      toast.success('Resume uploaded!');
      updateUser({ resumeUrl: res.resumeUrl });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] }, maxSize: 5 * 1024 * 1024, maxFiles: 1,
  });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userAPI.updateProfile(form);
      updateUser(res.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await userAPI.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      toast.success('Password changed!');
      setPasswords({ current: '', new: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { icon: Trophy, label: 'Avg Score', value: `${user?.averageScore?.toFixed(1) || '0'}/10` },
    { icon: Star, label: 'Best Score', value: `${user?.bestScore || 0}/10` },
    { icon: Flame, label: 'Streak', value: `${user?.streak || 0} days` },
    { icon: Target, label: 'Interviews', value: user?.totalInterviews || 0 },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        {/* Profile header */}
        <motion.div className="glass rounded-3xl p-8 mb-6 text-center"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-accent-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-glow-md">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h2 className="text-2xl font-display font-bold">{user?.name}</h2>
          <p className="text-white/50">{user?.email}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="badge bg-primary-500/20 text-primary-400">{user?.targetRole?.replace(/_/g, ' ')}</span>
            <span className="badge bg-accent-600/20 text-accent-400">{user?.experience?.replace(/_/g, ' ')}</span>
            <span className="badge bg-yellow-500/20 text-yellow-400">{user?.points || 0} pts</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
            {stats.map(s => (
              <div key={s.label}>
                <s.icon size={16} className="text-primary-400 mx-auto mb-1" />
                <p className="font-bold">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tabs — horizontal scroll below `sm` so 6 tabs stay readable on
            narrow screens instead of squashing to unreadable widths. */}
        <div className="flex gap-2 mb-6 glass rounded-2xl p-1 overflow-x-auto no-scrollbar">
          {['profile', 'progress', 'achievements', 'security', 'resume', 'connections', 'privacy'].map(t => (
            <button key={t}
              className={`flex-1 sm:flex-1 min-w-[90px] py-2.5 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap ${tab === t ? 'bg-primary-600 text-white' : 'text-white/50 hover:text-white'}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          {tab === 'profile' && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-6">Edit Profile</h3>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Full Name</label>
                  <div className="relative">
                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input className="input-field pl-10" value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Target Company</label>
                  <div className="relative">
                    <Briefcase size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input className="input-field pl-10" placeholder="e.g. Google, Amazon..."
                      value={form.targetCompany}
                      onChange={e => setForm(p => ({ ...p, targetCompany: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Target Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(r => (
                      <button key={r.value} type="button"
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${form.targetRole === r.value ? 'border-primary-500 bg-primary-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/20'}`}
                        onClick={() => setForm(p => ({ ...p, targetRole: r.value }))}
                      >{r.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Experience Level</label>
                  <div className="flex gap-2">
                    {EXPERIENCE.map(e => (
                      <button key={e.value} type="button"
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${form.experience === e.value ? 'border-accent-500 bg-accent-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/20'}`}
                        onClick={() => setForm(p => ({ ...p, experience: e.value }))}
                      >{e.label}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                  {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                </button>
              </form>
            </div>
          )}

          {tab === 'security' && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-6">Change Password</h3>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Current Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="password" className="input-field pl-10" value={passwords.current}
                      onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">New Password (min 6 chars)</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="password" className="input-field pl-10" value={passwords.new}
                      onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} required />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                  {saving ? 'Updating...' : <><CheckCircle size={16} /> Update Password</>}
                </button>
              </form>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="glass rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-1">Privacy Settings</h3>
                <p className="text-white/40 text-sm">Control what others can see about you.</p>
              </div>

              {/* Leaderboard toggle */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-white/10 bg-white/3">
                <div className="flex items-start gap-3">
                  {form.showOnLeaderboard
                    ? <Eye size={18} className="text-primary-400 flex-shrink-0 mt-0.5" />
                    : <EyeOff size={18} className="text-white/30 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-sm font-medium">
                      {form.showOnLeaderboard ? 'Visible on leaderboard' : 'Hidden from leaderboard'}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {form.showOnLeaderboard
                        ? 'Your name, score, and stats appear on the public leaderboard.'
                        : 'You are invisible on the leaderboard. Your own stats are unaffected.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, showOnLeaderboard: !p.showOnLeaderboard }))}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                  style={{
                    background: form.showOnLeaderboard ? '#1F6FEB' : '#30363D',
                  }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                    style={{ transform: form.showOnLeaderboard ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>

              <button
                type="button"
                disabled={privacySaving}
                onClick={async () => {
                  setPrivacySaving(true);
                  try {
                    const res = await userAPI.updateProfile({ showOnLeaderboard: form.showOnLeaderboard });
                    updateUser(res.user);
                    toast.success('Privacy settings saved');
                  } catch (err) {
                    toast.error(err.message);
                  } finally {
                    setPrivacySaving(false);
                  }
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {privacySaving ? 'Saving...' : <><Save size={16} /> Save Privacy Settings</>}
              </button>
            </div>
          )}

          {tab === 'progress' && <ProgressTab user={user} />}

          {tab === 'achievements' && <AchievementsTab user={user} />}

          {tab === 'connections' && <GitHubConnectionCard />}

          {tab === 'resume' && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Resume Upload</h3>
              <p className="text-white/50 text-sm mb-6">Upload your resume to get personalized interview questions based on your experience.</p>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-primary-500 bg-primary-500/10' : 'border-white/20 hover:border-white/40'}`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <motion.div className="w-10 h-10 rounded-full border-4 border-primary-600/30 border-t-primary-500 mx-auto"
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    <Upload size={32} className="text-white/30 mx-auto mb-4" />
                    <p className="font-medium mb-1">Drop your resume here</p>
                    <p className="text-white/40 text-sm">PDF or TXT • Max 5MB</p>
                  </>
                )}
              </div>
              {user?.resumeUrl && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-sm text-green-400">Resume uploaded</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ProfilePage;
