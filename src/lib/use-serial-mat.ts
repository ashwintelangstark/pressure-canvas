import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_BASELINE,
  FrameParser,
  calibrate,
  emptyFrame,
  simulateFrame,
  type Frame,
} from "./pressure";

type Status = "idle" | "connecting" | "connected" | "demo" | "error";

export function useSerialMat() {
  const [frame, setFrame] = useState<Frame>(() => emptyFrame());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [supported, setSupported] = useState(false);
  const [customBaseline, setCustomBaseline] = useState(false);

  const portRef = useRef<any>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const timesRef = useRef<number[]>([]);
  const rawRef = useRef<Frame>(emptyFrame());
  const baselineRef = useRef<Frame>(DEFAULT_BASELINE);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "serial" in navigator);
  }, []);

  const onFrame = useCallback((f: Frame) => {
    rawRef.current = f;
    setFrame(calibrate(f, baselineRef.current));
    setFrameCount((n) => n + 1);
    const now = performance.now();
    const times = timesRef.current;
    times.push(now);
    while (times.length > 12) times.shift();
    if (times.length > 1) {
      const span = times[times.length - 1]! - times[0]!;
      setFps(span > 0 ? ((times.length - 1) / span) * 1000 : 0);
    }
  }, []);

  /** Capture the current (unloaded) reading as the new zero point. */
  const tare = useCallback(() => {
    baselineRef.current = rawRef.current.map((row) => [...row]);
    setCustomBaseline(true);
    setFrame(calibrate(rawRef.current, baselineRef.current));
  }, []);

  const resetBaseline = useCallback(() => {
    baselineRef.current = DEFAULT_BASELINE;
    setCustomBaseline(false);
    setFrame(calibrate(rawRef.current, DEFAULT_BASELINE));
  }, []);


  const disconnect = useCallback(async () => {
    stopRef.current?.();
    stopRef.current = null;
    try {
      await portRef.current?.close();
    } catch {
      /* ignore */
    }
    portRef.current = null;
    timesRef.current = [];
    setFps(0);
    setStatus("idle");
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const nav = navigator as any;
    if (!nav.serial) {
      setError("Web Serial isn't available. Use Chrome or Edge on desktop.");
      setStatus("error");
      return;
    }
    let port: any = null;
    try {
      setStatus("connecting");
      port = await nav.serial.requestPort();

      // A port left open by an earlier attempt (or a stale stream) makes
      // open() throw "Failed to open serial port". Release it first.
      if (port.readable || port.writable) {
        try {
          await port.close();
        } catch {
          /* ignore */
        }
      }

      const options = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: "none" as const,
        bufferSize: 8192,
        flowControl: "none" as const,
      };

      // One retry: some USB-serial bridges (CP210x / CH340) need a moment
      // after a previous session released the device.
      try {
        await port.open(options);
      } catch (first: any) {
        await new Promise((res) => setTimeout(res, 600));
        try {
          await port.close();
        } catch {
          /* ignore */
        }
        try {
          await port.open(options);
        } catch {
          throw first;
        }
      }

      portRef.current = port;
      setStatus("connected");

      let cancelled = false;
      const parser = new FrameParser();
      const decoder = new TextDecoderStream();
      const closed = port.readable.pipeTo(decoder.writable).catch(() => {});
      const reader = decoder.readable.getReader();

      stopRef.current = () => {
        cancelled = true;
        reader.cancel().catch(() => {});
        void closed;
      };

      (async () => {
        try {
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) parser.push(value).forEach(onFrame);
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message ?? "Serial read failed");
            setStatus("error");
          }
        } finally {
          try {
            reader.releaseLock();
          } catch {
            /* ignore */
          }
        }
      })();
    } catch (e: any) {
      try {
        await port?.close();
      } catch {
        /* ignore */
      }
      portRef.current = null;
      const name = e?.name ?? "";
      const raw = String(e?.message ?? "");
      let msg = raw || "Connection failed";
      if (name === "NotFoundError" && !raw.includes("open")) {
        msg = "No device selected.";
      } else if (name === "SecurityError") {
        msg =
          "The browser blocked serial access in this embedded preview. Open the app in its own browser tab and try again.";
      } else if (name === "InvalidStateError" || /already open/i.test(raw)) {
        msg = "That port is already open in this page. Click Disconnect, then connect again.";
      } else if (/failed to open/i.test(raw)) {
        msg =
          "Couldn't open the port. Close anything else using it (Arduino Serial Monitor, PlatformIO, a Python script, another tab), then unplug and replug the ESP32 and retry.";
      }
      setError(msg);
      setStatus(name === "NotFoundError" && !raw.includes("open") ? "idle" : "error");
    }
  }, [onFrame]);

  const startDemo = useCallback(() => {
    stopRef.current?.();
    setStatus("demo");
    const id = window.setInterval(() => onFrame(simulateFrame(performance.now())), 500);
    stopRef.current = () => window.clearInterval(id);
  }, [onFrame]);

  const stopDemo = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    timesRef.current = [];
    setFps(0);
    setStatus("idle");
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  return { frame, status, error, frameCount, fps, supported, connect, disconnect, startDemo, stopDemo };
}
