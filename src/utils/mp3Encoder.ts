import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Converts Float32 PCM sample array directly into an MP3 Blob
 */
export function pcmToMp3Blob(
  samples: Float32Array,
  sampleRate: number = 22050,
  kbps: number = 128
): Blob {
  // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  // Encode in 1152-sample MP3 frame blocks
  const sampleBlockSize = 1152;
  for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
    const chunk = int16Samples.subarray(i, i + sampleBlockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Converts any WAV ArrayBuffer into an MP3 Blob
 */
export function wavArrayBufferToMp3Blob(
  arrayBuffer: ArrayBuffer,
  kbps: number = 128
): Blob {
  const view = new DataView(arrayBuffer);

  // Check RIFF header
  const isRiff =
    String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    ) === 'RIFF';

  let channels = 1;
  let sampleRate = 22050;

  if (isRiff && arrayBuffer.byteLength >= 44) {
    channels = view.getUint16(22, true) || 1;
    sampleRate = view.getUint32(24, true) || 22050;
  }

  // Locate data chunk
  let dataOffset = 12;
  while (dataOffset < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataOffset >= arrayBuffer.byteLength) {
    dataOffset = 44; // Fallback to standard 44-byte WAV header
  }

  const pcmSamples = new Int16Array(
    arrayBuffer,
    dataOffset,
    Math.floor((arrayBuffer.byteLength - dataOffset) / 2)
  );

  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];
  const chunkSize = 1152;

  for (let i = 0; i < pcmSamples.length; i += chunkSize) {
    const chunk = pcmSamples.subarray(i, i + chunkSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Asynchronously converts any WAV Blob into an MP3 Blob
 */
export async function wavBlobToMp3Blob(wavBlob: Blob, kbps: number = 128): Promise<Blob> {
  const arrayBuffer = await wavBlob.arrayBuffer();
  return wavArrayBufferToMp3Blob(arrayBuffer, kbps);
}
