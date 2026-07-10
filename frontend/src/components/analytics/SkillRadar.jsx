import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

/**
 * SkillRadar — 5-axis radar chart used on Profile (all-time) and Dashboard
 * (recent window). Data shape mirrors what analyticsAPI.getDetailed()
 * already returns in `analytics.radar` — an array of { axis, value, max }.
 *
 * The component is intentionally presentation-only: it does not fetch or
 * transform data. Parents pass the array in and the component renders it.
 *
 * Props:
 *   data   — [{ axis, value, max }]
 *   height — chart height in px (default 220)
 */
const SkillRadar = ({ data = [], height = 220 }) => {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center font-mono text-xs"
        style={{ height, color: '#484F58' }}
      >
        {'// no data — complete sessions to populate'}
      </div>
    );
  }

  // Normalize to a 0–10 scale for the axis. `max` on each point is honored
  // via the domain below; we assume all points share the same max (the
  // analytics endpoint always sends 10).
  const domainMax = Math.max(10, ...data.map((d) => d.max || 10));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="#21262D" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
        />
        <PolarRadiusAxis
          domain={[0, domainMax]}
          tick={{ fill: '#484F58', fontSize: 9, fontFamily: 'monospace' }}
          angle={90}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            background: '#1C2128',
            border: '1px solid #30363D',
            borderRadius: 6,
            fontSize: 12,
          }}
          itemStyle={{ color: '#58A6FF' }}
          labelStyle={{ color: '#9CA3AF' }}
          formatter={(v) => [`${Number(v).toFixed(1)} / ${domainMax}`, 'score']}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#58A6FF"
          fill="#58A6FF"
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default SkillRadar;
