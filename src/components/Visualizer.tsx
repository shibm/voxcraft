import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  colorTheme?: 'indigo' | 'emerald' | 'amber';
}

export const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  colorTheme = 'indigo',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const numBars = 32;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / numBars) * 0.72;
      const gap = (width - barWidth * numBars) / (numBars + 1);

      const frequencies: number[] = [];

      if (isPlaying) {
        phase += 0.09;
        for (let i = 0; i < numBars; i++) {
          const wave1 = Math.sin(phase + i * 0.28);
          const wave2 = Math.cos(phase * 1.6 + i * 0.18);
          const wave3 = Math.sin(phase * 0.7 + i * 0.4);
          const val = Math.max(0.12, (wave1 + wave2 + wave3 + 3) / 6);
          frequencies.push(val);
        }
      } else {
        // Idle gentle wave
        for (let i = 0; i < numBars; i++) {
          frequencies.push(0.06);
        }
      }

      for (let i = 0; i < numBars; i++) {
        const factor = frequencies[i] || 0.05;
        const barHeight = Math.max(4, factor * (height - 8));
        const x = gap + i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (colorTheme === 'indigo') {
          gradient.addColorStop(0, '#818cf8');
          gradient.addColorStop(0.5, '#6366f1');
          gradient.addColorStop(1, '#a855f7');
        } else if (colorTheme === 'emerald') {
          gradient.addColorStop(0, '#34d399');
          gradient.addColorStop(1, '#059669');
        } else {
          gradient.addColorStop(0, '#fbbf24');
          gradient.addColorStop(1, '#d97706');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, colorTheme]);

  return (
    <div className="w-full flex items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm shadow-inner">
      <canvas
        ref={canvasRef}
        width={420}
        height={52}
        className="w-full max-w-md h-12 block"
      />
    </div>
  );
};
