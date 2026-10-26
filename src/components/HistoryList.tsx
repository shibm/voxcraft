import React from 'react';
import {
  Play,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { GeneratedClip } from '../types';
import { downloadAudio, formatTime } from '../utils/audio';

interface HistoryListProps {
  clips: GeneratedClip[];
  onSelectClip: (clip: GeneratedClip) => void;
  onDeleteClip: (id: string) => void;
  onClearAll: () => void;
  activeClipId?: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  clips,
  onSelectClip,
  onDeleteClip,
  onClearAll,
  activeClipId,
}) => {
  if (clips.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
        <Volume2 className="w-10 h-10 mx-auto mb-3 text-slate-600 stroke-[1.5]" />
        <p className="text-sm font-medium text-slate-400">No generated clips yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Type or paste text above and hit Convert to generate your first audio clip.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Recent Audio Creations ({clips.length})
          </h3>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-red-400 transition flex items-center gap-1 p-1 hover:bg-slate-800 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {clips.map((clip) => {
          const isActive = clip.id === activeClipId;
          const timeAgo = new Date(clip.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={clip.id}
              className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/50'
                  : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                    {clip.voiceName}
                  </span>
                  {clip.engine === 'gemini' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AI Studio
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">{timeAgo}</span>
                  {clip.duration && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      • {formatTime(clip.duration)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-sans">
                  "{clip.text}"
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => onSelectClip(clip)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/80 hover:bg-indigo-600 text-slate-200 hover:text-white'
                  }`}
                  title="Play this clip"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isActive ? 'Active' : 'Play'}</span>
                </button>

                <button
                  onClick={async () => {
                    const filename = `voxcraft-${clip.voiceName.toLowerCase()}-${clip.id}.mp3`;
                    if (clip.mp3Url) {
                      downloadAudio(clip.mp3Url, filename);
                    } else {
                      try {
                        const { wavArrayBufferToMp3Blob } = await import('../utils/mp3Encoder');
                        const resp = await fetch(clip.audioUrl);
                        const arrayBuffer = await resp.arrayBuffer();
                        const mp3Blob = wavArrayBufferToMp3Blob(arrayBuffer);
                        downloadAudio(URL.createObjectURL(mp3Blob), filename);
                      } catch {
                        downloadAudio(clip.audioUrl, filename.replace('.mp3', '.wav'));
                      }
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 transition flex items-center gap-1 text-[11px]"
                  title="Download MP3"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">MP3</span>
                </button>

                <button
                  onClick={() => onDeleteClip(clip.id)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                  title="Delete clip"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
