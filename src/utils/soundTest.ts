/**
 * Sound test helper to immediately verify speaker and tab audio output
 */

export function playTestChime(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Two-tone chime (E5 -> G#5 -> B5 chord)
      const freqs = [659.25, 830.61, 987.77];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.85);
      });

      setTimeout(() => {
        resolve(true);
      }, 1000);
    } catch (e) {
      console.warn('AudioContext sound test failed:', e);
      resolve(false);
    }
  });
}
