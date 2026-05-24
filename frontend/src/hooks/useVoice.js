import { useState, useRef, useCallback, useEffect } from 'react';

const FILLER_WORDS = ['umm', 'uh', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of', 'i mean', 'right', 'okay so', 'so yeah'];

const detectFillerWords = (text) => {
  const lower = text.toLowerCase();
  const found = [];
  let count = 0;
  FILLER_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lower.match(regex);
    if (matches) { count += matches.length; found.push(...Array(matches.length).fill(word)); }
  });
  return { fillerWords: [...new Set(found)], fillerWordCount: count };
};

const calculateWPM = (text, durationSeconds) => {
  if (!durationSeconds || durationSeconds < 1) return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / durationSeconds) * 60);
};

const getPace = (wpm) => {
  if (wpm === 0) return 'unknown';
  if (wpm < 100) return 'too_slow';
  if (wpm > 180) return 'too_fast';
  return 'ideal';
};

export const useSpeechSynthesis = () => {
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  const speak = useCallback((text, onEnd) => {
    const synth = synthRef.current;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    // Prefer a natural English voice
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
                      voices.find(v => v.lang.startsWith('en-US') && !v.name.includes('Microsoft')) ||
                      voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => { setSpeaking(false); onEnd?.(); };
    utterance.onerror = () => { setSpeaking(false); onEnd?.(); };
    synth.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    synthRef.current.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => () => synthRef.current.cancel(), []);

  return { speak, stop, speaking, supported: 'speechSynthesis' in window };
};

export const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const startTimeRef = useRef(null);
  const onEndCallbackRef = useRef(null);

  const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  const startListening = useCallback((onEnd) => {
    if (!supported) { setError('Speech recognition not supported in this browser'); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;
    onEndCallbackRef.current = onEnd;

    let finalTranscript = '';

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      startTimeRef.current = Date.now();
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Recognition error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      const duration = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      const text = finalTranscript.trim();
      const { fillerWords, fillerWordCount } = detectFillerWords(text);
      const wpm = calculateWPM(text, duration);
      const metrics = { wordsPerMinute: wpm, fillerWordCount, fillerWords, speakingPace: getPace(wpm), totalDuration: Math.round(duration) };
      onEndCallbackRef.current?.({ transcript: text, metrics });
    };

    recognition.start();
  }, [supported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => setTranscript(''), []);

  return { transcript, listening, error, startListening, stopListening, resetTranscript, supported };
};
