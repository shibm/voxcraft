import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Repeat,
  Check,
  Share2,
  Bell,
} from 'lucide-react';
import { Visualizer } from './Visualizer';
import { formatTime, downloadAudio } from '../utils/audio';
import { playTestChime } from '../utils/soundTest';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  voiceName?: string;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title = 'Generated Audio',
  voiceName = 'Audio Voice',
  autoPlay = true,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNativeControls, setShowNativeControls] = useState(false);
  const [testingSpeaker, setTestingSpeaker] = useState(false);

  // When audioUrl changes, reset and play
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setCurrentTime(0);
    audio.volume = volume;
    audio.muted = isMuted;

    if (autoPlay) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Autoplay prevented by browser, waiting for user click:', err);
          setIsPlaying(false);
        });
    } else {
      setIsPlaying(false);
    }
  }, [audioUrl, autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = isMuted ? 0 : volume || 1;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.volume = isMuted ? 0 : volume || 1;
    audio.play().then(() => setIsPlaying(true));
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 0.8;
      audio.muted = false;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      audio.muted = true;
      setIsMuted(true);
    }
  };

  const toggleLoop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = !isLooping;
    setIsLooping(!isLooping);
  };

  const handleEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleDownload = () => {
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadAudio(audioUrl, `voxcraft-${voiceName.toLowerCase().replace(/\s+/g, '-')}-${dateStr}.wav`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeakerTest = async () => {
    setTestingSpeaker(true);
    await playTestChime();
    setTestingSpeaker(false);
  };

  const speeds = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
      {/* Native Audio Element with direct hardware routing */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="auto"
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h4 className="text-white font-semibold text-base tracking-wide flex items-center gap-2">
              {title}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                {voiceName}
              </span>
            </h4>
            <p className="text-xs text-slate-400">Playable Audio • Standard 16-bit WAV</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSpeakerTest}
            title="Play a test sound to verify your speakers are working"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1.5"
          >
            <Bell className={`w-3.5 h-3.5 ${testingSpeaker ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
            <span>{testingSpeaker ? 'Playing...' : 'Test Speaker'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            title="Copy share link"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          <button
            onClick={handleDownload}
            title="Download WAV Audio file"
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download WAV</span>
          </button>
        </div>
      </div>

      {/* Audio Visualizer */}
      <div className="mb-4">
        <Visualizer isPlaying={isPlaying} colorTheme="emerald" />
      </div>

      {/* Scrubber Progress Bar */}
      <div className="space-y-1 mb-4">
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
        {/* Core Controls: Restart, Big Play/Pause Button, Loop */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRestart}
            title="Restart playback from beginning"
            className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition font-bold"
            title={isPlaying ? 'Pause' : 'Play audio out loud'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            onClick={toggleLoop}
            className={`p-2.5 rounded-full transition active:scale-95 ${
              isLooping
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={isLooping ? 'Looping enabled' : 'Looping disabled'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700/60">
          <span className="text-[11px] font-medium text-slate-400 px-2">Speed:</span>
          {speeds.map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-1 text-xs rounded font-medium transition ${
                playbackRate === rate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            title="Volume"
          />
        </div>
      </div>

      {/* Toggle Native Browser Audio Player Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Browser Hardware Audio Player:</span>
          <button
            onClick={() => setShowNativeControls(!showNativeControls)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            {showNativeControls ? 'Hide Native Controls' : 'Show Native HTML5 Audio Bar'}
          </button>
        </div>
        {showNativeControls && (
          <audio controls src={audioUrl} className="w-full h-10 mt-1 rounded" />
        )}
      </div>
    </div>
  );
};
