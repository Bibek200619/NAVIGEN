import { PageHeading } from '../../components/common/PageHeading';
import { MissionHistory } from '../../components/mission/MissionHistory';
import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../../constants/config';
import { SimulationMission } from '../../components/mission/SimulationMission';
export function MissionPage() {
  if (APP_CONFIG.SIMULATION) return <SimulationMission />;
  return (
    <>
      <PageHeading
        eyebrow="NAVIGATION"
        title="Missions"
        description="Review the vehicle’s mission and navigation goals."
      />
      <section className="settings-section">
        <div>
          <h2>Mission controls</h2>
          <p>Mission dispatch is not connected in this workspace.</p>
        </div>
        <p className="muted-note">
          No command can be sent from this view. Vehicle safety remains
          controlled by the UGV safety supervisor.
        </p>
      </section>
      <MissionHistory />
      <p className="muted-note">
        For a live view of the vehicle’s surroundings,{' '}
        <Link className="text-link" to="/camera">
          open the camera.
        </Link>
      </p>
    </>
  );
}
