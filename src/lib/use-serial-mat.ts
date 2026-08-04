import { useCallback, useEffect, useRef, useState } from "react";
import { FrameParser, emptyFrame, simulateFrame, type Frame } from "./pressure";

type Status = "idle" | "connecting" | "connected" | "demo" | "error";

export function useSerialMat() {
  const [frame, setFrame] = useState<Frame>(() => emptyFrame());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [supported, setSupported] = useState(false);

  const portRef = useRef<any>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const timesRef = useRef<number[]>([]);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "serial" in navigator);
  }, []);

  const onFrame = useCallback((f: Frame) => {
    setFrame(f);
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
    try {
      setStatus("connecting");
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 115200 });
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
      setError(e?.name === "NotFoundError" ? "No device selected." : (e?.message ?? "Connection failed"));
      setStatus("idle");
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
