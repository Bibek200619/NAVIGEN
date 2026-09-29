import React, { useState } from 'react';
import { Crosshair, Plus, Minus, Layers } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';

export interface LiveMapProps {
  className?: string;
}

export const LiveMap: React.FC<LiveMapProps> = ({ className = '' }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRecenter = () => {
    setZoomLevel(1);
  };

  return (
    <Panel title="Live Map" className={className}>
      <div className="space-y-3">
        {/* Map Header HUD */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400 text-[11px]">Ref: odom → base_link</span>
            <span className="text-slate-600">|</span>
            <span className="text-[11px] font-mono text-slate-400">Scale: {(1 / zoomLevel).toFixed(2)}x</span>
          </div>
          <StatusBadge status="MAP VIEW" variant="default" />
        </div>

        {/* Map Tactical Canvas Viewport */}
        <div
          className="relative h-60 w-full flex items-center justify-center bg-slate-950 rounded border border-slate-800 overflow-hidden select-none"
          data-testid="live-map-viewport"
        >
          {/* SVG Tactical Grid Canvas */}
          <svg
            className="w-full h-full"
            viewBox="-150 -120 300 240"
            preserveAspectRatio="xMidYMid meet"
            aria-label="UGV Tactical Coordinate Map"
          >
            <defs>
              <pattern
                id="tactical-grid-pattern"
                width={30 * zoomLevel}
                height={30 * zoomLevel}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${30 * zoomLevel} 0 L 0 0 0 ${30 * zoomLevel}`}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="0.75"
                  strokeDasharray="2,4"
                />
              </pattern>
            </defs>

            {/* Background Grid Pattern */}
            {showGrid && (
              <rect
                x="-150"
                y="-120"
                width="300"
                height="240"
                fill="url(#tactical-grid-pattern)"
              />
            )}

            {/* Concentric Range Rings (5m, 10m, 15m radius equivalents) */}
            <circle
              cx="0"
              cy="0"
              r={35 * zoomLevel}
              fill="none"
              stroke="#334155"
              strokeWidth="0.75"
              strokeDasharray="3,3"
            />
            <circle
              cx="0"
              cy="0"
              r={70 * zoomLevel}
              fill="none"
              stroke="#334155"
              strokeWidth="0.75"
              strokeDasharray="3,3"
            />
            <circle
              cx="0"
              cy="0"
              r={105 * zoomLevel}
              fill="none"
              stroke="#1e293b"
              strokeWidth="0.75"
              strokeDasharray="3,3"
            />

            {/* Coordinate Crosshairs */}
            <line x1="-150" y1="0" x2="150" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="4,6" />
            <line x1="0" y1="-120" x2="0" y2="120" stroke="#334155" strokeWidth="1" strokeDasharray="4,6" />

            {/* Range annotations */}
            <text x="3" y={-35 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
              5m
            </text>
            <text x="3" y={-70 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
              10m
            </text>
            <text x="3" y={-105 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
              15m
            </text>

            {/* Directional Axes */}
            <text x="135" y="-4" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">
              +Y (Right)
            </text>
            <text x="4" y="-108" fill="#94a3b8" fontSize="8" fontFamily="monospace">
              +X (Forward)
            </text>

            {/* Forward Orientation Sector (Neutral Reference) */}
            <polygon
              points={`0,0 ${-45 * zoomLevel},${-75 * zoomLevel} ${45 * zoomLevel},${-75 * zoomLevel}`}
              fill="rgba(148, 163, 184, 0.04)"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />

            {/* UGV Robot Marker */}
            <g transform="translate(0, 0)">
              {/* Outer safety aura */}
              <circle
                cx="0"
                cy="0"
                r={16 * zoomLevel}
                fill="none"
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth="1.5"
                strokeDasharray="2,3"
              />
              {/* Robot Chassis Footprint */}
              <rect
                x={-9 * zoomLevel}
                y={-12 * zoomLevel}
                width={18 * zoomLevel}
                height={24 * zoomLevel}
                rx={3 * zoomLevel}
                fill="#0f172a"
                stroke="#10b981"
                strokeWidth="1.5"
              />
              {/* Heading Indicator Chevron */}
              <path
                d={`M 0 ${-16 * zoomLevel} L ${-5 * zoomLevel} ${-7 * zoomLevel} L 0 ${-9 * zoomLevel} L ${5 * zoomLevel} ${-7 * zoomLevel} Z`}
                fill="#38bdf8"
              />
              {/* Center Origin Dot */}
              <circle cx="0" cy="0" r={2.5 * zoomLevel} fill="#38bdf8" />
            </g>
          </svg>

          {/* Viewport Corner Reticle Marks */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-slate-700 pointer-events-none" />

          {/* Map Controls Floating Overlay */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 bg-slate-900/80 backdrop-blur-sm p-1 rounded-md border border-slate-800 shadow-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom In Map"
              title="Zoom In"
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom Out Map"
              title="Zoom Out"
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRecenter}
              aria-label="Recenter Map View"
              title="Recenter Origin"
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((prev) => !prev)}
              aria-label="Toggle Coordinate Grid"
              title="Toggle Grid Lines"
              className={`p-1.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                showGrid ? 'text-sky-400 bg-sky-950/40' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Map Footer Metadata */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Reference Frame</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate" title="Reference coordinate frame: odom -> base_link">
              odom / base_link (ref)
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Grid Division</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs">1.0 m / div</div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Projection</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs">2D Orthographic</div>
          </div>
        </div>
      </div>
    </Panel>
  );
};
