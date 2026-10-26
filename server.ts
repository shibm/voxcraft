import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint: Generate Speech via Gemini TTS
app.post('/api/tts/generate', async (req, res) => {
  try {
    const {
      text,
      voice = 'Kore',
      style = 'Clear, expressive and natural narrator',
      model = 'gemini-3.8-flash-lite-tts',
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error:
          'GEMINI_API_KEY is not configured in the environment. You can use Browser Speech mode, or configure GEMINI_API_KEY in the Secrets panel.',
        fallbackAvailable: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetModel =
      model === 'gemini-3.8-flash-tts'
        ? 'gemini-3.8-flash-tts'
        : 'gemini-3.8-flash-lite-tts';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: style || 'Clear, expressive and natural speech',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
      'audio/wav';

    if (!base64Audio) {
      return res
        .status(502)
        .json({ error: 'No audio data received from Gemini API' });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType,
      voice,
      style,
      model: targetModel,
    });
  } catch (err: any) {
    console.error('Gemini TTS generation error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to synthesize speech',
      details: err?.toString(),
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Statically serve public directory with full byte-range support for audio
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
