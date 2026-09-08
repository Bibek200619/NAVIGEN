import { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { PageHeading } from '../../components/common/PageHeading';
import { APP_CONFIG } from '../../constants/config';
import { setAccessToken, useAccessToken } from '../../services/session';
import { wsService } from '../../services/websocket';
export function SettingsPage() {
  const session = useAccessToken();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function connect(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `${APP_CONFIG.API_BASE_URL}/api/v1/cameras/primary`,
        {
          headers: { Authorization: `Bearer ${token.trim()}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          body?.error?.message || 'Could not verify this session.',
        );
      if (typeof body?.configured !== 'boolean')
        throw new Error('The backend returned an unexpected response.');
      wsService.disconnect();
      setAccessToken(token);
      setToken('');
      setMessage(
        body.configured
          ? 'Session connected. The camera is ready to open.'
          : 'Session connected. The camera source still needs to be configured on the backend.',
      );
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? 'The backend could not be reached. Check your connection.'
          : error instanceof Error
            ? error.message
            : 'Could not connect.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE SETTINGS"
        title="Connection"
        description="Connect your operator session to access live camera and telemetry."
      />
      <section className="settings-section">
        <div>
          <h2>Operator session</h2>
          <p>
            Use a valid operator access token from your authentication service.
            The token stays in memory and is cleared when this page is reloaded.
          </p>
        </div>
        <form onSubmit={connect} className="session-form">
          <label htmlFor="session-token">Access token</label>
          <input
            id="session-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your access token"
            required
            disabled={busy}
          />
          <div className="form-actions">
            <button className="button primary" disabled={!token.trim() || busy}>
              {busy ? 'Connecting…' : 'Connect session'}
              <ArrowUpRight size={15} />
            </button>
            {session && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  wsService.disconnect();
                  setAccessToken('');
                  setMessage('Session disconnected.');
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {session && (
            <p className="session-active">
              <Check size={15} />
              Session available
            </p>
          )}
          {message && (
            <p role="status" className="muted-note">
              {message}
            </p>
          )}
        </form>
      </section>
      <section className="settings-section">
        <div>
          <h2>Service endpoints</h2>
          <p>
            Connection addresses are managed by your application configuration.
          </p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>API</dt>
            <dd className="endpoint">
              {APP_CONFIG.API_BASE_URL || location.origin}
            </dd>
          </div>
          <div>
            <dt>Telemetry</dt>
            <dd className="endpoint">{APP_CONFIG.WS_URL}</dd>
          </div>
          <div>
            <dt>Camera transport</dt>
            <dd>MJPEG over HTTP</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
