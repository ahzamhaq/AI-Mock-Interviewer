import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Mic, Activity, Target, Volume2,
  Flame, AlertTriangle, Calendar, Clock, Filter
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ReferenceLine
} from 'recharts';
import { analyticsAPI } from '../services/api';
import Navbar from '../components/layout/Navbar';
import { format } from 'date-fns';

// ── Atoms ────────────────────────────────────────────────────────────────────

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6B7280';
  if (s >= 8) return '#3FB950';
  if (s >= 6) return '#D29922';
  return '#F85149';
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded font-mono text-2xs px-2.5 py-1.5"
      style={{ background: '#1C2128', border: '1px solid #30363D' }}>
      <div style={{ color: '#6B7280' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#58A6FF' }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PanelHeader = ({ icon: Icon, label, hint, action }) => (
  <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
    style={{ borderBottom: '1px solid #21262D', background: '#161B22' }}>
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={11} style={{ color: '#6B7280' }} />}
      <span className="font-mono text-2xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{label}</span>
      {hint && <span className="font-mono text-2xs" style={{ color: '#484F58' }}>· {hint}</span>}
    </div>
    {action}
  </div>
);

const Panel = ({ children, className = '' }) => (
  <div className={`flex flex-col overflow-hidden ${className}`}
    style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 6 }}>
    {children}
  </div>
);

const Metric = ({ label, value, sub, color = '#F0F6FC', delta }) => (
  <div className="px-3 py-2.5" style={{ background: '#0D1117' }}>
    <div className="font-mono text-2xs uppercase tracking-wide mb-1" style={{ color: '#484F58' }}>
      {label}
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>{sub}</span>}
      {delta != null && (
        <span className="font-mono text-2xs ml-auto"
          style={{ color: delta >= 0 ? '#3FB950' : '#F85149' }}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
        </span>
      )}
    </div>
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    analyticsAPI.getDetailed(period)
      .then(res => setData(res.analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const scoreProgression = data?.scoreProgression?.map(s => ({
    date: format(new Date(s.date), 'dd MMM'),
    Overall: s.overall,
    Technical: s.technical,
    Communication: s.communication,
  })) || [];

  const typeData = data?.typeAverages?.map(t => ({
    type: t.type?.replace('_', ' ') || 'other',
    avg: t.avgScore,
    count: t.count,
  })) || [];

  const fillerData = Object.entries(data?.fillerWordStats?.words || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  const weeklyData = data?.weeklyConsistency?.map(w => ({
    week: format(new Date(w.week + 'T00:00:00'), 'dd MMM'),
    Count: w.count,
    Score: w.avgScore,
  })) || [];

  const radarData = data?.radar?.length
    ? data.radar
    : [
        { subject: 'Technical',     A: (data?.averageScore || 0) * 10 },
        { subject: 'Communication', A: 72 },
        { subject: 'Confidence',    A: 68 },
        { subject: 'Clarity',       A: 70 },
        { subject: 'Grammar',       A: 80 },
      ];

  const weakTopics = data?.weakTopics || data?.topicHeatmap || [];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#0D1117' }}>
        <Navbar />
        <div className="flex items-center justify-center pt-40 gap-3">
          <motion.div
            className="w-6 h-6 rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#30363D', borderTopColor: '#58A6FF' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          />
          <span className="font-mono text-xs" style={{ color: '#6B7280' }}>Loading diagnostics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        {/* Sub-toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8"
          style={{ height: 40, borderBottom: '1px solid #21262D', background: '#161B22' }}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xs" style={{ color: '#484F58' }}>~/analytics</span>
            <span style={{ color: '#30363D' }}>/</span>
            <span className="text-sm font-medium" style={{ color: '#F0F6FC' }}>diagnostics</span>
            <span className="font-mono text-2xs" style={{ color: '#6B7280' }}>
              · window {period}d
            </span>
          </div>
          <div className="flex items-center gap-1 rounded p-0.5"
            style={{ background: '#0D1117', border: '1px solid #30363D' }}>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className="font-mono text-2xs px-2.5 py-1 rounded transition-colors"
                style={{
                  background: period === d ? '#1F6FEB' : 'transparent',
                  color: period === d ? '#fff' : '#9CA3AF',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-3">

          {/* Top metric strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px overflow-hidden"
            style={{ background: '#21262D', border: '1px solid #30363D', borderRadius: 6 }}>
            <Metric label="sessions"      value={data?.totalInterviews || 0} sub="completed" />
            <Metric label="avg score"     value={(data?.averageScore || 0).toFixed(1)} sub="/10"
              color={SCORE_COLOR(data?.averageScore)} />
            <Metric label="filler words"  value={data?.fillerWordStats?.total || 0} sub="total"
              color={(data?.fillerWordStats?.total || 0) > 30 ? '#F85149' : '#D29922'} />
            <Metric label="q types"        value={data?.typeAverages?.length || 0} sub="covered" />
            <Metric label="weak topics"   value={weakTopics.length || 0} sub="flagged"
              color={weakTopics.length > 3 ? '#F85149' : '#D29922'} />
          </div>

          {/* Row 1: progression + radar */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">

            {/* Score progression */}
            <Panel>
              <PanelHeader icon={TrendingUp} label="score progression" hint="overall · technical · communication" />
              <div className="p-3">
                {scoreProgression.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={scoreProgression} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#21262D" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} cursor={{ stroke: '#30363D', strokeDasharray: '2 2' }} />
                      <ReferenceLine y={7} stroke="#30363D" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="Overall"        stroke="#58A6FF" strokeWidth={1.5} dot={{ r: 2.5, fill: '#58A6FF', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Technical"      stroke="#3FB950" strokeWidth={1.2} dot={{ r: 2, fill: '#3FB950', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Communication"  stroke="#D29922" strokeWidth={1.2} dot={{ r: 2, fill: '#D29922', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                    // no progression data
                  </div>
                )}
                <div className="flex items-center gap-4 mt-2 font-mono text-2xs">
                  <Legend dot="#58A6FF" label="Overall" />
                  <Legend dot="#3FB950" label="Technical" />
                  <Legend dot="#D29922" label="Communication" />
                </div>
              </div>
            </Panel>

            {/* Skill radar */}
            <Panel>
              <PanelHeader icon={Target} label="skill radar" />
              <div className="p-3">
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData} margin={{ top: 8, right: 18, bottom: 0, left: 18 }}>
                    <PolarGrid stroke="#21262D" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                    <Radar dataKey="A" stroke="#58A6FF" fill="#58A6FF" fillOpacity={0.12} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Row 2: question types + filler words + consistency */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Question types */}
            <Panel>
              <PanelHeader icon={BarChart3} label="by question type" hint="average score" />
              <div className="p-3">
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#21262D" vertical={false} />
                      <XAxis dataKey="type" tick={{ fill: '#484F58', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#484F58', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} cursor={{ fill: 'rgba(88,166,255,0.04)' }} />
                      <Bar dataKey="avg" fill="#58A6FF" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                    // no data
                  </div>
                )}
              </div>
            </Panel>

            {/* Filler words */}
            <Panel>
              <PanelHeader icon={Volume2} label="filler word frequency" hint={`total ${data?.fillerWordStats?.total || 0}`} />
              <div className="p-3 space-y-1.5">
                {fillerData.length > 0 ? fillerData.map(({ word, count }) => {
                  const max = Math.max(...fillerData.map(f => f.count));
                  const pct = (count / max) * 100;
                  return (
                    <div key={word} className="flex items-center gap-2">
                      <span className="font-mono text-xs w-16 truncate" style={{ color: '#9CA3AF' }}>"{word}"</span>
                      <div className="flex-1 h-1.5 rounded" style={{ background: '#21262D' }}>
                        <div className="h-full rounded" style={{ width: `${pct}%`, background: '#D29922' }} />
                      </div>
                      <span className="font-mono text-2xs w-8 text-right" style={{ color: '#9CA3AF' }}>{count}</span>
                    </div>
                  );
                }) : (
                  <div className="h-[180px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                    // none detected
                  </div>
                )}
              </div>
            </Panel>

            {/* Weekly consistency */}
            <Panel>
              <PanelHeader icon={Calendar} label="weekly consistency" />
              <div className="p-3">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="consFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3FB950" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3FB950" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="#21262D" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: '#484F58', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#484F58', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} cursor={{ stroke: '#30363D', strokeDasharray: '2 2' }} />
                      <Area type="monotone" dataKey="Count" stroke="#3FB950" strokeWidth={1.5} fill="url(#consFill)" dot={{ r: 2.5, fill: '#3FB950', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                    // no sessions
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Row 3: weak topic heatmap */}
          <Panel>
            <PanelHeader icon={AlertTriangle} label="topic heatmap" hint="lowest-scoring areas" />
            <div className="p-3">
              {weakTopics.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px"
                  style={{ background: '#21262D' }}>
                  {weakTopics.slice(0, 9).map((t, i) => {
                    const score = t.avgScore || 0;
                    return (
                      <div key={i} className="p-3" style={{ background: '#0D1117' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium truncate" style={{ color: '#F0F6FC' }}>{t.topic}</span>
                          <span className="font-mono text-xs font-bold" style={{ color: SCORE_COLOR(score) }}>
                            {score.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-1 rounded" style={{ background: '#21262D' }}>
                          <div
                            className="h-full rounded"
                            style={{ width: `${(score / 10) * 100}%`, background: SCORE_COLOR(score) }}
                          />
                        </div>
                        <div className="font-mono text-2xs mt-1.5" style={{ color: '#484F58' }}>
                          {t.attempts || t.count || 0} attempts · last {t.lastAsked ? format(new Date(t.lastAsked), 'dd MMM') : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
                  // no weak topics tracked yet
                </div>
              )}
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
};

const Legend = ({ dot, label }) => (
  <span className="flex items-center gap-1.5">
    <span className="w-2 h-0.5 rounded-sm" style={{ background: dot }} />
    <span style={{ color: '#6B7280' }}>{label}</span>
  </span>
);

export default AnalyticsPage;
