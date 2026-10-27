export type EngineMode = 'browser-speech' | 'wav-synth' | 'gemini' | 'macos-say' | 'local-tts';

export interface NeuralVoice {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  description: string;
  avatarBg: string;
}

export interface TonePreset {
  id: string;
  label: string;
  stylePrompt: string;
  iconName: string;
  description: string;
}

export interface GeneratedClip {
  id: string;
  text: string;
  engine: EngineMode;
  voiceName: string;
  stylePrompt?: string;
  audioUrl: string;
  mp3Url?: string;
  base64Audio?: string;
  timestamp: number;
  duration?: number;
  wordCount: number;
}
