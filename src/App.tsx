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
  Sparkles,
  ExternalLink,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { GeneratedClip } from './types';
import { base64ToBlobUrl, countWords, estimateDuration, formatTime, downloadAudio } from './utils/audio';
import { wavArrayBufferToMp3Blob } from './utils/mp3Encoder';
import { playTestChime } from './utils/soundTest';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryList } from './components/HistoryList';
import { UnlimitedTTSView } from './components/UnlimitedTTSView';

interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  vibe: string;
  avatarBg: string;
}

const VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    vibe: 'Warm, natural & clear voice',
    avatarBg: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Male',
    vibe: 'Friendly, energetic & conversational',
    avatarBg: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    vibe: 'Deep, rich & authoritative',
    avatarBg: 'from-amber-500 to-orange-600',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Female',
    vibe: 'Soft, gentle & soothing voice',
    avatarBg: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    vibe: 'Calm, thoughtful & formal',
    avatarBg: 'from-rose-500 to-pink-600',
  },
];

const PRESETS = [
  'Hello! This is a test to verify that text to speech is working with crystal clear audio.',
  'Welcome to our project. You can type any sentence here, convert it into speech, and download the MP3 file.',
  'In the quiet of the morning, when the mist lingers above the grass, you can hear the first birds of dawn.',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'unlimited'>('studio');
  const [text, setText] = useState<string>(PRESETS[0]);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<GeneratedClip | null>(null);
  const [history, setHistory] = useState<GeneratedClip[]>([]);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [testingSpeaker, setTestingSpeaker] = useState<boolean>(false);

  const playerRef = useRef<HTMLDivElement | null>(null);

  const wordCount = countWords(text);
  const estimatedSeconds = estimateDuration(wordCount, 150);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxcraft_history');
      if (saved) {
        const parsed: GeneratedClip[] = JSON.parse(saved);
        const hydrated = parsed.map((item) => {
          if (item.base64Audio) {
            return {
              ...item,
              audioUrl: base64ToBlobUrl(item.base64Audio),
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

  // Main Convert function: Synthesize natural human speech and convert to MP3
  const handleConvert = async () => {
    if (!text.trim()) {
      setErrorMessage('Please type some text to convert.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Call server-side high fidelity TTS API
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          style: 'Clear, natural, and expressive human narrator',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Speech generation failed. Please try again.');
      }

      // Convert returned base64 WAV into a Blob URL
      const wavBlobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');

      // Convert WAV to MP3 format immediately
      let mp3BlobUrl: string | undefined = undefined;
      try {
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const mp3Blob = wavArrayBufferToMp3Blob(byteNumbers.buffer, 128);
        mp3BlobUrl = URL.createObjectURL(mp3Blob);
      } catch (mp3Err) {
        console.warn('MP3 conversion fallback:', mp3Err);
      }

      const newClip: GeneratedClip = {
        id: Date.now().toString(),
        text: text.trim(),
        engine: 'gemini',
        voiceName: selectedVoice,
        audioUrl: wavBlobUrl,
        mp3Url: mp3BlobUrl,
        base64Audio: data.audioBase64,
        timestamp: Date.now(),
        duration: estimatedSeconds,
        wordCount,
      };

      setCurrentClip(newClip);
      saveToHistory(newClip);

      // Scroll to player so user immediately sees and hears it
      setTimeout(() => {
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } catch (err: any) {
      console.error('Conversion error:', err);
      setErrorMessage(err.message || 'Unable to convert text to speech.');
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
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                Text to Audio Converter
              </h1>
              <p className="text-xs text-slate-400">Natural voice speech synthesis with MP3 export</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTestSpeaker}
              title="Test if your speakers and browser tab sound are working"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
            >
              <Bell className={`w-3.5 h-3.5 ${testingSpeaker ? 'text-amber-400 animate-bounce' : 'text-emerald-400'}`} />
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
        {/* Mode Switcher */}
        <div className="flex items-center justify-center p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-lg mx-auto shadow-inner">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'studio'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio MP3 (Natural Voice)</span>
          </button>

          <button
            onClick={() => setActiveTab('unlimited')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'unlimited'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <InfinityIcon className="w-3.5 h-3.5" />
            <span>UnlimitedTTS (Local Engine)</span>
          </button>
        </div>

        {activeTab === 'unlimited' ? (
          <UnlimitedTTSView />
        ) : (
          <>
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

        {/* Quick Sample Text */}
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
            placeholder="Type or paste the text you want to convert into speech here..."
            className="w-full h-36 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder-slate-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 resize-y"
          />

          {/* Voice Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Voice:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {VOICES.map((v) => {
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
                    <p className="text-[10px] text-slate-400 leading-tight">{v.vibe}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats & Convert Button */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  <span>Converting Speech...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Convert to Audio & Listen</span>
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <p>Text to Audio Converter • Natural Speech Synthesis & MP3 Export</p>
      </footer>
    </div>
  );
}
