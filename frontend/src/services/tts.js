// TTS client wrapper. Tries server-side TTS first (ElevenLabs via /api/tts);
// when the server signals `useBrowser: true` it falls back to the Web SpeechSynthesis API.

let currentAudio = null;
let _currentUtterance = null;

export const cancelTTS = () => {
  try { currentAudio?.pause(); } catch {}
  currentAudio = null;
  try { window.speechSynthesis?.cancel(); } catch {}
  _currentUtterance = null;
};

const speakBrowser = (text, { onStart, onEnd } = {}) => {
  cancelTTS();
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
    voices.find(v => v.lang.startsWith('en-US') && !v.name.includes('Microsoft')) ||
    voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => { _currentUtterance = null; onEnd?.(); };
  utterance.onerror = () => { _currentUtterance = null; onEnd?.(); };
  _currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
};

// Returns a cancel function.
export const speak = async (text, { onStart, onEnd, voice } = {}) => {
  if (!text) { onEnd?.(); return cancelTTS; }
  cancelTTS();

  // Try server TTS first
  try {
    const res = await fetch(
      (import.meta.env.VITE_API_URL || '/api') + '/tts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({ text, voice }),
      }
    );

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('audio')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onplay = () => onStart?.();
      audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; onEnd?.(); };
      audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; speakBrowser(text, { onStart, onEnd }); };
      audio.play().catch(() => speakBrowser(text, { onStart, onEnd }));
      return cancelTTS;
    }
    // Server told us to fall back, or returned JSON with useBrowser
    speakBrowser(text, { onStart, onEnd });
  } catch {
    speakBrowser(text, { onStart, onEnd });
  }
  return cancelTTS;
};

export default { speak, cancelTTS };
