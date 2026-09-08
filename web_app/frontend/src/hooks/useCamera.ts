import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { useAccessToken } from '../services/session';

type CameraState =
  'connecting' | 'live' | 'paused' | 'unavailable' | 'authentication';
const MAX_BUFFER = 4_194_304;

export function useCamera(paused: boolean, attempt: number) {
  const token = useAccessToken();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<CameraState>('connecting');
  const [message, setMessage] = useState('Connecting to the front camera.');
  const [dimensions, setDimensions] = useState('—');
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (paused || !token) return;
    const controller = new AbortController();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const watchdog = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), 12000);
    };
    async function run() {
      setState('connecting');
      setMessage('Connecting to the front camera.');
      setFps(0);
      watchdog();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await apiFetch('/api/v1/cameras/primary/stream', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (
          !response.headers
            .get('content-type')
            ?.includes('multipart/x-mixed-replace')
        )
          throw new Error('The camera returned an unsupported stream.');
        reader = response.body?.getReader();
        if (!reader)
          throw new Error('Streaming is unavailable in this browser.');
        let buffer = new Uint8Array(0);
        let frames = 0;
        let measuredAt = performance.now();
        while (!disposed) {
          const { done, value } = await reader.read();
          if (done)
            throw new Error('The camera disconnected. Reconnect to resume.');
          const next = new Uint8Array(buffer.length + value.length);
          next.set(buffer);
          next.set(value, buffer.length);
          buffer = next;
          let start = -1;
          let consumed = 0;
          for (let i = 0; i < buffer.length - 1; i++) {
            if (start < 0 && buffer[i] === 255 && buffer[i + 1] === 216)
              start = i;
            if (start >= 0 && buffer[i] === 255 && buffer[i + 1] === 217) {
              if (i + 2 - start > MAX_BUFFER)
                throw new Error('The camera frame is too large.');
              const bitmap = await createImageBitmap(
                new Blob([buffer.slice(start, i + 2)], { type: 'image/jpeg' }),
              );
              try {
                if (disposed) return;
                const canvas = canvasRef.current;
                if (canvas) {
                  if (
                    canvas.width !== bitmap.width ||
                    canvas.height !== bitmap.height
                  ) {
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    setDimensions(`${bitmap.width} × ${bitmap.height}`);
                  }
                  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
                }
              } finally {
                bitmap.close();
              }
              watchdog();
              setState('live');
              frames++;
              const now = performance.now();
              if (now - measuredAt >= 1000) {
                setFps(Math.round((frames * 1000) / (now - measuredAt)));
                frames = 0;
                measuredAt = now;
              }
              consumed = i + 2;
              start = -1;
              i++;
            }
          }
          buffer = buffer.slice(consumed);
          if (buffer.length > MAX_BUFFER)
            throw new Error('The camera stream could not be decoded.');
        }
      } catch (error) {
        if (disposed) return;
        setState(
          error instanceof ApiError &&
            (error.status === 401 || error.status === 403)
            ? 'authentication'
            : 'unavailable',
        );
        setMessage(
          controller.signal.aborted
            ? 'No new frames arrived. Check the camera connection and retry.'
            : error instanceof TypeError
              ? 'The camera service could not be reached.'
              : error instanceof Error
                ? error.message
                : 'The camera is unavailable.',
        );
      } finally {
        clearTimeout(timer);
        await reader?.cancel().catch(() => undefined);
        reader?.releaseLock();
      }
    }
    void run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [paused, attempt, token]);

  const visibleState = !token ? 'authentication' : paused ? 'paused' : state;
  return {
    canvasRef,
    state: visibleState,
    message: !token
      ? 'Connect your operator session to view the vehicle camera.'
      : paused
        ? 'Your camera viewer is paused.'
        : message,
    dimensions,
    fps,
  };
}
