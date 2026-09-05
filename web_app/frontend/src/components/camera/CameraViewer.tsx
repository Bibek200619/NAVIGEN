import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Download,
  Maximize,
  Pause,
  Play,
  RotateCw,
  ArrowUpRight,
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';

export function CameraViewer({ compact = false }: { compact?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const container = useRef<HTMLElement>(null);
  const { canvasRef, state, message, dimensions, fps } = useCamera(
    paused,
    attempt,
  );
  const live = state === 'live';
  function snapshot() {
    canvasRef.current?.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `navigen-camera-${new Date().toISOString().replaceAll(':', '-')}.jpg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice('Snapshot saved.');
      },
      'image/jpeg',
      0.92,
    );
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      setNotice('Full screen is not available in this browser.');
    }
  }
  return (
    <section
      className={`camera-viewer ${compact ? 'compact' : ''}`}
      ref={container}
      aria-label="Front camera viewer"
    >
      <header className="section-heading">
        <h2>
          Front camera <span className="camera-id">/ CAM 01</span>
        </h2>
        {compact ? (
          <Link
            to="/camera"
            className="icon-button"
            aria-label="Open full camera view"
          >
            <ArrowUpRight size={17} />
          </Link>
        ) : (
          <span className="eyebrow">PRIMARY VIEW</span>
        )}
      </header>
      <div className="camera-stage">
        <span className="camera-state">
          <i className={live ? 'status-dot live' : 'status-dot'} />
          {live
            ? 'Live'
            : state === 'authentication'
              ? 'Not connected'
              : state === 'connecting'
                ? 'Connecting'
                : state === 'paused'
                  ? 'Paused'
                  : 'No signal'}
        </span>
        <span className="viewport-label">NAVIGEN / FRONT</span>
        <canvas
          ref={canvasRef}
          aria-label="Live view from the front camera"
          className={live ? '' : 'hidden-canvas'}
        />
        {!live && (
          <div className="camera-empty" role="status">
            <Camera size={32} strokeWidth={1} />
            <h3>
              {state === 'connecting'
                ? 'Establishing a view'
                : state === 'paused'
                  ? 'View paused'
                  : state === 'authentication'
                    ? 'Ready when you are.'
                    : 'Camera unavailable'}
            </h3>
            <p>{message}</p>
            {state === 'authentication' ? (
              <Link to="/settings" className="camera-connect">
                Connect session <ArrowUpRight size={14} />
              </Link>
            ) : state === 'unavailable' ? (
              <button
                className="camera-connect"
                onClick={() => setAttempt((n) => n + 1)}
              >
                <RotateCw size={14} />
                Retry connection
              </button>
            ) : null}
          </div>
        )}
        <span className="viewport-corner">
          01 <span>/</span> FORWARD
        </span>
      </div>
      <footer className="camera-toolbar">
        <span className="stream-meta">
          {live ? `${dimensions} · ${fps || '—'} fps` : 'Front-facing camera'}
          <span className="transport-label">MJPEG</span>
        </span>
        <div className="camera-actions">
          <button
            className="icon-button"
            onClick={() => setPaused((v) => !v)}
            disabled={state === 'authentication'}
            aria-label={paused ? 'Resume camera' : 'Pause camera'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            className="icon-button"
            disabled={!live}
            onClick={snapshot}
            aria-label="Save snapshot"
            title="Save snapshot"
          >
            <Download size={16} />
          </button>
          <button
            className="icon-button"
            onClick={fullscreen}
            aria-label="Toggle full screen"
            title="Full screen"
          >
            <Maximize size={16} />
          </button>
        </div>
      </footer>
      {notice && (
        <p className="muted-note" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
