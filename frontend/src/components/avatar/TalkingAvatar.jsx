// Minimal procedural AI orb. No GLTF, no cartoon features.
// Reacts via amplitude + speaking/listening state through emissive intensity and scale.

import React, { Suspense, lazy } from 'react';

const Canvas = lazy(() =>
  import('@react-three/fiber').then(m => ({ default: m.Canvas }))
);

const AvatarScene = lazy(() => import('./AvatarScene'));

const TalkingAvatar = ({
  isSpeaking = false,
  isListening = false,
  amplitude = 0,
  className = '',
}) => {
  const stateLabel = isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle';
  const stateColor = isSpeaking ? '#58A6FF' : isListening ? '#F85149' : '#3FB950';

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Status pill — top */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono"
          style={{
            background: 'rgba(13,17,23,0.7)',
            border: `1px solid ${stateColor}40`,
            fontSize: 9,
            color: stateColor,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: stateColor, animation: isSpeaking || isListening ? 'pulse 1.2s infinite' : 'none' }}
          />
          {stateLabel}
        </div>
      </div>

      {/* Corner registration marks (subtle workspace feel) */}
      {[
        { top: 6, left: 6 },
        { top: 6, right: 6 },
        { bottom: 6, left: 6 },
        { bottom: 6, right: 6 },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute z-10"
          style={{
            ...pos,
            width: 8,
            height: 8,
            borderTop: i < 2 ? '1px solid #30363D' : 'none',
            borderBottom: i >= 2 ? '1px solid #30363D' : 'none',
            borderLeft: (i === 0 || i === 2) ? '1px solid #30363D' : 'none',
            borderRight: (i === 1 || i === 3) ? '1px solid #30363D' : 'none',
          }}
        />
      ))}

      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-14 h-14 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(31,111,235,0.3) 0%, transparent 70%)',
                border: '1px solid #30363D',
              }}
            />
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 40 }}
          style={{ background: 'transparent' }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <AvatarScene
            isSpeaking={isSpeaking}
            isListening={isListening}
            amplitude={amplitude}
          />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default TalkingAvatar;
