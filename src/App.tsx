import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Sparkles,
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Wand2,
  Headphones,
  Sliders,
  Globe,
  Bell,
  Code2,
  HelpCircle,
  VolumeX,
} from 'lucide-react';
import { EngineMode, NeuralVoice, TonePreset, GeneratedClip } from './types';
import {
  base64ToBlobUrl,
  countWords,
  estimateDuration,
  formatTime,
} from './utils/audio';
import { synthesizeTextToWAV } from './utils/offlineSynth';
import { playTestChime } from './utils/soundTest';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryList } from './components/HistoryList';
import { Visualizer } from './components/Visualizer';
import { NoAiGuide } from './components/NoAiGuide';

const NEURAL_VOICES: NeuralVoice[] = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    description: 'Clear, balanced, warm & expressive tone. Ideal for storytelling & narration.',
    avatarBg: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Male',
    description: 'Energetic, dynamic & conversational. Perfect for podcasts and tutorials.',
    avatarBg: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    description: 'Deep, resonant & authoritative. Great for documentaries and audiobooks.',
    avatarBg: 'from-amber-500 to-orange-600',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Female',
    description: 'Gentle, soothing & friendly. Ideal for relaxation, mindfulness & guides.',
    avatarBg: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    description: 'Calm, mature & contemplative. Excellent for news briefings and articles.',
    avatarBg: 'from-rose-500 to-pink-600',
  },
];

const TONE_PRESETS: TonePreset[] = [
  {
    id: 'natural',
    label: 'Natural Narrator',
    stylePrompt: 'Clear, expressive and natural audiobook narrator',
    iconName: 'BookOpen',
    description: 'Standard studio quality with natural cadence',
  },
  {
    id: 'enthusiastic',
    label: 'Upbeat & Friendly',
    stylePrompt: 'Enthusiastic, cheerful and engaging podcast host',
    iconName: 'Smile',
    description: 'Bright, energetic and conversational',
  },
  {
    id: 'calm',
    label: 'Calm & Relaxing',
    stylePrompt: 'Soothing, gentle, slow-paced meditation guide',
    iconName: 'Cloud',
    description: 'Soft and peaceful for mindfulness',
  },
  {
    id: 'news',
    label: 'News Anchor',
    stylePrompt: 'Clear, authoritative, professional broadcast journalist',
    iconName: 'Radio',
    description: 'Direct, formal and crisp delivery',
  },
  {
    id: 'dramatic',
    label: 'Dramatic & Cinematic',
    stylePrompt: 'Dramatic, intense and cinematic movie trailer narrator',
    iconName: 'Flame',
    description: 'Bold with dynamic emotional pauses',
  },
];

const SAMPLE_TEXTS = [
  {
    title: 'Standard Greeting',
    text: 'Hello! Welcome to VoxCraft. You can convert any text into audible speech and downloadable sound files directly in your browser without needing AI.',
  },
  {
    title: 'Audiobook Reading',
    text: 'Far beyond the misty mountains, where ancient rivers whisper to the stone, a quiet traveler paused beneath the twilight canopy, listening to the gentle rhythm of the night.',
  },
  {
    title: 'Tech Explanation',
    text: 'Before machine learning, speech synthesis relied on formant resonance filters and acoustic phoneme tables. Today, Web Audio API can generate wave forms directly in JavaScript.',
  },
  {
    title: 'Quick Sound Check',
    text: 'Testing one, two, three. If you can hear this audio, your speakers and sound hardware are working perfectly.',
  },
];

export default function App() {
  // Input state - Default to 100% offline WAV synthesizer (always produces audible sound)
  const [text, setText] = useState<string>(SAMPLE_TEXTS[0].text);
  const [engine, setEngine] = useState<EngineMode>('wav-synth');
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);
  const [testingSpeaker, setTestingSpeaker] = useState<boolean>(false);

  // Offline WAV Synthesizer state
  const [synthTone, setSynthTone] = useState<'natural' | 'retro'>('natural');

  // Browser speech state (Web Speech API)
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [pitch, setPitch] = useState<number>(1);
  const [rate, setRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isBrowserSpeaking, setIsBrowserSpeaking] = useState<boolean>(false);
  const [isBrowserPaused, setIsBrowserPaused] = useState<boolean>(false);
  const [currentSpokenWord, setCurrentSpokenWord] = useState<string>('');
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Gemini state (optional)
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [selectedTone, setSelectedTone] = useState<TonePreset>(TONE_PRESETS[0]);
  const [customStyle, setCustomStyle] = useState<string>('');
  const [useCustomStyle, setUseCustomStyle] = useState<boolean>(false);

  // App & Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<GeneratedClip | null>(null);
  const [history, setHistory] = useState<GeneratedClip[]>([]);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const wordCount = countWords(text);
  const estimatedSeconds = estimateDuration(wordCount, Math.round(150 * rate));

  // Initialize and load system voices safely
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      try {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          setBrowserVoices(available);
          if (!selectedBrowserVoiceURI) {
            const defaultVoice =
              available.find((v) => v.lang.startsWith('en') && v.default) ||
              available.find((v) => v.lang.startsWith('en')) ||
              available[0];
            if (defaultVoice) {
              setSelectedBrowserVoiceURI(defaultVoice.voiceURI);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading speech voices:', err);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const timer = setTimeout(loadVoices, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [selectedBrowserVoiceURI]);

  // Load history from localStorage or create initial sample clip
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
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load history', e);
    }

    // Auto-generate initial sample clip so user has immediate playable audio
    try {
      const { url, duration } = synthesizeTextToWAV(SAMPLE_TEXTS[3].text, {
        pitch: 160,
        speed: 1.0,
        mode: 'natural',
      });
      const initialClip: GeneratedClip = {
        id: 'sample-1',
        text: SAMPLE_TEXTS[3].text,
        engine: 'wav-synth',
        voiceName: 'Vocal Formant Synthesizer',
        audioUrl: url,
        timestamp: Date.now(),
        duration: Math.round(duration),
        wordCount: countWords(SAMPLE_TEXTS[3].text),
      };
      setCurrentClip(initialClip);
    } catch {
      // Fallback
    }
  }, []);

  const saveToHistory = (clip: GeneratedClip) => {
    setHistory((prev) => {
      const updated = [clip, ...prev.filter((c) => c.id !== clip.id)].slice(0, 20);
      try {
        localStorage.setItem('voxcraft_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to localStorage', e);
      }
      return updated;
    });
  };

  // Sound Test Helper
  const handleTestSpeaker = async () => {
    setTestingSpeaker(true);
    const played = await playTestChime();
    setTestingSpeaker(false);
    if (!played) {
      setErrorMessage(
        'Unable to play test sound. Please make sure your computer volume is up and the browser tab is unmuted.'
      );
    }
  };

  // 1. NON-AI: Offline WAV Generator (Direct HTML5 Audio - Guaranteed Sound)
  const handleGenerateOfflineWav = () => {
    if (!text.trim()) {
      setErrorMessage('Please enter some text to convert into audio.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const baseFreq = pitch * 150;
      const { url, duration } = synthesizeTextToWAV(text, {
        pitch: baseFreq,
        speed: rate,
        mode: synthTone,
      });

      const newClip: GeneratedClip = {
        id: Date.now().toString(),
        text: text.trim(),
        engine: 'wav-synth',
        voiceName: synthTone === 'natural' ? 'Vocal Formant Synth' : 'Retro 8-Bit Synth',
        audioUrl: url,
        timestamp: Date.now(),
        duration: Math.round(duration),
        wordCount,
      };

      setCurrentClip(newClip);
      saveToHistory(newClip);
    } catch (err: any) {
      console.error('Offline WAV generation error:', err);
      setErrorMessage(err.message || 'Failed to synthesize offline WAV.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. NON-AI: Native Web Speech API SpeechSynthesis
  const handleBrowserSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setErrorMessage(
        'Speech synthesis is not supported in this browser. Please use the "Offline WAV Synth" mode instead.'
      );
      return;
    }

    if (!text.trim()) {
      setErrorMessage('Please enter some text to speak.');
      return;
    }

    setErrorMessage(null);

    // If currently paused, resume
    if (isBrowserPaused) {
      window.speechSynthesis.resume();
      setIsBrowserPaused(false);
      setIsBrowserSpeaking(true);
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text.trim());
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        const chosenVoice = browserVoices.find((v) => v.voiceURI === selectedBrowserVoiceURI);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        activeUtteranceRef.current = utterance;
        (window as any)._activeUtterance = utterance;

        utterance.onboundary = (e) => {
          if (e.name === 'word') {
            const word = text.substring(e.charIndex, e.charIndex + e.charLength);
            setCurrentSpokenWord(word);
          }
        };

        utterance.onstart = () => {
          setIsBrowserSpeaking(true);
          setIsBrowserPaused(false);
        };

        utterance.onpause = () => {
          setIsBrowserPaused(true);
        };

        utterance.onresume = () => {
          setIsBrowserPaused(false);
          setIsBrowserSpeaking(true);
        };

        utterance.onend = () => {
          setIsBrowserSpeaking(false);
          setIsBrowserPaused(false);
          setCurrentSpokenWord('');
          activeUtteranceRef.current = null;
        };

        utterance.onerror = (e) => {
          if (e.error === 'interrupted' || e.error === 'canceled') {
            setIsBrowserSpeaking(false);
            setIsBrowserPaused(false);
            return;
          }
          console.error('Speech error:', e);
          setIsBrowserSpeaking(false);
          setIsBrowserPaused(false);
          setErrorMessage(
            `Speech note: ${e.error || 'Blocked by browser iframe'}. Try switching to "Offline WAV Synth (No AI)" above for guaranteed sound!`
          );
        };

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        console.error('Speech start error:', err);
        setErrorMessage(
          'Could not start browser speech. Try "Offline WAV Synth (No AI)" mode which works through standard audio elements!'
        );
      }
    }, 50);
  };

  const handleBrowserPause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (isBrowserPaused) {
        window.speechSynthesis.resume();
        setIsBrowserPaused(false);
        setIsBrowserSpeaking(true);
      } else {
        window.speechSynthesis.pause();
        setIsBrowserPaused(true);
      }
    }
  };

  const handleBrowserStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsBrowserSpeaking(false);
      setIsBrowserPaused(false);
      setCurrentSpokenWord('');
      activeUtteranceRef.current = null;
    }
  };

  // 3. OPTIONAL AI: Gemini Cloud TTS
  const handleGenerateGemini = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setErrorMessage(null);

    const styleToUse = useCustomStyle
      ? customStyle.trim() || selectedTone.stylePrompt
      : selectedTone.stylePrompt;

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          style: styleToUse,
          model: 'gemini-3.8-flash-lite-tts',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Gemini TTS unavailable. Switching to Offline mode.'
        );
      }

      if (!data.audioBase64) {
        throw new Error('No audio returned from speech engine.');
      }

      const audioBlobUrl = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');

      const newClip: GeneratedClip = {
        id: Date.now().toString(),
        text: text.trim(),
        engine: 'gemini',
        voiceName: selectedVoice,
        stylePrompt: styleToUse,
        audioUrl: audioBlobUrl,
        base64Audio: data.audioBase64,
        timestamp: Date.now(),
        duration: estimatedSeconds,
        wordCount,
      };

      setCurrentClip(newClip);
      saveToHistory(newClip);
    } catch (err: any) {
      console.error('Gemini error:', err);
      setErrorMessage(
        `${err.message || 'Error occurred.'} Click "Offline WAV Synth" to generate audio without any AI.`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConvert = () => {
    if (engine === 'wav-synth') {
      handleGenerateOfflineWav();
    } else if (engine === 'browser-speech') {
      handleBrowserSpeak();
    } else {
      handleGenerateGemini();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConvert();
    }
  };

  const handleClear = () => {
    setText('');
    handleBrowserStop();
    setErrorMessage(null);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setText(clipText);
    } catch {
      // Ignore
    }
  };

  const handleSelectClip = (clip: GeneratedClip) => {
    setCurrentClip(clip);
    setText(clip.text);
  };

  const handleDeleteClip = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem('voxcraft_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to localStorage', e);
      }
      return updated;
    });
    if (currentClip?.id === id) {
      setCurrentClip(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('voxcraft_history');
    } catch (e) {
      console.warn('Failed to clear localStorage', e);
    }
  };

  const filteredVoices = browserVoices.filter((v) => {
    if (languageFilter === 'all') return true;
    return v.lang.toLowerCase().startsWith(languageFilter);
  });

  const uniqueLanguages = Array.from(
    new Set(browserVoices.map((v) => v.lang.split('-')[0].toLowerCase()))
  ).sort();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-emerald-600/15 via-teal-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-slate-900/40 blur-3xl" />
      </div>

      {/* Main Top Navigation */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">VoxCraft</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Text to Audio
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Convert text into audio • Guaranteed sound & offline</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Speaker Sound Test Button */}
            <button
              onClick={handleTestSpeaker}
              title="Click to play a chime sound and test if your speakers are working"
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition active:scale-95"
            >
              <Bell className={`w-3.5 h-3.5 ${testingSpeaker ? 'text-amber-300 animate-bounce' : 'text-emerald-400'}`} />
              <span>{testingSpeaker ? 'Chime playing...' : 'Test Sound 🔔'}</span>
            </button>

            <button
              onClick={() => setShowTroubleshoot(!showTroubleshoot)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Sound troubleshooting guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
                showGuide
                  ? 'bg-slate-800 text-white border-slate-700'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">How it works without AI</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sound Troubleshooting Banner (Helps users diagnose silence) */}
        {showTroubleshoot && (
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 text-xs text-slate-300 space-y-2 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-white text-sm">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Why can't I hear anything? (3 Quick Checks)</span>
              </div>
              <button
                onClick={() => setShowTroubleshoot(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <strong className="text-white block mb-1">1. Check Tab Sound</strong>
                <p className="text-slate-400">
                  Right-click the browser tab and make sure <strong>"Unmute site"</strong> is selected, and your computer volume is turned up.
                </p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <strong className="text-white block mb-1">2. Run "Test Sound 🔔"</strong>
                <p className="text-slate-400">
                  Click the <strong>Test Sound 🔔</strong> button in the top right. If you hear the chime, your speakers are working!
                </p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <strong className="text-white block mb-1">3. Use "Offline WAV Synth"</strong>
                <p className="text-slate-400">
                  Browser speech synthesis can be blocked by Chrome iframes. The <strong>"Offline WAV Synth"</strong> mode generates a real audio file that plays reliably.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3 backdrop-blur-sm shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Notice</p>
              <p className="text-xs text-red-200/90 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs px-2 py-1 bg-red-900/60 hover:bg-red-800 rounded text-red-200 transition"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Engine Selection Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2 shadow-xl backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold uppercase px-2 tracking-wider">
              Audio Engine:
            </span>

            {/* Mode 1: Offline WAV Synthesizer (No AI - Standard WAV file, guaranteed sound) */}
            <button
              onClick={() => {
                setEngine('wav-synth');
                handleBrowserStop();
                setErrorMessage(null);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                engine === 'wav-synth'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Offline WAV Synth (No AI)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-normal">
                Direct Sound
              </span>
            </button>

            {/* Mode 2: Device Speech (Web Speech API) */}
            <button
              onClick={() => {
                setEngine('browser-speech');
                setErrorMessage(null);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                engine === 'browser-speech'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Device Speech API</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-normal">
                OS Voices
              </span>
            </button>

            {/* Mode 3: AI Neural Studio */}
            <button
              onClick={() => {
                setEngine('gemini');
                handleBrowserStop();
                setErrorMessage(null);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                engine === 'gemini'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Cloud Studio</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 px-3 hidden md:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {engine === 'wav-synth' && 'Pure JS Formant Synth • Generates real WAV audio file'}
              {engine === 'browser-speech' && 'Web Speech API • Speaks through OS speech engine'}
              {engine === 'gemini' && 'Cloud Neural Voices • High-fidelity studio synthesis'}
            </span>
          </div>
        </div>

        {/* Informative Educational Guide (if toggled) */}
        {showGuide && <NoAiGuide />}

        {/* Quick Sample Text Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
            <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Samples:
          </span>
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.title}
              onClick={() => {
                setText(sample.text);
                handleBrowserStop();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition whitespace-nowrap active:scale-95"
            >
              {sample.title}
            </button>
          ))}
        </div>

        {/* Studio Grid: Input on Left, Audio Controls on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Text Input (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white tracking-wide">
                    Input Text
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="p-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                  >
                    Paste
                  </button>
                  <button
                    onClick={handleCopyText}
                    title="Copy text"
                    className="p-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition flex items-center gap-1"
                  >
                    {copiedText ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleClear}
                    title="Clear text"
                    className="p-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <div className="relative flex-1 min-h-[200px]">
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (isBrowserSpeaking) handleBrowserStop();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type or paste any text to convert into audio here..."
                  className="w-full h-full min-h-[200px] bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 text-sm leading-relaxed resize-y font-sans transition"
                />
              </div>

              {/* Live Word Tracker when Device Speech is speaking */}
              {isBrowserSpeaking && currentSpokenWord && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Speaking word: <strong className="text-white text-sm">"{currentSpokenWord}"</strong>
                  </span>
                  <span className="text-[11px] text-emerald-400/80">Active</span>
                </div>
              )}

              {/* Footer Meta & Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-4">
                  <span>
                    <strong className="text-slate-200 font-semibold">{wordCount}</strong> words
                  </span>
                  <span>
                    <strong className="text-slate-200 font-semibold">{text.length}</strong> chars
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Headphones className="w-3 h-3" /> ~{formatTime(estimatedSeconds)} duration
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Ctrl+Enter</kbd> to convert
                </div>
              </div>

              {/* Action Buttons based on active engine */}
              <div className="pt-4 space-y-2">
                {engine === 'wav-synth' && (
                  <button
                    onClick={handleGenerateOfflineWav}
                    disabled={isGenerating || !text.trim()}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.99] ${
                      isGenerating || !text.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                    <span>Convert Text to Audio (No AI • Playable WAV)</span>
                  </button>
                )}

                {engine === 'browser-speech' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConvert}
                      disabled={!text.trim()}
                      className={`flex-1 py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.99] ${
                        !text.trim()
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          : isBrowserSpeaking
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isBrowserSpeaking ? 'Restart Speech' : 'Speak Text Out Loud (No AI)'}</span>
                    </button>

                    {isBrowserSpeaking && (
                      <>
                        <button
                          onClick={handleBrowserPause}
                          className="px-4 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition"
                          title={isBrowserPaused ? 'Resume' : 'Pause'}
                        >
                          <Pause className="w-4 h-4" />
                          <span>{isBrowserPaused ? 'Resume' : 'Pause'}</span>
                        </button>

                        <button
                          onClick={handleBrowserStop}
                          className="px-4 py-4 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-200 font-medium text-xs flex items-center gap-1.5 transition"
                          title="Stop"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {engine === 'gemini' && (
                  <button
                    onClick={handleGenerateGemini}
                    disabled={isGenerating || !text.trim()}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.99] ${
                      isGenerating || !text.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Synthesizing Studio Audio with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Convert with AI Studio Neural Voice</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Voice & Audio Settings (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Mode 1: Offline WAV Synth Settings */}
            {engine === 'wav-synth' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 backdrop-blur-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      Direct Audio Synthesizer
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                      100% Offline • No AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Generates a real 16-bit WAV audio file directly from text using acoustic formant synthesis:
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setSynthTone('natural')}
                      className={`p-3 rounded-xl border text-left transition ${
                        synthTone === 'natural'
                          ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-semibold">Formant Vocal</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Vowel frequencies (F1/F2/F3) & consonants
                      </p>
                    </button>

                    <button
                      onClick={() => setSynthTone('retro')}
                      className={`p-3 rounded-xl border text-left transition ${
                        synthTone === 'retro'
                          ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-semibold">Retro Chiptune</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Classic 8-bit pulse synthesizer
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Speed (Rate)</span>
                      <span className="text-emerald-400 font-mono font-semibold">{rate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.8}
                      step={0.1}
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Voice Pitch</span>
                      <span className="text-emerald-400 font-mono font-semibold">
                        {Math.round(pitch * 150)} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.6}
                      step={0.1}
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300/90">
                  💡 This engine outputs a <strong>standard .WAV audio file</strong> that plays through your browser's audio hardware and can be downloaded immediately.
                </div>
              </div>
            )}

            {/* Mode 2: Browser Speech Settings */}
            {engine === 'browser-speech' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 backdrop-blur-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      Installed Device Voices
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                      {browserVoices.length} Voices
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">
                    Voices provided directly by your operating system:
                  </p>

                  {uniqueLanguages.length > 1 && (
                    <div className="mb-3 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <label className="text-[11px] text-slate-400">Language:</label>
                      <select
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="all">All Languages ({browserVoices.length})</option>
                        {uniqueLanguages.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <select
                    value={selectedBrowserVoiceURI}
                    onChange={(e) => setSelectedBrowserVoiceURI(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {filteredVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4 pt-3 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Speed (Rate)</span>
                      <span className="text-emerald-400 font-mono font-semibold">{rate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Voice Pitch</span>
                      <span className="text-emerald-400 font-mono font-semibold">{pitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.1}
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300/90">
                  ⚠️ Note: In some browser iframes, the Web Speech API may be muted by security policies. If you don't hear sound, use <strong>"Offline WAV Synth"</strong>!
                </div>
              </div>
            )}

            {/* Mode 3: Gemini Cloud AI Settings */}
            {engine === 'gemini' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 backdrop-blur-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Neural Voice Persona
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-medium">
                      Cloud Neural
                    </span>
                  </div>

                  <div className="space-y-2">
                    {NEURAL_VOICES.map((voice) => {
                      const isSelected = selectedVoice === voice.id;
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedVoice(voice.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-950/60'
                              : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${voice.avatarBg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                              >
                                {voice.name[0]}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-white">{voice.name}</span>
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                  {voice.gender}
                                </span>
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="neuralVoice"
                              checked={isSelected}
                              onChange={() => setSelectedVoice(voice.id)}
                              className="accent-purple-500 cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                            {voice.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-white">Tone & Style</h3>
                    <button
                      onClick={() => setUseCustomStyle(!useCustomStyle)}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      {useCustomStyle ? 'Use Presets' : 'Custom'}
                    </button>
                  </div>

                  {!useCustomStyle ? (
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_PRESETS.map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => setSelectedTone(tone)}
                          className={`p-2 rounded-lg border text-left text-xs ${
                            selectedTone.id === tone.id
                              ? 'bg-purple-950/60 border-purple-500 text-white'
                              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <p className="font-semibold truncate">{tone.label}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                      placeholder="e.g. Enthusiastic sports anchor..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio Player Section - Guaranteed audible output */}
        {currentClip && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                Active Playable Audio
              </h3>
              <span className="text-xs text-slate-400">Click Play below to hear sound</span>
            </div>
            <AudioPlayer
              audioUrl={currentClip.audioUrl}
              title={`Audio Clip: "${currentClip.text.slice(0, 38)}..."`}
              voiceName={currentClip.voiceName}
              autoPlay={false}
            />
          </div>
        )}

        {/* History Gallery */}
        <HistoryList
          clips={history}
          onSelectClip={handleSelectClip}
          onDeleteClip={handleDeleteClip}
          onClearAll={handleClearHistory}
          activeClipId={currentClip?.id}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 py-5 text-center text-xs text-slate-500">
        <p>VoxCraft • Text-to-Audio with Web Speech API & Pure JavaScript WAV Synthesis</p>
      </footer>
    </div>
  );
}
