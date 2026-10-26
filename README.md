# Local Voice - Offline Text-to-Audio Converter (Zero AI)

A 100% local, offline text-to-speech converter that runs entirely on local acoustic synthesis without any AI, external APIs, cloud keys, or internet requests. Converts text into audible speech and downloadable standard **MP3** and **WAV** audio files.

---

## Key Features

- **0% AI, 100% Offline**: Runs entirely on the local system using acoustic phoneme speech synthesis (`espeak-ng`). No neural models, no API tokens, no billing, and no data leaves your machine.
- **Guaranteed Audible Playback**: Audio is synthesized into real 16-bit PCM WAV / MP3 buffers that play through the standard HTML5 `<audio>` engine and Web Audio API, completely bypassing the Chrome iframe `SpeechSynthesis` muting bug.
- **Direct MP3 & WAV Downloads**: Export any converted audio into universal **MP3** (128 kbps) or lossless **WAV** with a single click.
- **Multiple Local Voice Profiles**:
  - **US English (Standard Male)**
  - **US English (Natural Female 1)**
  - **US English (Soft Female 2)**
  - **US English (Deep Resonant Male)**
  - **British English (Great Britain)**
  - **Scottish English**
  - **Whisper Mode Voice**
- **Full Playback Controls**: Interactive scrubber, volume slider, speed multiplier (0.5x to 2.0x), voice pitch adjustment, and animated frequency visualizer.
- **Unlimited Text Processing**: No character quotas, word caps, or time limits.
- **Audio Upload & Inspector**: Upload any `.mp3` or `.wav` from your device to listen and inspect its waveform directly in the player.

---

## Why Previous Browser Speech Was Silent (And How This Fixes It)

In Chromium-based browsers (Chrome, Edge, Brave), calling `window.speechSynthesis.speak()` inside cross-origin preview iframes is silenced by default due to browser security and permission policies (Chromium Issue #811403).

### The Solution:
Instead of relying on the browser's restricted `speechSynthesis` API, this application uses a **local audio pipeline**:
1. The text is synthesized by the local offline acoustic engine (`espeak-ng`).
2. The waveform is encoded directly into standard **MP3 / WAV** audio buffers.
3. The audio is streamed directly to the browser's hardware speaker pipeline via HTML5 `<audio>` elements and Web Audio API (`AudioContext`).
4. **Result:** Sound plays out of your physical speakers 100% reliably in all browsers and iframes.

---

## Architecture & Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Interactive UI with responsive playback |
| **Styling** | Tailwind CSS v4 | Dark mode studio interface |
| **Local Speech Engine** | `espeak-ng` | 100% offline acoustic phoneme speech synthesis |
| **Local Audio Encoder** | `ffmpeg` + `@breezystack/lamejs` | Standard 128 kbps MP3 & WAV encoding |
| **Audio Routing** | HTML5 Audio + Web Audio API | Direct hardware speaker playback |
| **Icons** | Lucide React | Clean, accessible UI icons |

---

## API Reference (100% Local, Zero AI)

### `POST /api/tts/generate`
Synthesizes speech on the local machine and returns base64 MP3 audio.

#### Request Body (JSON):
```json
{
  "text": "Hello world, this is a local offline speech test.",
  "voice": "en-us+f2",
  "speed": 160,
  "pitch": 50
}
```

#### Response (JSON):
```json
{
  "success": true,
  "audioBase64": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2...",
  "mimeType": "audio/mp3",
  "voice": "en-us+f2",
  "engine": "local-espeak-ng",
  "speed": 160,
  "pitch": 50
}
```

---

## Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Ensure Local Speech Engine is Installed**:
   - **Linux / Ubuntu**:
     ```bash
     sudo apt-get install espeak-ng ffmpeg
     ```
   - **macOS** (via Homebrew):
     ```bash
     brew install espeak-ng ffmpeg
     ```
   - **Windows** (via Chocolatey or Scoop):
     ```powershell
     choco install espeak-ng ffmpeg
     ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## License
MIT License. Completely open source and free for personal or commercial use.
