import { useEffect, useState } from 'react';
import { fetchBackendHealth, type HealthResponse } from './api/health';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchBackendHealth()
      .then((data) => {
        setHealth(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const isConnected = health?.status === 'ok';

  return (
    <main className="mobile-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">DevTrack</h1>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Developer Habit & Streak Platform
          </p>
        </div>
        <span className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
          ● {loading ? 'Checking...' : isConnected ? 'API Online' : 'API Offline'}
        </span>
      </header>

      <section className="card">
        <h2 className="card-title">Milestone 1: System Health</h2>
        {loading && <p style={{ fontSize: '0.875rem' }}>Connecting to backend...</p>}
        {error && (
          <p style={{ fontSize: '0.875rem', color: '#f87171' }}>
            Connection failed: {error}
          </p>
        )}
        {health && (
          <div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">{health.status}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Service</span>
              <span className="meta-value">{health.service}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Environment</span>
              <span className="meta-value">{health.environment}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Last Ping</span>
              <span className="meta-value">
                {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
