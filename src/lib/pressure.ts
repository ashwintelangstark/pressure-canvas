export const ROWS = 20;
export const COLS = 20;
export const MAX_VALUE = 1023; // firmware runs analogReadResolution(10)

export type Frame = number[][];

export function emptyFrame(): Frame {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/**
 * Incremental parser for the firmware output:
 * 20 comma-separated lines per frame, followed by a blank separator line.
 */
export class FrameParser {
  private buffer = "";
  private lines: number[][] = [];

  push(chunk: string): Frame[] {
    this.buffer += chunk.replace(/\r/g, "");
    const frames: Frame[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);

      if (line === "") {
        if (this.lines.length === ROWS) frames.push(this.lines);
        this.lines = [];
        continue;
      }

      const values = line.split(",").map((v) => Number.parseInt(v, 10));
      if (values.length !== COLS || values.some((v) => Number.isNaN(v))) continue;

      this.lines.push(values);
      if (this.lines.length === ROWS) {
        frames.push(this.lines);
        this.lines = [];
      }
    }
    return frames;
  }
}

/** Blue -> cyan -> green -> amber -> red thermal ramp. Returns an rgb() string. */
export function heatColor(norm: number): string {
  const t = Math.min(1, Math.max(0, norm));
  const stops: [number, number, number, number][] = [
    [0.0, 12, 20, 48],
    [0.25, 22, 120, 190],
    [0.5, 40, 190, 150],
    [0.72, 232, 190, 70],
    [1.0, 226, 66, 52],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, r0, g0, b0] = stops[i];
    const [p1, r1, g1, b1] = stops[i + 1];
    if (t <= p1) {
      const f = (t - p0) / (p1 - p0);
      return `rgb(${Math.round(r0 + (r1 - r0) * f)}, ${Math.round(g0 + (g1 - g0) * f)}, ${Math.round(b0 + (b1 - b0) * f)})`;
    }
  }
  return "rgb(226, 66, 52)";
}

/** Soft moving blob used for the demo / no-hardware mode. */
export function simulateFrame(t: number): Frame {
  const cx = 9.5 + Math.sin(t / 900) * 5;
  const cy = 9.5 + Math.cos(t / 1300) * 5;
  const cx2 = 9.5 + Math.sin(t / 700 + 2) * 6;
  const cy2 = 9.5 + Math.cos(t / 1100 + 1) * 4;
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const d1 = (r - cy) ** 2 + (c - cx) ** 2;
      const d2 = (r - cy2) ** 2 + (c - cx2) ** 2;
      const v = 900 * Math.exp(-d1 / 14) + 620 * Math.exp(-d2 / 8);
      return Math.min(MAX_VALUE, Math.round(v + Math.random() * 25));
    }),
  );
}
