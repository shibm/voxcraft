import React, { useState } from 'react';
import { BookOpen, Copy, Check, Terminal, Code2, Cpu, Globe } from 'lucide-react';

export const NoAiGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copySnippet = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const methods = [
    {
      title: '1. Web Speech API (JavaScript in Any Browser)',
      icon: Globe,
      badge: 'Recommended for Web Apps',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description:
        'Every modern browser (Chrome, Safari, Edge, Firefox) comes with a built-in text-to-speech engine running entirely on your device with zero AI and zero external servers.',
      code: `// 1. Create the speech utterance
const utterance = new SpeechSynthesisUtterance("Hello! This converts text to audio without any AI.");

// 2. Configure speed, pitch, and voice
utterance.rate = 1.0;  // Speed: 0.1 to 10
utterance.pitch = 1.0; // Pitch: 0 to 2
utterance.volume = 1.0; // Volume: 0 to 1

// 3. Optional: choose an installed OS voice
const voices = window.speechSynthesis.getVoices();
utterance.voice = voices[0];

// 4. Speak the text aloud
window.speechSynthesis.speak(utterance);`,
    },
    {
      title: '2. Generate WAV Audio File in JavaScript (Web Audio API)',
      icon: Code2,
      badge: 'Downloadable Audio File',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      description:
        'You can synthesize audio waves (frequencies, phonemes, or sound harmonics) in pure JavaScript using AudioContext and encode them directly into a 16-bit PCM WAV file without AI.',
      code: `// Create offline audio context
const ctx = new AudioContext();
const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
const data = buffer.getChannelData(0);

// Generate sound waveform (e.g. 440Hz tone or formant frequencies)
for (let i = 0; i < data.length; i++) {
  data[i] = Math.sin(2 * Math.PI * 440 * (i / ctx.sampleRate));
}

// Convert buffer into a downloadable WAV Blob & URL
// (See our built-in offlineSynth.ts for complete phoneme synthesis)`,
    },
    {
      title: '3. Operating System Native Commands (Terminal / CLI)',
      icon: Terminal,
      badge: 'Offline System Tools',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description:
        'Your computer operating system has built-in text-to-speech tools that can speak or output directly to audio files from the command line:',
      code: `# macOS (built-in 'say' command):
say "Hello world" -o output.aiff

# Windows PowerShell (built-in SAPI engine):
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile("C:\\audio.wav")
$speak.Speak("Hello world")

# Linux (using eSpeak offline synthesizer):
espeak "Hello world" -w output.wav`,
    },
    {
      title: '4. Python Offline (No AI / No API Key)',
      icon: Cpu,
      badge: 'Python Scripting',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      description:
        'Use pyttsx3, an offline cross-platform Python text-to-speech library that interfaces directly with your native OS synthesizer (SAPI5 on Windows, NSSpeechSynthesizer on macOS, eSpeak on Linux):',
      code: `import pyttsx3

# Initialize the offline engine
engine = pyttsx3.init()

# Configure properties
engine.setProperty('rate', 150)    # Speed
engine.setProperty('volume', 0.9)  # Volume (0.0 to 1.0)

# Save text directly to an audio file (.mp3 / .wav)
engine.save_to_file("Hello world! This audio was created without AI.", "speech.mp3")
engine.runAndWait()`,
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-6">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">
            How to Convert Text into Audio Without AI
          </h3>
          <p className="text-xs text-slate-400">
            Learn the standard, reliable methods that run 100% offline on any device with zero external APIs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((method, idx) => {
          const Icon = method.icon;
          return (
            <div
              key={method.title}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-slate-300" />
                    <h4 className="text-xs font-semibold text-white">{method.title}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${method.badgeColor} whitespace-nowrap`}
                  >
                    {method.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {method.description}
                </p>
              </div>

              <div className="relative group">
                <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                  <code>{method.code}</code>
                </pre>
                <button
                  onClick={() => copySnippet(method.code, idx)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition opacity-90 group-hover:opacity-100 flex items-center gap-1 text-[10px]"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
