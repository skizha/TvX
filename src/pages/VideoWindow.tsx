import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Hls from 'hls.js';

export function VideoWindowPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);

  const isHls = url != null && (url.includes('m3u8') || url.endsWith('.m3u8'));

  useEffect(() => {
    if (!url || !videoRef.current) return;

    const video = videoRef.current;

    const onPlaying = () => setStatus('playing');
    const onError = (e: Event) => {
      const msg = video.error?.message ?? (e instanceof ErrorEvent ? e.message : 'Playback failed');
      setStatus('error');
      setErrorMessage(String(msg));
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('loading'));
      hls.on(Hls.Events.FRAG_BUFFERED, onPlaying);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStatus('error');
          setErrorMessage(data.type + ': ' + (data.details ?? 'Unknown'));
          hls.destroy();
          hlsRef.current = null;
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);

      return () => {
        hls.destroy();
        hlsRef.current = null;
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
    }

    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);
      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
    }

    if (!isHls) {
      video.src = url;
      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);
      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
    }

    setStatus('error');
    setErrorMessage('HLS is not supported in this browser.');
    return undefined;
  }, [url, isHls]);

  if (!url) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Missing stream URL.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
        muted
        onClick={() => {
          setShowUnmuteHint(false);
          if (videoRef.current) videoRef.current.muted = false;
        }}
        onPlay={() => setShowUnmuteHint(false)}
      />
      {showUnmuteHint && status === 'playing' && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 text-white text-xs rounded pointer-events-none"
          aria-hidden
        >
          Sound is muted — use the control bar to unmute
        </div>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <span className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white">Loading stream…</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="text-center max-w-md">
            <p className="text-red-400 font-medium mb-2">Could not play stream</p>
            <p className="text-gray-400 text-sm mb-4">{errorMessage}</p>
            <p className="text-gray-500 text-sm">
              Try “Open with VLC” from the main window or copy the stream URL and open it in VLC
              manually.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
