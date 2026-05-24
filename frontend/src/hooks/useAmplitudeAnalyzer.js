// Microphone amplitude analyzer for avatar lip-sync and live visualization.
// Returns `amplitude` in [0, 1], updated every animation frame while active.

import { useEffect, useRef, useState, useCallback } from 'react';

export const useAmplitudeAnalyzer = () => {
  const [amplitude, setAmplitude] = useState(0);
  const [active, setActive] = useState(false);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const analyzerRef = useRef(null);
  const rafRef = useRef(0);

  const start = useCallback(async () => {
    if (active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.7;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const data = new Uint8Array(analyzer.frequencyBinCount);
      const tick = () => {
        analyzer.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setAmplitude(sum / data.length / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setActive(true);
    } catch (e) {
      // mic blocked — silently fail; amplitude stays 0
      console.warn('[amplitude] mic permission denied', e?.message);
    }
  }, [active]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try { ctxRef.current?.close(); } catch {}
    ctxRef.current = null;
    analyzerRef.current = null;
    setAmplitude(0);
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { amplitude, active, start, stop };
};
