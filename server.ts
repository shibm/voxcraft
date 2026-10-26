import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Health check endpoint - reports 100% local engine status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    engine: 'local-offline-tts',
    mode: 'zero-ai',
  });
});

// Endpoint: 100% Local Speech Synthesis using local espeak-ng & ffmpeg (Zero AI, Zero Cloud, 100% Offline)
app.post('/api/tts/generate', async (req, res) => {
  try {
    const {
      text,
      voice = 'en-us',
      speed = 160, // words per minute (80 - 300)
      pitch = 50,  // pitch (0 - 99)
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const cleanText = text.trim();
    const hash = crypto.randomBytes(8).toString('hex');
    const tempWav = path.join('/tmp', `local_speech_${hash}.wav`);
    const tempMp3 = path.join('/tmp', `local_speech_${hash}.mp3`);

    // Voice mapping for local engine
    const voiceMap: Record<string, string> = {
      'en-us': 'en-us',
      'en-gb': 'en-gb',
      'en-sc': 'en-gb-scotland',
      'en-female-1': 'en-us+f2',
      'en-female-2': 'en-us+f3',
      'en-male-deep': 'en-us+m3',
      'en-whisper': 'en-us+whisper',
      'Kore': 'en-us+f2',
      'Puck': 'en-us',
      'Fenrir': 'en-us+m3',
      'Zephyr': 'en-us+f3',
      'Charon': 'en-gb',
    };

    const targetVoice = voiceMap[voice] || voice || 'en-us';
    const targetSpeed = Math.max(80, Math.min(350, Math.round(Number(speed) || 160)));
    const targetPitch = Math.max(0, Math.min(99, Math.round(Number(pitch) || 50)));

    // 1. Synthesize WAV locally using espeak-ng (No AI, purely local phoneme synthesis)
    await execFileAsync('espeak-ng', [
      '-v', targetVoice,
      '-s', targetSpeed.toString(),
      '-p', targetPitch.toString(),
      cleanText,
      '-w', tempWav,
    ]);

    // 2. Encode to MP3 locally using ffmpeg (128 kbps)
    await execFileAsync('ffmpeg', [
      '-i', tempWav,
      '-b:a', '128k',
      tempMp3,
      '-y',
    ]);

    // 3. Read output MP3 file
    const mp3Buffer = fs.readFileSync(tempMp3);
    const base64Mp3 = mp3Buffer.toString('base64');

    // Clean up temporary files
    try {
      if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
      if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    } catch {
      // Ignore cleanup error
    }

    return res.json({
      success: true,
      audioBase64: base64Mp3,
      mimeType: 'audio/mp3',
      voice: targetVoice,
      engine: 'local-espeak-ng',
      speed: targetSpeed,
      pitch: targetPitch,
    });
  } catch (err: any) {
    console.error('Local TTS generation error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to synthesize speech using local engine',
      details: err?.toString(),
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Statically serve public directory with full byte-range support for audio
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Local TTS Server running at http://0.0.0.0:${PORT} (100% Offline, Zero AI)`);
  });
}

startServer();
