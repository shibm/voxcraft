import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Headphones,
  Bell,
  Upload,
  ExternalLink,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { GeneratedClip } from './types';
import { base64ToBlobUrl, countWords, estimateDuration, formatTime } from './utils/audio';
import { playTestChime } from './utils/soundTest';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryList } from './components/HistoryList';

interface LocalVoiceOption {
  id: string;
  name: string;
  accent: string;
  gender: 'Female' | 'Male';
  description: string;
}

const LOCAL_VOICES: LocalVoiceOption[] = [
  {
    id: 'en-us+f2',
    name: 'Emma (US)',
    accent: 'American',
    gender: 'Female',
    description: 'Clear, natural-cadence American female voice',
  },
  {
    id: 'en-us',
    name: 'David (US)',
    accent: 'American',
    gender: 'Male',
    description: 'Standard clear American male voice',
  },
  {
    id: 'en-us+f3',
    name: 'Claire (US)',
    accent: 'American',
    gender: 'Female',
    description: 'Soft, calm, relaxed American female voice',
  },
  {
    id: 'en-us+m3',
    name: 'Marcus (US)',
    accent: 'American',
    gender: 'Male',
    description: 'Deep, resonant, authoritative male voice',
  },
  {
    id: 'en-gb',
    name: 'Oliver (UK)',
    accent: 'British',
    gender: 'Male',
    description: 'Crisp, articulate British English accent',
  },
  {
    id: 'en-gb-scotland',
    name: 'Ian (Scottish)',
    accent: 'Scottish',
    gender: 'Male',
    description: 'Classic Scottish accent with distinct inflection',
  },
  {
    id: 'en-us+whisper',
    name: 'Echo (Whisper)',
    accent: 'American',
    gender: 'Female',
    description: 'Soft whisper acoustic vocal tone',
  },
];

const PRESETS = [
  'Hello! This is a 100% local text-to-speech engine running completely offline without any AI.',
  'Welcome to the local converter. You can type any sentence, hear it through your speakers, and download the MP3.',
  'The local speech engine operates with zero latency, zero cloud costs, and unlimited word processing capacity.',
];

export default function App() {
  const [text, setText] = useState<string>(PRESETS[0]);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-us+f2');
  const [speed, setSpeed] = useState<number>(160); // words per minute (100 - 260)
  const [pitch, setPitch] = useState<number>(50);  // pitch (20 - 80)
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<GeneratedClip | null>(null);
  const [history, setHistory] = useState<GeneratedClip[]>([]);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [testingSpeaker, setTestingSpeaker] = useState<boolean>(false);

  const playerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = countWords(text);
  const estimatedSeconds = estimateDuration(wordCount, speed);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxcraft_history');
      if (saved) {
        const parsed: GeneratedClip[] = JSON.parse(saved);
        const hydrated = parsed.map((item) => {
          if (item.base64Audio) {
            const url = base64ToBlobUrl(item.base64Audio, 'audio/mp3');
            return {
              ...item,
              audioUrl: url,
              mp3Url: url,
            };
          }
          return item;
        });
        setHistory(hydrated);
        if (hydrated.length > 0) {
          setCurrentClip(hydrated[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to load history', e);
    }
  }, []);

  const saveToHistory = (clip: GeneratedClip) => {
    setHistory((prev) => {
      const updated = [clip, ...prev.filter((c) => c.id !== clip.id)].slice(0, 15);
      try {
        localStorage.setItem('voxcraft_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save history', e);
      }
      return updated;
    });
  };

  // Test sound chime to verify speakers
  const handleTestSpeaker = async () => {
    setTestingSpeaker(true);
    await playTestChime();
    setTestingSpeaker(false);
  };

  // Upload an audio file to test in player
  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newClip: GeneratedClip = {
      id: Date.now().toString(),
      text: `Uploaded File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      engine: 'wav-synth',
      voiceName: file.name.slice(0, 16),
      audioUrl: url,
      mp3Url: url,
      timestamp: Date.now(),
      duration: 0,
      wordCount: 0,
    };

    setCurrentClip(newClip);
    saveToHistory(newClip);

    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // 100% LOCAL Speech Synthesis (No AI)
  const handleConvert = async () => {
    if (!text.trim()) {
      setErrorMessage('Please type some text to convert into speech.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Calls local espeak-ng + ffmpeg on localhost (50ms latency, zero cloud)
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          speed: speed,
          pitch: pitch,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Local speech synthesis failed.');
      }

      // Convert local base64 MP3 to Blob URL for instant speaker output
      const mp3Url = base64ToBlobUrl(data.audioBase64, 'audio/mp3');
      const chosenVoiceObj = LOCAL_VOICES.find((v) => v.id === selectedVoice);

      const newClip: GeneratedClip = {
        id: Date.now().toString(),
        text: text.trim(),
        engine: 'wav-synth',
        voiceName: chosenVoiceObj ? chosenVoiceObj.name : 'Local Voice',
        audioUrl: mp3Url,
        mp3Url: mp3Url,
        base64Audio: data.audioBase64,
        timestamp: Date.now(),
        duration: estimatedSeconds,
        wordCount,
      };

      setCurrentClip(newClip);
      saveToHistory(newClip);

      // Scroll to player so user immediately hears it
      setTimeout(() => {
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } catch (err: any) {
      console.error('Local speech error:', err);
      setErrorMessage(err.message || 'Unable to generate local speech.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConvert();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Hidden Audio File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={handleUploadAudio}
        className="hidden"
      />

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">
                  Local Voice
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  100% Offline • Zero AI
                </span>
              </div>
              <p className="text-xs text-slate-400">Pure local speech synthesis with MP3 audio output</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload any MP3 or audio file to inspect and play it"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Upload Audio</span>
            </button>

            <button
              onClick={handleTestSpeaker}
              title="Test if your speakers and browser tab volume are working"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition active:scale-95"
            >
              <Bell className={`w-3.5 h-3.5 ${testingSpeaker ? 'text-amber-300 animate-bounce' : 'text-emerald-400'}`} />
              <span>{testingSpeaker ? 'Playing...' : 'Test Speaker 🔔'}</span>
            </button>

            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
              title="Open in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Tab</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Local Engine Banner */}
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-3 backdrop-blur-sm">
          <Volume2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white text-sm flex items-center gap-2">
              Local Speech Synthesizer Active
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                No Cloud • No API Keys
              </span>
            </p>
            <p className="text-slate-300 leading-relaxed">
              Synthesizes text locally into real MP3 audio that streams directly to your hardware speakers. Audio is never blocked by browser iframe restrictions.
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Notice</p>
              <p className="text-xs text-red-200 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs px-2 py-1 bg-red-900/60 hover:bg-red-800 rounded text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
          <span className="text-slate-400 font-medium whitespace-nowrap">Try sample:</span>
          {PRESETS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => setText(sample)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition whitespace-nowrap text-xs"
            >
              Sample {idx + 1}
            </button>
          ))}
        </div>

        {/* Text Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Enter Your Text:
            </span>

            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 2000);
                }}
                className="hover:text-white flex items-center gap-1 p-1 hover:bg-slate-800 rounded"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => setText('')}
                className="hover:text-red-400 flex items-center gap-1 p-1 hover:bg-slate-800 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or paste the text you want to convert into audio here..."
            className="w-full h-36 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder-slate-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 resize-y"
          />

          {/* Local Voice Profile Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Local Voice:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LOCAL_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/50'
                        : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs text-white">{v.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{v.gender}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{v.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Tuning Sliders: Speed & Pitch */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Speed (Words per minute)</span>
                <span className="text-emerald-400 font-mono font-semibold">{speed} WPM</span>
              </div>
              <input
                type="range"
                min={100}
                max={260}
                step={10}
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Voice Pitch</span>
                <span className="text-emerald-400 font-mono font-semibold">{pitch}</span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                step={5}
                value={pitch}
                onChange={(e) => setPitch(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Stats & Convert Button */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-3">
              <span><strong>{wordCount}</strong> words</span>
              <span>•</span>
              <span><strong>{text.length}</strong> characters</span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5" /> ~{formatTime(estimatedSeconds)} duration
              </span>
            </div>

            <button
              onClick={handleConvert}
              disabled={isGenerating || !text.trim()}
              className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                isGenerating || !text.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing Local Audio...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Convert to Audio & Listen (Local MP3)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Audio Player (Always visible when a clip exists) */}
        {currentClip && (
          <div ref={playerRef} className="space-y-2 scroll-mt-20">
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-400" />
              Generated Audio Player
            </h3>
            <AudioPlayer
              audioUrl={currentClip.audioUrl}
              mp3Url={currentClip.mp3Url}
              title={`Audio: "${currentClip.text.slice(0, 42)}..."`}
              voiceName={currentClip.voiceName}
              autoPlay={true}
            />
          </div>
        )}

        {/* Previous Creations History */}
        <HistoryList
          clips={history}
          onSelectClip={(clip) => {
            setCurrentClip(clip);
            setText(clip.text);
          }}
          onDeleteClip={(id) => {
            setHistory((prev) => {
              const updated = prev.filter((c) => c.id !== id);
              localStorage.setItem('voxcraft_history', JSON.stringify(updated));
              return updated;
            });
            if (currentClip?.id === id) setCurrentClip(null);
          }}
          onClearAll={() => {
            setHistory([]);
            localStorage.removeItem('voxcraft_history');
          }}
          activeClipId={currentClip?.id}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <p>Local Voice • 100% Offline Text-to-Audio Synthesizer (Zero AI) • Standard MP3 Export</p>
      </footer>
    </div>
  );
}
