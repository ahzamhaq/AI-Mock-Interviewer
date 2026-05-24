// Server-side TTS service.
// Returns an MP3 Buffer when ElevenLabs is available; otherwise returns null
// so the client can fall back to the browser's SpeechSynthesis API.

async function getElevenLabsAudio(text, opts = {}) {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  const voiceId = opts.voice || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam
  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!resp.ok) {
      console.warn('[TTS] ElevenLabs HTTP', resp.status);
      return null;
    }
    const buf = await resp.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    console.warn('[TTS] ElevenLabs error:', e.message);
    return null;
  }
}

async function getTTSAudio(text, opts = {}) {
  const provider = (process.env.TTS_PROVIDER || 'browser').toLowerCase();
  if (provider === 'elevenlabs') {
    return getElevenLabsAudio(text, opts);
  }
  return null; // client falls back to browser TTS
}

module.exports = { getTTSAudio, getElevenLabsAudio };
