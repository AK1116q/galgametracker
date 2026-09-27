export type Player = {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
};
type Options = {
  host: string;
  width: string;
  height: string;
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: () => void;
    onAutoplayBlocked: () => void;
  };
};
type API = { Player: new (element: HTMLElement, options: Options) => Player };
declare global {
  interface Window {
    YT?: API;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let pending: Promise<API> | undefined;

/** Called only after the user explicitly enables music. */
export function loadYouTube(): Promise<API> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<API>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    const previous = window.onYouTubeIframeAPIReady;
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      pending = undefined;
      reject(new Error("YouTube unavailable"));
    };
    const timeout = window.setTimeout(fail, 15000);
    script.onerror = fail;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    document.head.append(script);
  });
  return pending;
}
