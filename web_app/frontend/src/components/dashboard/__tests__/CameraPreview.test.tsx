import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraPreview } from '../CameraPreview';
import { ROS_TOPICS } from '../../../constants/topics';

describe('CameraPreview Component', () => {
  describe('Default and Fallback State (No-Source)', () => {
    it('renders default unavailable state with default topic and N/A metadata', () => {
      render(<CameraPreview />);

      expect(screen.getByText('Camera Preview')).toBeInTheDocument();
      expect(screen.getAllByText(ROS_TOPICS.CAMERA_IMAGE_RAW).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Camera preview unavailable')).toBeInTheDocument();
      expect(screen.getByText('Waiting for camera source')).toBeInTheDocument();

      // Missing metadata falls back to "N/A" and does not invent values
      expect(screen.getByText('Resolution')).toBeInTheDocument();
      expect(screen.getByText('Framerate')).toBeInTheDocument();
      expect(screen.getByText('Latency / Age')).toBeInTheDocument();
      expect(screen.getByText('Topic')).toBeInTheDocument();
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThanOrEqual(3);

      // Viewport has appropriate accessibility attributes
      const viewport = screen.getByRole('region', { name: 'Camera preview viewport' });
      expect(viewport).toBeInTheDocument();

      // No fake image or video is rendered
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('respects custom topic and optional cameraName in metadata', () => {
      render(
        <CameraPreview
          metadata={{
            cameraName: 'Front Depth Cam',
            topic: '/camera/depth/image_raw',
          }}
        />,
      );

      expect(screen.getByText('Front Depth Cam')).toBeInTheDocument();
      expect(screen.getAllByText('/camera/depth/image_raw').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('State Rendering', () => {
    it('renders LOADING state', () => {
      render(<CameraPreview state="loading" />);

      expect(screen.getByText('Loading')).toBeInTheDocument();
      expect(screen.getByText('Loading Camera Stream...')).toBeInTheDocument();
      expect(screen.getByText('Establishing connection to camera feed')).toBeInTheDocument();
    });

    it('renders LIVE state with supplied imageSrc', () => {
      render(
        <CameraPreview
          state="live"
          imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          metadata={{
            cameraName: 'Primary Optical',
            resolution: '1280x720',
            fps: 30,
            latencyMs: 120,
            topic: ROS_TOPICS.CAMERA_IMAGE_RAW,
          }}
        />,
      );

      expect(screen.getByText('Live')).toBeInTheDocument();
      const img = screen.getByRole('img', { name: 'Primary Optical stream feed' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png'));

      // Metadata rendered accurately
      expect(screen.getByText('1280x720')).toBeInTheDocument();
      expect(screen.getByText('30 FPS')).toBeInTheDocument();
      expect(screen.getByText('120 ms')).toBeInTheDocument();
    });

    it('renders LIVE state with supplied children video/canvas element', () => {
      render(
        <CameraPreview state="live">
          <video data-testid="custom-video-element" />
        </CameraPreview>,
      );

      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByTestId('custom-video-element')).toBeInTheDocument();
    });

    it('renders truthful placeholder in LIVE state when NO image or source is provided', () => {
      render(
        <CameraPreview
          state="live"
          metadata={{
            topic: ROS_TOPICS.CAMERA_IMAGE_RAW,
          }}
        />,
      );

      expect(screen.getByText('Live')).toBeInTheDocument();
      // Must NOT claim "Live Feed", "Stream Active", or "Hardware stream active"
      expect(screen.queryByText(/Live Feed/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stream Active/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Hardware stream active/i)).not.toBeInTheDocument();

      // Truthfully explains waiting for source
      expect(screen.getByText('Waiting for camera source')).toBeInTheDocument();
      expect(screen.getByText('No video stream or frame received')).toBeInTheDocument();
    });

    it('renders STALE state without image and clearly communicates frame age', () => {
      render(
        <CameraPreview
          state="stale"
          metadata={{
            fps: 0,
            frameAgeMs: 4500,
          }}
        />,
      );

      expect(screen.getByText('Stale')).toBeInTheDocument();
      expect(screen.getByText('Camera Feed Stale')).toBeInTheDocument();
      expect(screen.getByText('Last frame received 4500 ms ago.')).toBeInTheDocument();
      expect(screen.getByText('4500 ms')).toBeInTheDocument();
      expect(screen.getByText('0 FPS')).toBeInTheDocument();
    });

    it('renders STALE overlay banner when imageSrc is present in STALE state', () => {
      render(
        <CameraPreview
          state="stale"
          imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          metadata={{ frameAgeMs: 5200 }}
        />,
      );

      expect(screen.getByRole('img', { name: 'Camera Preview Feed' })).toBeInTheDocument();
      const staleBanner = screen.getByTestId('camera-stale-banner');
      expect(staleBanner).toHaveTextContent('Stale feed: 5200 ms old');
    });

    it('renders DISCONNECTED state', () => {
      render(<CameraPreview state="disconnected" />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Camera Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Camera connection is unavailable.')).toBeInTheDocument();
    });

    it('renders UNAVAILABLE state', () => {
      render(<CameraPreview state="unavailable" />);

      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Camera preview unavailable')).toBeInTheDocument();
      expect(screen.getByText('Waiting for camera source')).toBeInTheDocument();
    });

    it('renders ERROR state with error message and accessible Retry Camera button', () => {
      const onRetry = vi.fn();
      render(
        <CameraPreview
          state="error"
          error="Camera sensor hardware timeout"
          onRetry={onRetry}
        />,
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Camera Feed Error')).toBeInTheDocument();
      expect(screen.getByText('Camera sensor hardware timeout')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: 'Retry Camera' });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders ERROR state with Error object and without retry button when onRetry is omitted', () => {
      render(
        <CameraPreview
          state="error"
          error={new Error('Stream decode failed')}
        />,
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Stream decode failed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry Camera' })).not.toBeInTheDocument();
    });
  });

  describe('Metadata Formatting and Fallbacks', () => {
    it('formats partial metadata gracefully and falls back to N/A without inventing values', () => {
      render(
        <CameraPreview
          metadata={{
            resolution: '1920x1080',
            fps: null,
            frameAgeMs: undefined,
          }}
        />,
      );

      expect(screen.getByText('1920x1080')).toBeInTheDocument();
      const naElements = screen.getAllByText('N/A');
      // For Framerate and Latency / Age
      expect(naElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Custom Display Props and Accessibility', () => {
    it('supports custom title and aspect ratio', () => {
      render(
        <CameraPreview
          title="Tactical Viewport"
          aspectRatio="video"
          state="live"
        />,
      );

      expect(screen.getByText('Tactical Viewport')).toBeInTheDocument();
      const viewport = screen.getByTestId('camera-preview-viewport');
      expect(viewport.className).toContain('aspect-video');
    });
  });
});
