/**
 * UnlimitedTTS Streaming Engine
 * 
 * Splits unlimited text into natural sentence chunks and streams them
 * sequentially using the browser's local SpeechSynthesis engine.
 * Bypasses Chrome's 15-second speech cutoff bug using interval heartbeats.
 */

export interface StreamingTTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  currentSentence: string;
}

export class StreamingTTSEngine {
  private chunks: string[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = 0 ? true : false;
  private isPaused: boolean = false;
  private voice: SpeechSynthesisVoice | null = null;
  private rate: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private keepAliveTimer: any = null;

  private onStateChangeCallback?: (state: StreamingTTSState) => void;

  constructor() {}

  public setVoice(voice: SpeechSynthesisVoice | null) {
    this.voice = voice;
  }

  public setRate(rate: number) {
    this.rate = rate;
  }

  public setPitch(pitch: number) {
    this.pitch = pitch;
  }

  public setVolume(volume: number) {
    this.volume = volume;
  }

  public onStateChange(callback: (state: StreamingTTSState) => void) {
    this.onStateChangeCallback = callback;
  }

  private emitState() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentChunkIndex: this.currentIndex,
        totalChunks: this.chunks.length,
        currentSentence: this.chunks[this.currentIndex] || '',
      });
    }
  }

  /**
   * Splits unlimited text into clean, manageable sentence chunks
   */
  public splitIntoSentences(text: string): string[] {
    if (!text.trim()) return [];

    // Split by sentence terminators while preserving flow
    const rawChunks = text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.?!;:\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const mergedChunks: string[] = [];
    let buffer = '';

    // Merge very short fragments (< 3 words) with the next sentence for natural cadence
    for (const chunk of rawChunks) {
      if (buffer.length === 0) {
        buffer = chunk;
      } else if (buffer.length < 35 && !buffer.endsWith('\n')) {
        buffer += ' ' + chunk;
      } else {
        mergedChunks.push(buffer);
        buffer = chunk;
      }
    }
    if (buffer) {
      mergedChunks.push(buffer);
    }

    return mergedChunks.length > 0 ? mergedChunks : [text.trim()];
  }

  /**
   * Starts streaming speech from chunk 0 (or a specified index)
   */
  public start(text: string, startIndex: number = 0) {
    this.stop();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported in this environment');
      return;
    }

    this.chunks = this.splitIntoSentences(text);
    if (this.chunks.length === 0) return;

    this.currentIndex = Math.max(0, Math.min(startIndex, this.chunks.length - 1));
    this.isPlaying = true;
    this.isPaused = false;

    this.startKeepAlive();
    this.speakCurrentChunk();
  }

  private speakCurrentChunk() {
    if (!this.isPlaying || this.currentIndex >= this.chunks.length) {
      this.stop();
      return;
    }

    const sentence = this.chunks[this.currentIndex];
    this.emitState();

    try {
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      if (this.voice) {
        utterance.voice = this.voice;
      }

      // Avoid Chrome garbage collection bug
      (window as any)._streamingUtterance = utterance;

      utterance.onend = () => {
        if (!this.isPlaying || this.isPaused) return;
        this.currentIndex++;
        if (this.currentIndex < this.chunks.length) {
          // Speak next sentence in stream
          setTimeout(() => this.speakCurrentChunk(), 60);
        } else {
          this.stop();
        }
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        console.warn('Streaming utterance error:', e.error);
        // Advance to next chunk on non-fatal error
        this.currentIndex++;
        setTimeout(() => this.speakCurrentChunk(), 60);
      };

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('SpeechSynthesis error in chunk:', err);
      this.stop();
    }
  }

  /**
   * Chrome 14-second cutoff fix:
   * Chrome has an internal bug where speechSynthesis silently freezes after 14 seconds.
   * Periodically calling pause() and resume() keeps the engine alive indefinitely.
   */
  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  public pause() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.emitState();
    }
  }

  public resume() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.emitState();
    }
  }

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.stopKeepAlive();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.emitState();
  }

  public next() {
    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.speakCurrentChunk();
    }
  }

  public previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.speakCurrentChunk();
    }
  }

  public jumpTo(index: number) {
    if (index >= 0 && index < this.chunks.length) {
      this.currentIndex = index;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.speakCurrentChunk();
    }
  }
}
