/**
 * Offline Text-to-Audio (WAV) Synthesizer
 * Generates playable and downloadable WAV audio files in pure JavaScript
 * without using any AI, external APIs, or server requests.
 * Uses Formant & Phonetic synthesis with Web Audio API / PCM encoding.
 */

import { pcmToMp3Blob } from './mp3Encoder';

// Formant frequency maps (F1, F2, F3) for vowels
const FORMANT_MAP: Record<string, { f1: number; f2: number; f3: number; duration: number }> = {
  a: { f1: 730, f2: 1090, f3: 2440, duration: 0.16 },
  e: { f1: 530, f2: 1840, f3: 2480, duration: 0.15 },
  i: { f1: 270, f2: 2290, f3: 3010, duration: 0.14 },
  o: { f1: 570, f2: 840, f3: 2410, duration: 0.16 },
  u: { f1: 300, f2: 870, f3: 2240, duration: 0.15 },
  y: { f1: 280, f2: 2100, f3: 2800, duration: 0.14 },
};

// Consonant character duration and noise characteristics
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

/**
 * Encodes Float32 PCM sample array into a standard 16-bit mono WAV Blob
 */
export function encodeWAV(samples: Float32Array, sampleRate: number = 22050): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 channel * 2 bytes/sample)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 channel * 2 bytes/sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (Float32 to Int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export interface SynthOptions {
  pitch?: number; // Base F0 in Hz (e.g. 130 for male, 210 for female, 160 for neutral)
  speed?: number; // 0.7 to 1.8
  mode?: 'natural' | 'retro' | 'melodic';
}

/**
 * Synthesizes text into a WAV Blob completely in pure JavaScript (No AI needed)
 */
export function synthesizeTextToWAV(
  text: string,
  options: SynthOptions = {}
): { blob: Blob; url: string; mp3Blob: Blob; mp3Url: string; duration: number } {
  const sampleRate = 22050;
  const baseF0 = options.pitch || 150;
  const speed = Math.max(0.5, Math.min(2.0, options.speed || 1.0));
  const mode = options.mode || 'natural';

  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s.,!?]/g, ' ');
  const words = cleanText.split(/\s+/).filter(Boolean);

  const sampleBlocks: Float32Array[] = [];

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let c = 0; c < word.length; c++) {
      const char = word[c];

      if (char === '.' || char === '!' || char === '?') {
        // Sentence pause
        const pauseSamples = Math.floor(sampleRate * (0.25 / speed));
        sampleBlocks.push(new Float32Array(pauseSamples));
        continue;
      }
      if (char === ',') {
        // Comma pause
        const pauseSamples = Math.floor(sampleRate * (0.12 / speed));
        sampleBlocks.push(new Float32Array(pauseSamples));
        continue;
      }

      if (FORMANT_MAP[char]) {
        // Vowel formant sound
        const formant = FORMANT_MAP[char];
        const charDuration = (formant.duration / speed);
        const count = Math.floor(sampleRate * charDuration);
        const block = new Float32Array(count);

        // Intonation pitch contour over word
        const pitchContour = baseF0 * (1 + 0.08 * Math.sin((c / Math.max(1, word.length)) * Math.PI));

        for (let i = 0; i < count; i++) {
          const t = i / sampleRate;
          const envelope = Math.sin((i / count) * Math.PI); // Hann smooth envelope

          // Generate harmonic rich voice source
          let source = 0;
          if (mode === 'retro') {
            // Pulse wave
            source = (t * pitchContour) % 1 > 0.5 ? 0.6 : -0.6;
          } else {
            // Glottal approximation (harmonics)
            for (let h = 1; h <= 6; h++) {
              source += (1 / h) * Math.sin(2 * Math.PI * (pitchContour * h) * t);
            }
            source *= 0.35;
          }

          // Resonate with formants
          const res1 = Math.sin(2 * Math.PI * formant.f1 * t) * 0.45;
          const res2 = Math.sin(2 * Math.PI * formant.f2 * t) * 0.3;
          const res3 = Math.sin(2 * Math.PI * formant.f3 * t) * 0.15;

          block[i] = (source * (res1 + res2 + res3)) * envelope * 0.8;
        }
        sampleBlocks.push(block);
      } else if (CONSONANT_TYPES[char]) {
        // Consonant sound
        const info = CONSONANT_TYPES[char];
        const duration = (info.duration / speed);
        const count = Math.floor(sampleRate * duration);
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
        // Neutral sound for other characters (numbers/spaces)
        const count = Math.floor(sampleRate * (0.05 / speed));
        sampleBlocks.push(new Float32Array(count));
      }
    }

    // Word boundary pause
    const wordPause = Math.floor(sampleRate * (0.08 / speed));
    sampleBlocks.push(new Float32Array(wordPause));
  }

  // Concatenate all blocks into single Float32Array
  const totalLength = sampleBlocks.reduce((acc, b) => acc + b.length, 0);
  const fullSamples = new Float32Array(totalLength || sampleRate);

  let pos = 0;
  for (const block of sampleBlocks) {
    fullSamples.set(block, pos);
    pos += block.length;
  }

  // Peak normalization so sound is clearly audible
  let maxAmp = 0;
  for (let i = 0; i < fullSamples.length; i++) {
    const abs = Math.abs(fullSamples[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  if (maxAmp > 0.01) {
    const gain = 0.85 / maxAmp;
    for (let i = 0; i < fullSamples.length; i++) {
      fullSamples[i] *= gain;
    }
  }

  const duration = totalLength / sampleRate;
  const blob = encodeWAV(fullSamples, sampleRate);
  const url = URL.createObjectURL(blob);

  // Also encode directly to standard MP3
  const mp3Blob = pcmToMp3Blob(fullSamples, sampleRate, 128);
  const mp3Url = URL.createObjectURL(mp3Blob);

  return { blob, url, mp3Blob, mp3Url, duration };
}
