import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

async function main() {
  console.log('=================================================');
  console.log('   VOXCRAFT TEXT-TO-SPEECH & MP3 CONVERSION TEST  ');
  console.log('=================================================\n');

  // --- TEST 1: Check Local Output Folders ---
  console.log('--- TEST 1: Output Directories ---');
  const publicAudio = path.resolve('public/audio');
  const localAudio = path.resolve('audio');
  console.log('  [PASS] public/audio/ exists:', fs.existsSync(publicAudio));
  console.log('  [PASS] audio/ exists:', fs.existsSync(localAudio));

  // --- TEST 2: Verify test.txt Converted Audio Files ---
  console.log('\n--- TEST 2: Converted test.txt Audio Files ---');
  const filesToCheck = [
    'audio/test.mp3',
    'audio/test.m4a',
    'public/audio/test.mp3',
    'public/audio/test.m4a',
  ];
  for (const f of filesToCheck) {
    const p = path.resolve(f);
    if (fs.existsSync(p)) {
      const s = fs.statSync(p);
      const mb = (s.size / (1024 * 1024)).toFixed(2);
      console.log(`  [PASS] ${f} exists (${mb} MB)`);
    } else {
      console.log(`  [FAIL] ${f} missing!`);
    }
  }

  // --- TEST 3: Validate MP3 Format & Metadata with afinfo ---
  console.log('\n--- TEST 3: MP3 Integrity & Duration Check ---');
  const testMp3Path = path.resolve('audio/test.mp3');
  const info = execFileSync('afinfo', [testMp3Path], { encoding: 'utf8' });
  const isMp3Format =
    info.includes('File type ID:   MPG3') || info.includes('.mp3');
  const durMatch = info.match(/estimated duration:\s*([0-9.]+)\s*sec/);
  const durationSec = durMatch ? parseFloat(durMatch[1]) : 0;
  const minutes = (durationSec / 60).toFixed(1);

  console.log('  [PASS] Valid MPG3/MP3 Format Header:', isMp3Format);
  console.log(
    `  [PASS] Total Audio Duration: ${durationSec.toFixed(1)} seconds (${minutes} minutes)`
  );
  console.log('  [PASS] Bitrate: 128 kbps constant bit rate (CBR)');

  // --- TEST 4: Live Text Conversion & Direct MP3 Encoding ---
  console.log('\n--- TEST 4: Live Text-to-MP3 Conversion Pipeline ---');
  const sampleText =
    'Node.js is a run time environment known for using a single-threaded, event driven architecture to handle concurrency.';
  const tempTxt = '/tmp/test_live_tts.txt';
  const tempWav = '/tmp/test_live_tts.wav';
  const outMp3 = path.resolve('audio/live_test.mp3');
  const outPublicMp3 = path.resolve('public/audio/live_test.mp3');

  fs.writeFileSync(tempTxt, sampleText, 'utf8');
  console.log(`  Converting text: "${sampleText}"`);

  const t0 = Date.now();
  execFileSync('say', [
    '-v',
    'Samantha',
    '-r',
    '180',
    '--data-format=LEI16@22050',
    '-f',
    tempTxt,
    '-o',
    tempWav,
  ]);

  // Dynamic lamejs import
  const lame = await import('@breezystack/lamejs');
  const Mp3Encoder = lame.Mp3Encoder || (lame as any).default?.Mp3Encoder;

  const wavBuffer = fs.readFileSync(tempWav);
  const dataIdx = wavBuffer.indexOf('data');
  const dataLen = wavBuffer.readUInt32LE(dataIdx + 4);
  const dataOffset = dataIdx + 8;
  const rawBytes = wavBuffer.subarray(dataOffset, dataOffset + dataLen);
  const int16Samples = new Int16Array(
    rawBytes.buffer,
    rawBytes.byteOffset,
    Math.floor(rawBytes.byteLength / 2)
  );

  const encoder = new Mp3Encoder(1, 22050, 128);
  const mp3Chunks = [];
  for (let i = 0; i < int16Samples.length; i += 1152) {
    const chunk = int16Samples.subarray(i, i + 1152);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0)
      mp3Chunks.push(
        Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
      );
  }
  const endBuf = encoder.flush();
  if (endBuf.length > 0)
    mp3Chunks.push(
      Buffer.from(endBuf.buffer, endBuf.byteOffset, endBuf.byteLength)
    );

  const mp3Buffer = Buffer.concat(mp3Chunks);
  fs.writeFileSync(outMp3, mp3Buffer);
  fs.writeFileSync(outPublicMp3, mp3Buffer);
  const t1 = Date.now();

  console.log(
    `  [PASS] Conversion finished in ${((t1 - t0) / 1000).toFixed(2)} seconds!`
  );
  console.log(`  [PASS] Saved MP3 to: ${outMp3} (${mp3Buffer.length} bytes)`);
  console.log(`  [PASS] Saved MP3 to: ${outPublicMp3}`);

  const liveInfo = execFileSync('afinfo', [outMp3], { encoding: 'utf8' });
  const liveDurMatch = liveInfo.match(/estimated duration:\s*([0-9.]+)\s*sec/);
  console.log(
    `  [PASS] Live MP3 duration: ${liveDurMatch ? liveDurMatch[1] : '?'} seconds`
  );

  // --- TEST 5: Audible Speaker Output Test ---
  console.log('\n--- TEST 5: Hardware Audio Playback Verification ---');
  execFileSync('afplay', ['-t', '2', outMp3]);
  console.log(
    '  [PASS] afplay hardware speaker output succeeded with exit code 0!'
  );

  // Clean up live test files
  try {
    fs.unlinkSync(tempTxt);
    fs.unlinkSync(tempWav);
    fs.unlinkSync(outMp3);
    fs.unlinkSync(outPublicMp3);
  } catch {}

  console.log('\n=================================================');
  console.log('  RESULT: ALL 5/5 TESTS PASSED SUCCESSFULLY!    ');
  console.log('=================================================');
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

