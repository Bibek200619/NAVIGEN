import React, { useState } from 'react';
import { Crosshair, Plus, Minus, Layers } from 'lucide-react';
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
    <section className={`camera-viewer compact ${className}`} aria-label="Live map">
      <header className="section-heading">
        <h2>Live map</h2>
        <StatusBadge status="MAP VIEW" variant="default" />
      </header>

      <div className="map-stage" data-testid="live-map-viewport">
        <svg
          className="w-full h-full"
          viewBox="-150 -120 300 240"
          preserveAspectRatio="xMidYMid meet"
          aria-label="UGV tactical coordinate map"
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

          {showGrid && (
            <rect
              x="-150"
              y="-120"
              width="300"
              height="240"
              fill="url(#tactical-grid-pattern)"
            />
          )}

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

          <line x1="-150" y1="0" x2="150" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="4,6" />
          <line x1="0" y1="-120" x2="0" y2="120" stroke="#334155" strokeWidth="1" strokeDasharray="4,6" />

          <text x="3" y={-35 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
            5m
          </text>
          <text x="3" y={-70 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
            10m
          </text>
          <text x="3" y={-105 * zoomLevel + 4} fill="#64748b" fontSize="7" fontFamily="monospace">
            15m
          </text>

          <text x="135" y="-4" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">
            +Y (Right)
          </text>
          <text x="4" y="-108" fill="#94a3b8" fontSize="8" fontFamily="monospace">
            +X (Forward)
          </text>

          <polygon
            points={`0,0 ${-45 * zoomLevel},${-75 * zoomLevel} ${45 * zoomLevel},${-75 * zoomLevel}`}
            fill="rgba(148, 163, 184, 0.04)"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />

          <g transform="translate(0, 0)">
            <circle
              cx="0"
              cy="0"
              r={16 * zoomLevel}
              fill="none"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="1.5"
              strokeDasharray="2,3"
            />
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
            <path
              d={`M 0 ${-16 * zoomLevel} L ${-5 * zoomLevel} ${-7 * zoomLevel} L 0 ${-9 * zoomLevel} L ${5 * zoomLevel} ${-7 * zoomLevel} Z`}
              fill="#38bdf8"
            />
            <circle cx="0" cy="0" r={2.5 * zoomLevel} fill="#38bdf8" />
          </g>
        </svg>

        <div className="map-controls">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom In Map"
            title="Zoom In"
            className="icon-button"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom Out Map"
            title="Zoom Out"
            className="icon-button"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Recenter Map View"
            title="Recenter Origin"
            className="icon-button"
          >
            <Crosshair size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            aria-label="Toggle Coordinate Grid"
            title="Toggle Grid Lines"
            className="icon-button"
          >
            <Layers size={14} />
          </button>
        </div>
      </div>

      <div className="map-toolbar">
        <span>Ref: odom → base_link · Scale: {(1 / zoomLevel).toFixed(2)}x</span>
        <span>2D orthographic · 1.0 m / div</span>
      </div>
    </section>
  );
};
