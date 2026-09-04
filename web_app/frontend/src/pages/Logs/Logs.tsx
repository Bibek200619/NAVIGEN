import React, { useState } from 'react';
import { ScrollText, Filter, Search, Terminal } from 'lucide-react';
import { Panel } from '../../components/common/Panel';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  rawText: string;
}

const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: '00:00:01',
    level: 'INFO',
    source: 'system',
    message: 'System initialized successfully',
    rawText: '[INFO] [system]: System initialized successfully',
  },
  {
    id: 'log-2',
    timestamp: '00:00:02',
    level: 'INFO',
    source: 'frontend',
    message: 'Webapp foundation ready',
    rawText: '[INFO] [frontend]: Webapp foundation ready',
  },
];

export const LogsPage: React.FC = () => {
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = INITIAL_LOGS.filter((entry) => {
    const matchesLevel = filterLevel === 'ALL' || entry.level === filterLevel;
    const matchesSearch =
      searchQuery.trim() === '' ||
      entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Tactical Top Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-sky-400" />
              <span>System Logs</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Diagnostics Console
            </span>
          </div>
          <p className="text-xs text-slate-400">
            UGV Telemetry, Gateway, and Subsystem Operational Event Trail
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Stream: local_event_bus</span>
        </div>
      </div>

      <Panel title="Recent Logs">
        <div className="space-y-3">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            {/* Level Filter Buttons */}
            <div className="flex items-center gap-1.5" role="group" aria-label="Log Level Filter">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilterLevel(level)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                    filterLevel === level
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-800'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Substring Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search logs"
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Console Output Area */}
          <div className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded border border-slate-800 space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 italic py-4 text-center">
                No log entries match the current filter.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 py-1 px-1.5 hover:bg-slate-900/50 rounded transition-colors text-[11px] leading-relaxed"
                >
                  <span className="text-slate-600 select-none shrink-0">{log.timestamp}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-wider shrink-0 ${
                      log.level === 'INFO'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : log.level === 'WARN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-slate-500 shrink-0">[{log.source}]:</span>
                  <span className="text-slate-200 break-words">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default LogsPage;
