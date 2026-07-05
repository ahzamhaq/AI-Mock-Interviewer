import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, AreaChart, Area,
} from 'recharts';
import { format } from 'date-fns';
import { Panel, PanelHeader } from '../common/Panel';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded px-2.5 py-1.5 font-mono text-2xs"
      style={{ background: '#1C2128', border: '1px solid #30363D' }}
    >
      <div style={{ color: '#6B7280' }}>{label}</div>
      <div className="font-bold" style={{ color: '#58A6FF' }}>{payload[0].value}/10</div>
    </div>
  );
};

/**
 * AnalyticsPreview — score trend chart extracted from DashboardPage. Reads
 * the raw scoreHistory prop and formats dates for the axis. Behavior and
 * visual output match the original.
 */
const AnalyticsPreview = ({ scoreHistory }) => {
  const data = (scoreHistory || []).slice(-14).map((s) => ({
    date: format(new Date(s.date), 'dd MMM'),
    Score: s.overall,
  }));

  return (
    <Panel className="flex-1">
      <PanelHeader
        icon={TrendingUp}
        label="score trend · last 14"
        action={
          <Link to="/analytics" className="font-mono text-2xs flex items-center gap-1" style={{ color: '#58A6FF' }}>
            analytics <ArrowUpRight size={9} />
          </Link>
        }
      />
      <div className="p-3 flex-1 min-h-[200px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#58A6FF" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#58A6FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#21262D" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: '#484F58', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#30363D', strokeDasharray: '2 2' }} />
              <ReferenceLine y={7} stroke="#30363D" strokeDasharray="3 3" label={{ value: 'target', fill: '#484F58', fontSize: 9, position: 'right' }} />
              <Area type="monotone" dataKey="Score" stroke="#58A6FF" strokeWidth={1.5} fill="url(#scoreFill)" dot={{ fill: '#58A6FF', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, fill: '#7CBDFF' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center font-mono text-xs" style={{ color: '#484F58' }}>
            {'// no data — complete sessions to populate'}
          </div>
        )}
      </div>
    </Panel>
  );
};

export default AnalyticsPreview;
