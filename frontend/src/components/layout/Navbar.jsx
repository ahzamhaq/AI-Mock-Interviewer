import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  Mic, User, LogOut, Menu, X, Shield, Play, ChevronDown, Activity, Circle
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [location]);

  // Hide nav entirely inside the interview room — it has its own toolbar
  const inSession = /^\/interview\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/results');
  if (inSession) return null;

  // `desktopClass` lets us hide low-priority links in the tablet range where
  // horizontal space is tight; mobile menu ignores it and shows every link.
  const navLinks = user ? [
    { to: '/dashboard',   label: 'Dashboard'  },
    { to: '/interviews',  label: 'Interviews' },
    { to: '/projects',    label: 'Projects'   },
    { to: '/analytics',   label: 'Analytics'  },
    { to: '/history',     label: 'History'    },
    { to: '/leaderboard', label: 'Leaderboard', desktopClass: 'hidden lg:inline-flex' },
  ] : [
    { to: '#features',     label: 'Features', isHash: true },
    { to: '#workflow',     label: 'Workflow',  isHash: true },
  ];

  const isActive = (to) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: '#0D1117',
        borderBottom: '1px solid #21262D',
        height: 48,
      }}
    >
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 h-full flex items-center justify-between gap-3">

        {/* Logo + workspace breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: '#238636' }}>
              <Mic size={11} style={{ color: '#fff' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#F0F6FC' }}>
              InterviewAI
            </span>
          </Link>

          {user && (
            <>
              <span className="hidden md:inline" style={{ color: '#30363D' }}>/</span>
              <span className="hidden md:inline font-mono text-2xs" style={{ color: '#6B7280' }}>
                {user?.name?.split(' ')[0]?.toLowerCase()}
              </span>
            </>
          )}
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-px flex-1 justify-center" style={{ background: 'transparent' }}>
          {navLinks.map(link => {
            const active = isActive(link.to);
            if (link.isHash) {
              return (
                <a
                  key={link.to}
                  href={link.to}
                  className="relative px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F0F6FC'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${link.desktopClass || ''}`}
                style={{ color: active ? '#F0F6FC' : '#9CA3AF' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#F0F6FC'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#9CA3AF'; }}
              >
                {link.label}
                {active && (
                  <motion.div
                    layoutId="navUnderline"
                    className="absolute left-2 right-2"
                    style={{ bottom: -1, height: 2, background: '#58A6FF', borderRadius: '2px 2px 0 0' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {user ? (
            <>
              {/* System status indicator */}
              <div
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded font-mono text-2xs"
                style={{ background: '#161B22', border: '1px solid #30363D' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3FB950' }} />
                <span style={{ color: '#9CA3AF' }}>AI ready</span>
              </div>

              <button
                onClick={() => navigate('/interview/setup')}
                className="btn-accent flex items-center gap-1.5 px-2.5 py-1 text-xs"
                style={{ height: 28 }}
              >
                <Play size={11} /> <span className="hidden sm:inline">New session</span>
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
                  style={{
                    height: 28,
                    border: '1px solid #30363D',
                    background: profileOpen ? '#1C2128' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = '#161B22'; }}
                  onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center font-bold"
                    style={{ background: '#1F6FEB', color: '#fff', fontSize: 9 }}
                  >
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <ChevronDown size={10} style={{ color: '#6B7280' }} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 top-full mt-1"
                      style={{
                        width: 220,
                        background: '#1C2128',
                        border: '1px solid #30363D',
                        borderRadius: 6,
                        boxShadow: '0 8px 24px rgba(1,4,9,0.8)',
                        zIndex: 60,
                      }}
                    >
                      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #30363D' }}>
                        <p className="text-sm font-medium" style={{ color: '#F0F6FC' }}>{user.name}</p>
                        <p className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>{user.email}</p>
                      </div>
                      <div className="p-1">
                        {[
                          { to: '/profile', label: 'Profile', icon: User },
                          ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
                        ].map(item => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors"
                            style={{ color: '#9CA3AF' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#21262D'; e.currentTarget.style.color = '#F0F6FC'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                          >
                            <item.icon size={12} />
                            {item.label}
                          </Link>
                        ))}
                        <div style={{ height: 1, background: '#30363D', margin: '4px 0' }} />
                        <button
                          onClick={() => { logout(); navigate('/'); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors"
                          style={{ color: '#F85149', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <LogOut size={12} /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-xs px-2.5 py-1.5 transition-colors"
                style={{ color: '#9CA3AF' }}>
                Sign in
              </Link>
              <Link to="/signup" className="btn-accent text-xs px-3 py-1.5">
                Get started
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1.5 rounded transition-colors"
            style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#161B22'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ background: '#0D1117', borderBottom: '1px solid #21262D', overflow: 'hidden' }}
          >
            <div className="px-3 py-2 space-y-px">
              {navLinks.map(link => link.isHash ? (
                <a
                  key={link.to}
                  href={link.to}
                  className="flex items-center px-3 py-2 rounded text-xs transition-colors"
                  style={{ color: '#9CA3AF', background: 'transparent' }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center px-3 py-2 rounded text-xs transition-colors"
                  style={{ color: isActive(link.to) ? '#F0F6FC' : '#9CA3AF', background: isActive(link.to) ? '#161B22' : 'transparent' }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {profileOpen && (
        <div className="fixed inset-0" style={{ zIndex: 55 }} onClick={() => setProfileOpen(false)} />
      )}
    </nav>
  );
};

export default Navbar;
