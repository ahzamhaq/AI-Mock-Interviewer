import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Mic, TrendingUp, ToggleLeft, ToggleRight, Search, Shield } from 'lucide-react';
import { adminAPI } from '../services/api';
import Navbar from '../components/layout/Navbar';
import toast from 'react-hot-toast';

const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    adminAPI.getStats().then(r => setStats(r.stats)).catch(() => {});
    adminAPI.getUsers({ page: 1, limit: 20 }).then(r => setUsers(r.users)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const res = await adminAPI.getUsers({ search, limit: 20 });
    setUsers(res.users);
  };

  const toggleUser = async (id) => {
    try {
      await adminAPI.toggleUser(id);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !u.isActive } : u));
      toast.success('User status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        <motion.div className="mb-8 flex items-center gap-3"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Shield size={32} className="text-primary-400" />
          <div>
            <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
            <p className="text-white/50">Platform management</p>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Interviews', value: stats.totalInterviews, icon: Mic, color: 'text-primary-400' },
              { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-green-400' },
              { label: 'Avg Score', value: `${stats.avgScore}/10`, icon: TrendingUp, color: 'text-yellow-400' },
            ].map((s, i) => (
              <motion.div key={s.label} className="glass rounded-2xl p-5"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <s.icon size={20} className={`${s.color} mb-3`} />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-white/50 text-sm">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold">User Management</h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input className="input-field pl-9 py-2 text-sm w-64" placeholder="Search users..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button type="submit" className="btn-secondary py-2 px-4 text-sm">Search</button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/5">
                  <th className="text-left pb-3 font-medium">User</th>
                  <th className="text-left pb-3 font-medium">Role</th>
                  <th className="text-left pb-3 font-medium">Interviews</th>
                  <th className="text-left pb-3 font-medium">Avg Score</th>
                  <th className="text-left pb-3 font-medium">Status</th>
                  <th className="text-left pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-white/40 text-xs">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="badge bg-white/10 text-white/60 text-xs">{u.role}</span>
                    </td>
                    <td className="py-3 text-white/60">{u.totalInterviews}</td>
                    <td className="py-3 text-white/60">{u.averageScore?.toFixed(1) || '—'}/10</td>
                    <td className="py-3">
                      <span className={`badge text-xs ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3">
                      {u.role !== 'admin' && (
                        <button onClick={() => toggleUser(u._id)}
                          className="text-white/40 hover:text-white transition-colors">
                          {u.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
