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
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 12, 20, 48],
  [0.25, 22, 120, 190],
  [0.5, 40, 190, 150],
  [0.72, 232, 190, 70],
  [1.0, 226, 66, 52],
];

export function heatColor(norm: number): string {
  const t = Math.min(1, Math.max(0, norm));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]!;
    const b = STOPS[i + 1]!;
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]);
      const r = Math.round(a[1] + (b[1] - a[1]) * f);
      const g = Math.round(a[2] + (b[2] - a[2]) * f);
      const bl = Math.round(a[3] + (b[3] - a[3]) * f);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return "rgb(226, 66, 52)";
}

/**
 * Idle ("no pressure") readings captured from the mat on the Arduino serial
 * monitor. Per-cell maximum across 16 recorded rest frames — anything at or
 * below this plus NOISE_MARGIN is treated as zero.
 */
export const DEFAULT_BASELINE: Frame = [
  [108, 100, 80, 96, 63, 80, 70, 93, 51, 67, 57, 80, 52, 73, 65, 91, 76, 81, 58, 81],
  [60, 67, 52, 73, 44, 64, 54, 79, 36, 54, 44, 69, 41, 63, 55, 81, 97, 100, 74, 95],
  [55, 60, 45, 67, 38, 58, 49, 73, 31, 49, 40, 65, 38, 60, 53, 80, 101, 104, 78, 99],
  [48, 57, 44, 65, 36, 56, 46, 72, 30, 48, 38, 63, 36, 58, 50, 76, 104, 106, 80, 100],
  [46, 54, 40, 62, 33, 53, 45, 70, 29, 47, 38, 63, 36, 57, 49, 76, 104, 107, 80, 100],
  [46, 53, 40, 62, 32, 53, 44, 69, 28, 47, 38, 62, 35, 56, 49, 75, 106, 108, 80, 101],
  [44, 52, 39, 61, 32, 52, 44, 69, 28, 45, 36, 61, 34, 55, 48, 76, 106, 108, 82, 102],
  [44, 52, 39, 60, 32, 52, 44, 68, 27, 44, 36, 60, 33, 54, 47, 74, 106, 108, 81, 102],
  [44, 52, 38, 60, 31, 52, 44, 68, 26, 44, 36, 61, 33, 55, 48, 75, 107, 108, 82, 102],
  [43, 52, 38, 60, 31, 51, 43, 68, 26, 44, 36, 60, 33, 55, 47, 74, 107, 108, 82, 101],
  [43, 51, 36, 59, 30, 51, 42, 68, 25, 44, 35, 60, 32, 54, 48, 74, 108, 109, 83, 104],
  [42, 49, 36, 58, 30, 51, 43, 68, 26, 44, 34, 60, 32, 54, 47, 73, 108, 109, 83, 103],
  [42, 50, 36, 59, 30, 51, 42, 68, 25, 43, 35, 59, 32, 54, 47, 74, 108, 108, 84, 103],
  [41, 49, 36, 58, 29, 51, 42, 67, 25, 43, 34, 60, 32, 54, 46, 73, 107, 109, 81, 102],
  [41, 50, 36, 58, 29, 50, 41, 68, 25, 43, 34, 60, 32, 54, 47, 74, 108, 110, 83, 102],
  [41, 49, 36, 59, 29, 49, 41, 66, 24, 42, 34, 58, 32, 53, 46, 73, 108, 109, 83, 103],
  [158, 148, 119, 132, 90, 103, 89, 109, 62, 77, 66, 89, 59, 79, 71, 96, 190, 188, 156, 172],
  [63, 69, 55, 77, 48, 68, 59, 84, 41, 60, 51, 76, 49, 71, 64, 91, 172, 172, 141, 160],
  [59, 67, 53, 76, 45, 66, 57, 83, 40, 59, 49, 76, 48, 69, 62, 90, 168, 168, 139, 157],
  [59, 67, 52, 76, 45, 66, 57, 83, 40, 59, 49, 75, 48, 70, 62, 89, 167, 167, 138, 157],
];

/** Extra headroom above the recorded rest values, to absorb sensor drift. */
export const NOISE_MARGIN = 6;

/** Subtract the rest baseline so an unloaded mat reads exactly zero. */
export function calibrate(raw: Frame, baseline: Frame = DEFAULT_BASELINE): Frame {
  return raw.map((row, r) =>
    row.map((v, c) => Math.max(0, v - ((baseline[r]?.[c] ?? 0) + NOISE_MARGIN))),
  );
}

/** Soft moving blob used for the demo / no-hardware mode, on top of the rest baseline. */
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
      const rest = DEFAULT_BASELINE[r]?.[c] ?? 0;
      return Math.min(MAX_VALUE, Math.round(rest + v + Math.random() * 4));
    }),
  );
}
