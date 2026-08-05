import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!promptEvent) {
      setShowHelp((v) => !v);
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex max-w-xs flex-col items-start gap-2">
      {showHelp && !promptEvent && (
        <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-lg backdrop-blur">
          Open this page in its own Chrome or Edge window (not the embedded preview), then use the
          install icon in the address bar — or this button — to add it as a desktop app.
        </div>
      )}
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-full border border-border bg-secondary/90 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition-colors hover:bg-muted"
        title="Install as a desktop app"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="m7 12 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Install desktop app
      </button>
    </div>
  );
}
