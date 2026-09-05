import { useEffect, useState } from 'react';
import { apiClient } from '../../services/api';
import { PageHeading } from '../common/PageHeading';

interface SimulationState {
  status: string;
  target_index: number;
  waypoints: { name: string; x: number; y: number }[];
  distance_m: number;
  progress_pct: number;
  obstacle: unknown;
}

export function SimulationMission() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await apiClient.get<SimulationState>('/simulation/state');
        if (active) {
          setState(next);
          setError('');
        }
      } catch {
        if (active)
          setError('The simulation is unavailable. Start the local simulator.');
      }
      if (active) timer = setTimeout(load, 500);
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  async function command(action: string) {
    setBusy(true);
    setError('');
    try {
      setState(
        await apiClient.post<SimulationState>('/simulation/commands', {
          action,
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Command failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SIMULATION / NAVIGATION"
        title="Warehouse inspection"
        description="Four checkpoints, obstacle avoidance, and a return to the charging dock."
        action={
          <a
            className="button"
            href="http://127.0.0.1:8010"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open 3D simulator ↗
          </a>
        }
      />
      <p className="simulation-banner">
        Demo controls affect only the local simulated vehicle. No physical robot
        is connected.
      </p>
      <section className="settings-section">
        <div>
          <h2>Mission controls</h2>
          <p>
            Run the guided demo to see the UGV turn around a test obstacle,
            rejoin its route, and complete its route.
          </p>
        </div>
        <div>
          <p className="simulation-state">
            {state?.status.replaceAll('_', ' ') || 'Connecting…'} ·{' '}
            {state?.distance_m.toFixed(1) || '0.0'} m travelled
          </p>
          <div className="simulation-actions">
            <button
              className="button primary"
              disabled={busy || !state || !!error}
              onClick={() => command('demo')}
            >
              Run guided demo
            </button>
            <button
              className="button"
              disabled={
                busy || !state || !['idle', 'paused'].includes(state.status)
              }
              onClick={() => command('start')}
            >
              Start / resume
            </button>
            <button
              className="button"
              disabled={
                busy ||
                !state ||
                !['running', 'avoiding', 'blocked'].includes(state.status)
              }
              onClick={() => command('pause')}
            >
              Pause
            </button>
            <button
              className="button"
              disabled={busy || state?.status !== 'running' || !!state.obstacle}
              onClick={() => command('obstacle')}
            >
              Add obstacle
            </button>
            <button
              className="button"
              disabled={busy || !state?.obstacle}
              onClick={() => command('clear_obstacle')}
            >
              Clear path
            </button>
            <button
              className="button simulation-stop"
              disabled={busy || !state || state.status === 'emergency_stop'}
              onClick={() => command('estop')}
            >
              Simulated E-stop
            </button>
            <button
              className="button"
              disabled={busy || !state}
              onClick={() => command('reset')}
            >
              Reset simulation
            </button>
          </div>
          {error && (
            <p role="alert" className="muted-note">
              {error}
            </p>
          )}
        </div>
      </section>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th>Position</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state?.waypoints.map((waypoint, index) => (
              <tr key={waypoint.name}>
                <td>
                  {index + 1}. {waypoint.name}
                </td>
                <td>
                  {waypoint.x.toFixed(1)}, {waypoint.y.toFixed(1)} m
                </td>
                <td>
                  {index < state.target_index
                    ? 'Reached'
                    : index === state.target_index
                      ? 'Next checkpoint'
                      : 'Queued'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
