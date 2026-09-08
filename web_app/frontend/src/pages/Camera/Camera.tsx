import { CameraViewer } from '../../components/camera/CameraViewer';
import { PageHeading } from '../../components/common/PageHeading';
export function CameraPage() {
  return (
    <>
      <PageHeading
        eyebrow="VISION / 01"
        title="Live camera"
        description="A direct view from the vehicle. Keep the field in focus."
      />
      <CameraViewer />
      <p className="muted-note camera-footnote">
        Pausing stops this viewer only. The vehicle camera continues operating.
      </p>
    </>
  );
}
