import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { Mp3Encoder } from '@breezystack/lamejs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Helper: Check if a CLI command exists in PATH
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    await execFileAsync(checkCmd, [cmd]);
    return true;
  } catch {
    return false;
  }
}

// Formants for pure JavaScript fallback acoustic synthesizer
const FORMANT_MAP: Record<string, { f1: number; f2: number; f3: number; duration: number }> = {
  a: { f1: 730, f2: 1090, f3: 2440, duration: 0.16 },
  e: { f1: 530, f2: 1840, f3: 2480, duration: 0.15 },
  i: { f1: 270, f2: 2290, f3: 3010, duration: 0.14 },
  o: { f1: 570, f2: 840, f3: 2410, duration: 0.16 },
  u: { f1: 300, f2: 870, f3: 2240, duration: 0.15 },
  y: { f1: 280, f2: 2100, f3: 2800, duration: 0.14 },
};

const CONSONANT_TYPES: Record<string, { noiseRatio: number; baseFreq: number; duration: number }> = {
  s: { noiseRatio: 0.9, baseFreq: 4500, duration: 0.12 },
  f: { noiseRatio: 0.85, baseFreq: 3500, duration: 0.1 },
  h: { noiseRatio: 0.8, baseFreq: 1500, duration: 0.08 },
  z: { noiseRatio: 0.6, baseFreq: 4000, duration: 0.12 },
  t: { noiseRatio: 0.95, baseFreq: 5000, duration: 0.06 },
  p: { noiseRatio: 0.7, baseFreq: 1200, duration: 0.06 },
  k: { noiseRatio: 0.85, baseFreq: 2200, duration: 0.06 },
  m: { noiseRatio: 0.1, baseFreq: 250, duration: 0.12 },
  n: { noiseRatio: 0.15, baseFreq: 320, duration: 0.12 },
  l: { noiseRatio: 0.1, baseFreq: 400, duration: 0.11 },
  r: { noiseRatio: 0.1, baseFreq: 350, duration: 0.11 },
  w: { noiseRatio: 0.1, baseFreq: 300, duration: 0.11 },
  b: { noiseRatio: 0.4, baseFreq: 180, duration: 0.06 },
  d: { noiseRatio: 0.5, baseFreq: 280, duration: 0.06 },
  g: { noiseRatio: 0.5, baseFreq: 240, duration: 0.06 },
  c: { noiseRatio: 0.9, baseFreq: 4500, duration: 0.08 },
  j: { noiseRatio: 0.6, baseFreq: 2800, duration: 0.1 },
  q: { noiseRatio: 0.8, baseFreq: 2200, duration: 0.08 },
  v: { noiseRatio: 0.5, baseFreq: 1800, duration: 0.1 },
  x: { noiseRatio: 0.9, baseFreq: 4200, duration: 0.12 },
};

// Pure Node.js acoustic formant synthesizer fallback (zero external binaries required)
function generateFormantWav(text: string, speedMultiplier: number = 1.0, pitchHz: number = 150): Buffer {
  const sampleRate = 22050;
  const baseF0 = Math.max(70, Math.min(300, pitchHz));
  const speed = Math.max(0.5, Math.min(2.5, speedMultiplier));
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s.,!?]/g, ' ');
  const words = cleanText.split(/\s+/).filter(Boolean);
  const sampleBlocks: Float32Array[] = [];

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let c = 0; c < word.length; c++) {
      const char = word[c];
      if (char === '.' || char === '!' || char === '?') {
        sampleBlocks.push(new Float32Array(Math.floor(sampleRate * (0.25 / speed))));
        continue;
      }
      if (char === ',') {
        sampleBlocks.push(new Float32Array(Math.floor(sampleRate * (0.12 / speed))));
        continue;
      }

      if (FORMANT_MAP[char]) {
        const formant = FORMANT_MAP[char];
        const count = Math.floor(sampleRate * (formant.duration / speed));
        const block = new Float32Array(count);
        const pitchContour = baseF0 * (1 + 0.08 * Math.sin((c / Math.max(1, word.length)) * Math.PI));

        for (let i = 0; i < count; i++) {
          const t = i / sampleRate;
          const envelope = Math.sin((i / count) * Math.PI);
          let source = 0;
          for (let h = 1; h <= 6; h++) {
            source += (1 / h) * Math.sin(2 * Math.PI * (pitchContour * h) * t);
          }
          source *= 0.35;
          const res1 = Math.sin(2 * Math.PI * formant.f1 * t) * 0.45;
          const res2 = Math.sin(2 * Math.PI * formant.f2 * t) * 0.3;
          const res3 = Math.sin(2 * Math.PI * formant.f3 * t) * 0.15;
          block[i] = (source * (res1 + res2 + res3)) * envelope * 0.8;
        }
        sampleBlocks.push(block);
      } else if (CONSONANT_TYPES[char]) {
        const info = CONSONANT_TYPES[char];
        const count = Math.floor(sampleRate * (info.duration / speed));
        const block = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const t = i / sampleRate;
          const envelope = Math.sin((i / count) * Math.PI);
          const noise = (Math.random() * 2 - 1) * info.noiseRatio;
          const tone = Math.sin(2 * Math.PI * info.baseFreq * t) * (1 - info.noiseRatio);
          block[i] = (noise + tone) * envelope * 0.5;
        }
        sampleBlocks.push(block);
      } else {
        sampleBlocks.push(new Float32Array(Math.floor(sampleRate * (0.05 / speed))));
      }
    }
    sampleBlocks.push(new Float32Array(Math.floor(sampleRate * (0.08 / speed))));
  }

  const totalLength = sampleBlocks.reduce((acc, b) => acc + b.length, 0);
  const fullSamples = new Float32Array(totalLength || sampleRate);
  let pos = 0;
  for (const block of sampleBlocks) {
    fullSamples.set(block, pos);
    pos += block.length;
  }

  let maxAmp = 0;
  for (let i = 0; i < fullSamples.length; i++) {
    const abs = Math.abs(fullSamples[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  if (maxAmp > 0.01) {
    const gain = 0.85 / maxAmp;
    for (let i = 0; i < fullSamples.length; i++) fullSamples[i] *= gain;
  }

  // Create standard RIFF WAV buffer (16-bit PCM Mono)
  const wavBuf = Buffer.alloc(44 + fullSamples.length * 2);
  wavBuf.write('RIFF', 0);
  wavBuf.writeUInt32LE(36 + fullSamples.length * 2, 4);
  wavBuf.write('WAVE', 8);
  wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16);
  wavBuf.writeUInt16LE(1, 20); // PCM
  wavBuf.writeUInt16LE(1, 22); // mono
  wavBuf.writeUInt32LE(sampleRate, 24);
  wavBuf.writeUInt32LE(sampleRate * 2, 28);
  wavBuf.writeUInt16LE(2, 32);
  wavBuf.writeUInt16LE(16, 34);
  wavBuf.write('data', 36);
  wavBuf.writeUInt32LE(fullSamples.length * 2, 40);

  let offset = 44;
  for (let i = 0; i < fullSamples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, fullSamples[i]));
    wavBuf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
  }

  return wavBuf;
}

// Convert any standard WAV buffer to MP3 in memory using lamejs (no external ffmpeg binary required)
function wavBufferToMp3Buffer(wavBuffer: Buffer, kbps: number = 128): Buffer {
  const ab = wavBuffer.buffer.slice(
    wavBuffer.byteOffset,
    wavBuffer.byteOffset + wavBuffer.byteLength
  );
  const view = new DataView(ab);

  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV format: missing RIFF header');
  }

  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 22050;
  const bitsPerSample = view.getUint16(34, true) || 16;

  // Search for the 'data' subchunk
  let dataOffset = 12;
  let dataLen = 0;
  while (dataOffset < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      dataOffset += 8;
      dataLen = chunkSize;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataLen === 0 || dataOffset >= view.byteLength) {
    dataOffset = 44;
    dataLen = view.byteLength - 44;
  }

  const sampleCount = Math.floor(dataLen / (bitsPerSample / 8));
  let int16Samples: Int16Array;

  if (bitsPerSample === 16) {
    int16Samples = new Int16Array(ab, dataOffset, sampleCount);
  } else if (bitsPerSample === 8) {
    int16Samples = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      int16Samples[i] = (view.getUint8(dataOffset + i) - 128) << 8;
    }
  } else {
    int16Samples = new Int16Array(ab, dataOffset, Math.floor(dataLen / 2));
  }

  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const mp3Chunks: Buffer[] = [];
  const chunkSize = 1152;

  if (channels === 1) {
    for (let i = 0; i < int16Samples.length; i += chunkSize) {
      const chunk = int16Samples.subarray(i, i + chunkSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Chunks.push(Buffer.from(mp3buf));
    }
  } else {
    const totalStereoPairs = Math.floor(int16Samples.length / 2);
    const left = new Int16Array(totalStereoPairs);
    const right = new Int16Array(totalStereoPairs);
    for (let i = 0; i < totalStereoPairs; i++) {
      left[i] = int16Samples[i * 2];
      right[i] = int16Samples[i * 2 + 1];
    }
    for (let i = 0; i < totalStereoPairs; i += chunkSize) {
      const leftChunk = left.subarray(i, i + chunkSize);
      const rightChunk = right.subarray(i, i + chunkSize);
      const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) mp3Chunks.push(Buffer.from(mp3buf));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) mp3Chunks.push(Buffer.from(endBuf));

  return Buffer.concat(mp3Chunks);
}

// Voice mappings for espeak-ng / espeak
const espeakVoiceMap: Record<string, string> = {
  'en-us': 'en-us',
  'en-gb': 'en-gb',
  'en-sc': 'en-gb-scotland',
  'en-female-1': 'en-us+f2',
  'en-female-2': 'en-us+f3',
  'en-male-deep': 'en-us+m3',
  'en-whisper': 'en-us+whisper',
  'en-us+f2': 'en-us+f2',
  'en-us+f3': 'en-us+f3',
  'en-us+m3': 'en-us+m3',
  'en-gb-scotland': 'en-gb-scotland',
  'Kore': 'en-us+f2',
  'Puck': 'en-us',
  'Fenrir': 'en-us+m3',
  'Zephyr': 'en-us+f3',
  'Charon': 'en-gb',
};

// Voice mappings for macOS `say`
const macVoiceMap: Record<string, string> = {
  'en-us+f2': 'Samantha',
  'en-us': 'Fred',
  'en-us+f3': 'Sandy',
  'en-us+m3': 'Ralph',
  'en-gb': 'Daniel',
  'en-gb-scotland': 'Daniel',
  'en-us+whisper': 'Whisper',
  'en-female-1': 'Samantha',
  'en-female-2': 'Sandy',
  'en-male-deep': 'Ralph',
  'Kore': 'Samantha',
  'Puck': 'Fred',
  'Fenrir': 'Ralph',
  'Zephyr': 'Sandy',
  'Charon': 'Daniel',
};

// Pitch mappings for pure JS fallback
const jsPitchMap: Record<string, number> = {
  'en-us+f2': 210,
  'en-us': 130,
  'en-us+f3': 240,
  'en-us+m3': 95,
  'en-gb': 145,
  'en-gb-scotland': 125,
  'en-us+whisper': 180,
  'Kore': 210,
  'Puck': 130,
  'Fenrir': 95,
  'Zephyr': 240,
  'Charon': 145,
};

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  const hasEspeakNg = await commandExists('espeak-ng');
  const hasEspeak = !hasEspeakNg && (await commandExists('espeak'));
  const isMac = process.platform === 'darwin';

  res.json({
    status: 'ok',
    engine: hasEspeakNg ? 'espeak-ng' : hasEspeak ? 'espeak' : isMac ? 'macos-say' : 'local-offline-tts',
    mode: 'zero-ai',
    platform: process.platform,
  });
});

// Endpoint: 100% Local Speech Synthesis (Zero AI, Zero Cloud, 100% Offline)
app.post('/api/tts/generate', async (req, res) => {
  const hash = crypto.randomBytes(8).toString('hex');
  const tempWav = path.join(os.tmpdir(), `voxcraft_${hash}.wav`);
  const tempTxt = path.join(os.tmpdir(), `voxcraft_${hash}.txt`);
  const tempMp3 = path.join(os.tmpdir(), `voxcraft_${hash}.mp3`);

  try {
    const {
      text,
      voice = 'en-us+f2',
      speed = 160, // words per minute (80 - 300)
      pitch = 50,  // pitch (0 - 99)
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const cleanText = text.trim();
    const targetSpeed = Math.max(80, Math.min(350, Math.round(Number(speed) || 160)));
    const targetPitch = Math.max(0, Math.min(99, Math.round(Number(pitch) || 50)));

    let wavBuffer: Buffer | null = null;
    let engineUsed = 'built-in-synth';
    let targetVoice = voice;

    // Detect available speech engines:
    // 1. espeak-ng / espeak
    // 2. macOS `say` (built-in on every Mac)
    // 3. Windows PowerShell SAPI
    // 4. Built-in JavaScript formant synthesizer
    const hasEspeakNg = await commandExists('espeak-ng');
    const hasEspeak = !hasEspeakNg && (await commandExists('espeak'));
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    // Tier 1: Try espeak-ng or espeak if present
    if (hasEspeakNg || hasEspeak) {
      try {
        const bin = hasEspeakNg ? 'espeak-ng' : 'espeak';
        targetVoice = espeakVoiceMap[voice] || voice || 'en-us';
        await execFileAsync(bin, [
          '-v', targetVoice,
          '-s', targetSpeed.toString(),
          '-p', targetPitch.toString(),
          cleanText,
          '-w', tempWav,
        ]);
        if (fs.existsSync(tempWav)) {
          wavBuffer = fs.readFileSync(tempWav);
          engineUsed = bin;
        }
      } catch (err) {
        console.warn('espeak synthesis failed, falling back to next engine:', err);
      }
    }

    // Tier 2: Try macOS `say` on darwin
    if (!wavBuffer && isMac) {
      try {
        targetVoice = macVoiceMap[voice] || 'Samantha';
        fs.writeFileSync(tempTxt, cleanText, 'utf8');
        await execFileAsync('say', [
          '-v', targetVoice,
          '-r', targetSpeed.toString(),
          '-f', tempTxt,
          '-o', tempWav,
          '--data-format=LEI16@22050',
        ]);
        if (fs.existsSync(tempWav)) {
          wavBuffer = fs.readFileSync(tempWav);
          engineUsed = 'macos-say';
        }
      } catch (err) {
        console.warn('macOS say failed, falling back to next engine:', err);
      }
    }

    // Tier 3: Try Windows PowerShell SpeechSynthesizer
    if (!wavBuffer && isWin) {
      try {
        targetVoice = voice;
        const rate = Math.max(-10, Math.min(10, Math.round((targetSpeed - 160) / 15)));
        const psScript = `
Add-Type -AssemblyName System.Speech;
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$speak.Rate = ${rate};
$speak.SetOutputToWaveFile("${tempWav.replace(/\\/g, '\\\\')}");
$speak.Speak("${cleanText.replace(/"/g, '`"')}");
$speak.Dispose();
`;
        await execFileAsync('powershell', ['-NoProfile', '-Command', psScript]);
        if (fs.existsSync(tempWav)) {
          wavBuffer = fs.readFileSync(tempWav);
          engineUsed = 'windows-sapi';
        }
      } catch (err) {
        console.warn('Windows SAPI failed, falling back to next engine:', err);
      }
    }

    // Tier 4: Pure JavaScript acoustic formant synthesizer (always works)
    if (!wavBuffer) {
      const basePitch = jsPitchMap[voice] || (targetPitch * 2 + 50);
      wavBuffer = generateFormantWav(cleanText, targetSpeed / 160, basePitch);
      engineUsed = 'built-in-synth';
      targetVoice = voice;
    }

    // Convert WAV buffer to MP3 in memory using lamejs
    let outputBuffer: Buffer = wavBuffer;
    let mimeType = 'audio/mp3';

    try {
      outputBuffer = wavBufferToMp3Buffer(wavBuffer, 128);
      mimeType = 'audio/mp3';
    } catch (lameErr) {
      console.warn('In-memory MP3 encoding failed, checking ffmpeg:', lameErr);
      const hasFfmpeg = await commandExists('ffmpeg');
      if (hasFfmpeg) {
        try {
          fs.writeFileSync(tempWav, wavBuffer);
          await execFileAsync('ffmpeg', [
            '-i', tempWav,
            '-b:a', '128k',
            tempMp3,
            '-y',
          ]);
          outputBuffer = fs.readFileSync(tempMp3);
          mimeType = 'audio/mp3';
        } catch {
          // Output original WAV if ffmpeg also fails
          outputBuffer = wavBuffer;
          mimeType = 'audio/wav';
        }
      } else {
        // Fallback to high-quality PCM WAV output directly
        outputBuffer = wavBuffer;
        mimeType = 'audio/wav';
      }
    }

    return res.json({
      success: true,
      audioBase64: outputBuffer.toString('base64'),
      mimeType,
      voice: targetVoice,
      engine: engineUsed,
      speed: targetSpeed,
      pitch: targetPitch,
    });
  } catch (err: any) {
    console.error('Local TTS generation error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to synthesize speech using local engine',
      details: err?.toString(),
    });
  } finally {
    // Clean up temporary files safely
    try {
      if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
      if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
      if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    } catch {
      // Ignore cleanup error
    }
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
