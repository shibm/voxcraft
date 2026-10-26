import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sliders,
  Globe,
  Infinity as InfinityIcon,
  Copy,
  Trash2,
  Check,
  Headphones,
  Info,
} from 'lucide-react';
import { StreamingTTSEngine, StreamingTTSState } from '../utils/streamingTTS';
import { countWords } from '../utils/audio';

export const UnlimitedTTSView: React.FC = () => {
  const [text, setText] = useState<string>(
    `UnlimitedTTS allows you to stream speech continuously with zero word caps. It breaks down large texts, articles, or full documents into structured sentence streams.

You can paste thousands of words here without hitting server limits or character quotas. As the audio streams, the active sentence is highlighted in real-time.

You can click any sentence in the stream to jump straight to that part of the text, pause whenever you need, or skip forward and backward at your own pace.`
  );

  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [streamState, setStreamState] = useState<StreamingTTSState>({
    isPlaying: false,
    isPaused: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    currentSentence: '',
  });
  const [copied, setCopied] = useState<boolean>(false);

  const engineRef = useRef<StreamingTTSEngine | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new StreamingTTSEngine();
    engine.onStateChange((state) => {
      setStreamState(state);
    });
    engineRef.current = engine;

    // Load available browser voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setBrowserVoices(voices);
          if (!selectedVoiceURI) {
            const defaultVoice =
              voices.find((v) => v.lang.startsWith('en') && v.default) ||
              voices.find((v) => v.lang.startsWith('en')) ||
              voices[0];
            if (defaultVoice) {
              setSelectedVoiceURI(defaultVoice.voiceURI);
              engine.setVoice(defaultVoice);
            }
          }
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      engine.stop();
    };
  }, []);

  // Update voice
  useEffect(() => {
    if (!engineRef.current) return;
    const voice = browserVoices.find((v) => v.voiceURI === selectedVoiceURI) || null;
    engineRef.current.setVoice(voice);
  }, [selectedVoiceURI, browserVoices]);

  // Update rate & pitch
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setRate(rate);
    engineRef.current.setPitch(pitch);
  }, [rate, pitch]);

  const handleStart = () => {
    if (!engineRef.current || !text.trim()) return;
    engineRef.current.start(text, 0);
  };

  const handlePause = () => {
    if (!engineRef.current) return;
    engineRef.current.pause();
  };

  const handleResume = () => {
    if (!engineRef.current) return;
    engineRef.current.resume();
  };

  const handleStop = () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
  };

  const handleNext = () => {
    if (!engineRef.current) return;
    engineRef.current.next();
  };

  const handlePrevious = () => {
    if (!engineRef.current) return;
    engineRef.current.previous();
  };

  const handleJumpTo = (idx: number) => {
    if (!engineRef.current) return;
    engineRef.current.jumpTo(idx);
  };

  const sentenceChunks = engineRef.current ? engineRef.current.splitIntoSentences(text) : [];
  const wordCount = countWords(text);
  const progressPercent =
    streamState.totalChunks > 0
      ? Math.round(((streamState.currentChunkIndex + 1) / streamState.totalChunks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Feature Banner */}
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-3 backdrop-blur-sm">
        <InfinityIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white text-sm flex items-center gap-2">
            UnlimitedTTS Streaming Engine Active
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              No Word Caps
            </span>
          </p>
          <p className="text-slate-300 leading-relaxed">
            Uses your browser's local WebSpeech / OS audio engine to stream unlimited text with zero character limits and zero server latency. Bypasses the 15-second browser cutoff automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Text Input & Live Sentence Streamer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <InfinityIcon className="w-4 h-4 text-indigo-400" />
                Unlimited Text Input
              </span>

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="hover:text-white flex items-center gap-1 p-1 hover:bg-slate-800 rounded"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => {
                    setText('');
                    handleStop();
                  }}
                  className="hover:text-red-400 flex items-center gap-1 p-1 hover:bg-slate-800 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (streamState.isPlaying) handleStop();
              }}
              placeholder="Paste any long document, article, or novel text here. There are no word limits or caps..."
              className="w-full h-44 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder-slate-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-sans"
            />

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-3">
                <span><strong>{wordCount}</strong> words</span>
                <span>•</span>
                <span><strong>{text.length}</strong> chars</span>
                <span>•</span>
                <span><strong>{sentenceChunks.length}</strong> sentences</span>
              </div>
              <span className="text-indigo-400 font-mono">Unlimited Capacity</span>
            </div>
          </div>

          {/* Live Sentence Teleprompter View */}
          {sentenceChunks.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                  Interactive Sentence Queue ({sentenceChunks.length})
                </h4>
                {streamState.isPlaying && (
                  <span className="text-[11px] text-indigo-300 font-mono">
                    Sentence {streamState.currentChunkIndex + 1} of {streamState.totalChunks} ({progressPercent}%)
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {streamState.isPlaying && (
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 font-sans text-xs">
                {sentenceChunks.map((sentence, idx) => {
                  const isCurrent = streamState.isPlaying && streamState.currentChunkIndex === idx;
                  const isDone = streamState.isPlaying && streamState.currentChunkIndex > idx;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleJumpTo(idx)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-indigo-600/30 border border-indigo-500 text-white font-medium shadow-sm'
                          : isDone
                          ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500 font-mono mr-2">
                        #{idx + 1}
                      </span>
                      <span>{sentence}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls & Voice Tuning (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            {/* Playback Controls */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Playback Stream Controller:
              </label>

              <div className="flex items-center space-x-2">
                {!streamState.isPlaying ? (
                  <button
                    onClick={handleStart}
                    disabled={!text.trim()}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Stream Unlimited Speech</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePrevious}
                      title="Previous sentence"
                      className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    {streamState.isPaused ? (
                      <button
                        onClick={handleResume}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        onClick={handlePause}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                      >
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </button>
                    )}

                    <button
                      onClick={handleNext}
                      title="Next sentence"
                      className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleStop}
                      title="Stop streaming"
                      className="p-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/40 text-red-200 transition active:scale-95"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Local System Voice */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                Browser / System Voice:
              </label>
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {browserVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Reading Speed</span>
                  <span className="text-indigo-400 font-mono font-semibold">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Voice Pitch</span>
                  <span className="text-indigo-400 font-mono font-semibold">{pitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.1}
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Explanatory Note on File Capture */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Capturing Unlimited Audio as MP3</span>
              </div>
              <p className="leading-relaxed">
                Because local browser TTS pipes sound directly to your soundcard, it cannot be downloaded as an MP3 file directly from JavaScript without a system recorder (like OBS, Audacity, or browser tab audio capture).
              </p>
              <p className="text-indigo-300">
                To download direct <strong>.mp3 files</strong> with one click, switch to the <strong>Studio MP3</strong> tab above!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
