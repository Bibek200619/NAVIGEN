import { useEffect, useState } from 'react';
import { PageHeading } from '../../components/common/PageHeading';
import { apiClient } from '../../services/api';
import { useAccessToken } from '../../services/session';
import { Link } from 'react-router-dom';
type Log = {
  id: string;
  level: string;
  source: string;
  message: string;
  recorded_at: string;
};
export function LogsPage() {
  const token = useAccessToken();
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.get<{ items: Log[] }>(
          '/api/v1/logs?limit=100',
        );
        if (active) setLogs(result.items);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Activity is unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token, attempt]);
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE HISTORY"
        title="Activity"
        description="Recent events reported by the vehicle and backend."
        action={
          <button
            className="button"
            disabled={!token || loading}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Refresh activity
          </button>
        }
      />
      {!token ? (
        <p className="empty-line">
          Connect an operator session to view activity.{' '}
          <Link className="text-link" to="/settings">
            Open connection settings
          </Link>
        </p>
      ) : loading ? (
        <p role="status" className="empty-line">
          Loading activity…
        </p>
      ) : error ? (
        <p role="alert" className="empty-line">
          {error}
        </p>
      ) : logs.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Source</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.recorded_at).toLocaleString()}</td>
                  <td>{log.level}</td>
                  <td>{log.source}</td>
                  <td>{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-line">No activity has been recorded yet.</p>
      )}
    </>
  );
}
