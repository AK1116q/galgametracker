import { useEffect, useRef } from "react";

const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789<>/{}:+";
const CELL = 40;

type Column = {
  x: number;
  head: number;
  speed: number;
  size: number;
  opacity: number;
  glyphs: number[];
};

/** Original sprite-based glyph rain. No third-party component or per-frame React updates. */
export default function GlyphRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Bake glyph glow once: the animation only copies small sprites, never blurs the viewport.
    const atlas = document.createElement("canvas");
    atlas.width = GLYPHS.length * CELL;
    atlas.height = CELL * 2;
    const ink = atlas.getContext("2d");
    if (!ink) return;
    ink.font = "20px ui-monospace, monospace";
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    for (let row = 0; row < 2; row++) {
      ink.fillStyle = row ? "#f1dfff" : "#b28adf";
      ink.shadowColor = row ? "#d9b3ff" : "#a664e4";
      ink.shadowBlur = row ? 8 : 4;
      for (let i = 0; i < GLYPHS.length; i++) {
        ink.fillText(GLYPHS[i], (i + 0.5) * CELL, (row + 0.5) * CELL);
      }
    }

    let columns: Column[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let seed = 713;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const draw = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const column of columns) {
        column.head += elapsed * column.speed;
        if (column.head - column.glyphs.length * column.size > height) {
          column.head = -column.size;
        }
        for (let i = 0; i < column.glyphs.length; i++) {
          const y = column.head - i * column.size;
          if (y < -column.size * 2 || y > height + column.size) continue;
          const fade = 1 - i / column.glyphs.length;
          ctx.globalAlpha = column.opacity * fade * fade;
          ctx.drawImage(
            atlas,
            column.glyphs[i] * CELL,
            i === 0 ? CELL : 0,
            CELL,
            CELL,
            column.x - column.size * 0.5,
            y - column.size * 0.5,
            column.size * 2,
            column.size * 2,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // Bound both pixel density and total surface area on large/high-DPI screens.
      const dpr = Math.min(
        devicePixelRatio || 1,
        1.5,
        Math.sqrt(2_400_000 / Math.max(1, width * height)),
      );
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 713;
      columns = [];
      const count = Math.min(84, Math.max(18, Math.round(width / 23)));
      for (let i = 0; i < count; i++) {
        const near = i % 3 === 0;
        columns.push({
          x: ((i + random() * 0.5) / count) * width,
          // Start with populated columns: even the first frame contains a visible rain field.
          head: random() * height * 1.35,
          speed: near ? 120 + random() * 50 : 48 + random() * 40,
          size: near ? 20 : 14,
          opacity: near ? 0.8 : 0.28 + random() * 0.18,
          glyphs: Array.from({ length: 10 + Math.floor(random() * 14) }, () =>
            Math.floor(random() * GLYPHS.length),
          ),
        });
      }
      draw(0);
    };
    const tick = (now: number) => {
      const elapsed = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      draw(elapsed);
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    resize();
    visibility();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      atlas.width = 0;
      atlas.height = 0;
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="archive-glyph-rain" aria-hidden="true" />
  );
}
