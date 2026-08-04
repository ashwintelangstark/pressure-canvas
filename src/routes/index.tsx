import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { COLS, MAX_VALUE, ROWS, heatColor } from "@/lib/pressure";
import { useSerialMat } from "@/lib/use-serial-mat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pressure Mat Live Heatmap | 20x20 ESP32 Sensor" },
      {
        name: "description",
        content:
          "Live 20x20 pressure sensor heatmap streamed from an ESP32 over USB serial, with peak, average and per-cell readings.",
      },
      { property: "og:title", content: "Pressure Mat Live Heatmap" },
      {
        property: "og:description",
        content: "Real-time 20x20 pressure mat visualization from ESP32 serial output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Dashboard() {
  const { frame, status, error, frameCount, fps, supported, connect, disconnect, startDemo, stopDemo } =
    useSerialMat();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [autoScale, setAutoScale] = useState(true);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  const { peak, avg, active, scaleMax } = useMemo(() => {
    let max = 0;
    let sum = 0;
    let act = 0;
    for (const row of frame)
      for (const v of row) {
        if (v > max) max = v;
        sum += v;
        if (v > MAX_VALUE * 0.12) act++;
      }
    return {
      peak: max,
      avg: sum / (ROWS * COLS),
      active: act,
      scaleMax: autoScale ? Math.max(80, max) : MAX_VALUE,
    };
  }, [frame, autoScale]);

  const live = status === "connected" || status === "demo";
  const statusLabel =
    status === "connected"
      ? "Streaming"
      : status === "demo"
        ? "Simulated feed"
        : status === "connecting"
          ? "Connecting"
          : status === "error"
            ? "Error"
            : "Not connected";

  const hoverValue = hover ? (frame[hover.r]?.[hover.c] ?? 0) : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-accent">ESP32 · 115200 baud</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pressure Mat Heatmap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            20 × 20 sensing grid · 10-bit readings (0–1023)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
          />
          <span className="text-sm text-muted-foreground">{statusLabel}</span>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap items-center gap-3">
        {status === "connected" ? (
          <button
            onClick={disconnect}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={!supported || status === "connecting" || status === "demo"}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Connect mat
          </button>
        )}
        <button
          onClick={status === "demo" ? stopDemo : startDemo}
          disabled={status === "connected"}
          className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {status === "demo" ? "Stop demo" : "Demo feed"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={autoScale}
            onChange={(e) => setAutoScale(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Auto-scale colors
        </label>
      </section>

      {!supported && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          This browser doesn&apos;t support Web Serial. Use Chrome or Edge on desktop to connect the
          ESP32, or run the demo feed.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </p>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
        <div
          className="rounded-2xl border border-border bg-card p-4"
          style={{ boxShadow: "var(--panel-glow)" }}
        >
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            onMouseLeave={() => setHover(null)}
          >
            {frame.map((row, r) =>
              row.map((v, c) => (
                <div
                  key={`${r}-${c}`}
                  onMouseEnter={() => setHover({ r, c })}
                  className="aspect-square rounded-[3px] transition-colors duration-150"
                  style={{
                    backgroundColor: heatColor(v / scaleMax),
                    outline:
                      hover?.r === r && hover?.c === c
                        ? "2px solid var(--color-foreground)"
                        : "none",
                  }}
                  title={`r${r} c${c}: ${v}`}
                />
              )),
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">0</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{
                backgroundImage: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.72, 1]
                  .map((s) => heatColor(s))
                  .join(", ")})`,
              }}
            />
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(scaleMax)}
            </span>
          </div>
        </div>

        <aside className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <Stat label="Peak" value={String(peak)} />
          <Stat label="Average" value={avg.toFixed(1)} />
          <Stat label="Active cells" value={`${active} / 400`} />
          <Stat label="Frames" value={String(frameCount)} />
          <Stat label="Frame rate" value={`${fps.toFixed(2)} fps`} />
          <Stat
            label="Cursor"
            value={hover ? `${hoverValue} @ ${hover.r},${hover.c}` : "—"}
          />
        </aside>
      </section>

      <footer className="mt-10 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
        Reads the firmware stream directly: 20 comma-separated rows per frame followed by a blank
        separator line. Close the Arduino Serial Monitor before connecting — only one program can
        hold the port.
      </footer>
    </main>
  );
}
