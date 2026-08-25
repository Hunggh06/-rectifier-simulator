"use client";

/**
 * CircuitSchematic — sơ đồ nguyên lý động cho 11 topology chỉnh lưu.
 * Data-driven: mỗi topology trả về model (van, dây, path hạt dòng),
 * render thống nhất; animation tắt theo prefers-reduced-motion.
 */

import type { CatalogEntry, LoadType, ValveState, ValveStateMap } from "@/types/simulator";

type ValveKind = "diode" | "thyristor";
type ValveDir = "up" | "down";

interface ValvePlacement {
  label: string;
  kind: ValveKind;
  dir: ValveDir;
  x: number;
  y: number;
  branchPath: string;
}

interface SchematicModel {
  valves: ValvePlacement[];
  body: React.ReactNode;
  dcFlowPath?: string;
}

const COLOR_CONDUCTING = "#34d399";
const COLOR_FORWARD = "#626c80";
const COLOR_REVERSE = "#fb7185";
const WIRE = "var(--line-strong)";
const LABEL_INK = "var(--ink-2)";

function stateColor(state: ValveState | undefined): string {
  if (state === "conducting") return COLOR_CONDUCTING;
  if (state === "reverse-blocked") return COLOR_REVERSE;
  return COLOR_FORWARD;
}

function Wire({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={WIRE} strokeWidth={1.5} strokeLinecap="round" />;
}

function JunctionDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={2.6} fill={WIRE} />;
}

function Txt({
  x,
  y,
  children,
  anchor = "start",
  italic = false,
  size = 11,
  color = LABEL_INK,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  anchor?: "start" | "middle" | "end";
  italic?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontStyle={italic ? "italic" : "normal"}
      fill={color}
      className="font-mono"
    >
      {children}
    </text>
  );
}

/** Van: tam giác + thanh; dir = hướng dòng qua van; thyristor có chân gate */
function ValveSymbol({
  v,
  state,
  glowId,
}: {
  v: ValvePlacement;
  state: ValveState | undefined;
  glowId: string;
}) {
  const color = stateColor(state);
  const conducting = state === "conducting";
  const flip = v.dir === "up" ? 180 : 0;
  return (
    <g>
      <g transform={`translate(${v.x},${v.y}) rotate(${flip})`}>
        <line x1={0} y1={-22} x2={0} y2={-9} stroke={color} strokeWidth={1.8} />
        <polygon
          points="-9,-9 9,-9 0,8"
          fill={color}
          fillOpacity={conducting ? 0.45 : 0.18}
          stroke={color}
          strokeWidth={1.8}
          filter={conducting ? `url(#${glowId})` : undefined}
        />
        <line x1={-9} y1={9} x2={9} y2={9} stroke={color} strokeWidth={2.2} />
        <line x1={0} y1={9} x2={0} y2={22} stroke={color} strokeWidth={1.8} />
        {v.kind === "thyristor" && (
          <g className={conducting ? "cs-gate-blink" : undefined}>
            <line x1={7} y1={9} x2={15} y2={15} stroke={color} strokeWidth={1.4} />
            <line x1={12} y1={18} x2={18} y2={12} stroke={color} strokeWidth={1.6} />
          </g>
        )}
      </g>
      <Txt x={v.x + 15} y={v.dir === "up" ? v.y + 20 : v.y - 14} color={color}>
        {v.label}
      </Txt>
    </g>
  );
}

/** Hạt dòng chạy dọc nhánh đang dẫn (SMIL) */
function FlowParticles({ d, count = 3, dur = 1.2 }: { d: string; count?: number; dur?: number }) {
  return (
    <g className="cs-flow">
      {Array.from({ length: count }).map((_, i) => (
        <circle key={i} r={2.6} fill={COLOR_CONDUCTING}>
          <animateMotion
            dur={`${dur}s`}
            begin={`${((i * dur) / count).toFixed(2)}s`}
            repeatCount="indefinite"
            path={d}
          />
        </circle>
      ))}
    </g>
  );
}
