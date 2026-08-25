"use client";

/**
 * CircuitSchematic — sơ đồ nguyên lý động cho 11 topology chỉnh lưu.
 * Data-driven: mỗi topology trả về model (van, dây, path hạt dòng),
 * render thống nhất; animation tắt theo prefers-reduced-motion.
 */

import type { CatalogEntry, LoadType, ValveState, ValveStateMap } from "@/types/simulator";

type ValveKind = "diode" | "thyristor" | "igbt";
type ValveDir = "up" | "down";

interface ValvePlacement {
  label: string;
  kind: ValveKind;
  dir: ValveDir;
  x: number;
  y: number;
  branchPath: string;
  rot?: number;
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
  return (
    <path
      d={d}
      fill="none"
      stroke={WIRE}
      strokeWidth={1.8}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function JunctionDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} fill={WIRE} />;
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
      <g transform={`translate(${v.x},${v.y}) rotate(${flip + (v.rot ?? 0)})`}>
        <line x1={0} y1={-22} x2={0} y2={-9} stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        <polygon
          points="-9,-9 9,-9 0,8"
          fill={color}
          fillOpacity={conducting ? 0.45 : 0.18}
          stroke={color}
          strokeWidth={1.8}
          vectorEffect="non-scaling-stroke"
          filter={conducting ? `url(#${glowId})` : undefined}
        />
        <line x1={-9} y1={9} x2={9} y2={9} stroke={color} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={9} x2={0} y2={22} stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        {v.kind === "thyristor" && (
          <g className={conducting ? "cs-gate-blink" : undefined}>
            <line x1={7} y1={9} x2={15} y2={15} stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            <line x1={12} y1={18} x2={18} y2={12} stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {v.kind === "igbt" && (
          <g className={conducting ? "cs-gate-blink" : undefined}>
            <rect x={-7} y={-9} width={14} height={18} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            <Txt x={0} y={4} anchor="middle" size={9} color={color}>
              T
            </Txt>
            <line x1={-22} y1={0} x2={-7} y2={0} stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
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

/** Tải dọc: hộp trở R + cuộn cảm L (khi RL) */
function LoadBlock({
  x,
  y,
  loadType,
}: {
  x: number;
  y: number;
  loadType: LoadType;
}) {
  const hasL = loadType === "RL";
  const bumps = [0, 1, 2, 3]
    .map((i) => `M ${x} ${y + 74 + i * 16} a 8 8 0 0 1 0 16`)
    .join(" ");
  return (
    <g>
      <rect x={x - 13} y={y} width={26} height={58} rx={3} fill="none" stroke={WIRE} strokeWidth={1.6} />
      <Txt x={x + 19} y={y + 33}>R</Txt>
      {hasL && (
        <>
          <path d={bumps} fill="none" stroke={WIRE} strokeWidth={1.6} strokeLinecap="round" />
          <Txt x={x + 19} y={y + 108}>L</Txt>
        </>
      )}
    </g>
  );
}

/** Nguồn AC: vòng tròn có hình sin */
function SourceCircle({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={15} fill="none" stroke={WIRE} strokeWidth={1.6} />
      <path
        d={`M ${x - 8} ${y} q 4 -8 8 0 q 4 8 8 0`}
        fill="none"
        stroke={LABEL_INK}
        strokeWidth={1.3}
      />
      {label && <Txt x={x - 22} y={y + 4} anchor="end" italic>{label}</Txt>}
    </g>
  );
}

/** Máy biến áp 1 pha: primary + core + secondary (có thể 2 cuộn cho điểm giữa) */
function Transformer1P({ centerTap }: { centerTap: boolean }) {
  const bump = (x: number, y: number) => `M ${x} ${y} a 9 9 0 0 1 0 18`;
  const coil = (x: number, yTop: number, n: number) =>
    Array.from({ length: n }, (_, i) => bump(x, yTop + i * 18)).join(" ");
  return (
    <g>
      <path d={coil(118, 112, 4)} fill="none" stroke={WIRE} strokeWidth={1.6} strokeLinecap="round" />
      <line x1={150} y1={92} x2={150} y2={288} stroke={WIRE} strokeWidth={1.4} />
      <line x1={156} y1={92} x2={156} y2={288} stroke={WIRE} strokeWidth={1.4} />
      {centerTap ? (
        <>
          <path d={coil(190, 102, 4)} fill="none" stroke={WIRE} strokeWidth={1.6} strokeLinecap="round" />
          <path d={coil(190, 202, 4)} fill="none" stroke={WIRE} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={176} cy={106} r={2.2} fill={LABEL_INK} />
          <circle cx={204} cy={206} r={2.2} fill={LABEL_INK} />
          <Txt x={200} y={90} italic>u21</Txt>
          <Txt x={200} y={294} italic>u22</Txt>
        </>
      ) : (
        <>
          <path d={coil(190, 132, 4)} fill="none" stroke={WIRE} strokeWidth={1.6} strokeLinecap="round" />
          <Txt x={200} y={120} italic>u2</Txt>
        </>
      )}
    </g>
  );
}

/* ================================================================== */
/* Builder — 1 pha tia hai nửa (diode / thyristor), điểm giữa thứ cấp   */
/* ================================================================== */

function buildTap1P(kind: ValveKind, loadType: LoadType): SchematicModel {
  const L = kind === "diode" ? "D" : "V";
  const railY = 134;
  void railY;
  const coilEnd = loadType === "RL" ? 287 : 207;
  return {
    valves: [
      {
        label: `${L}1`,
        kind,
        dir: "down",
        x: 360,
        y: 112,
        branchPath: "M 190 100 V 70 H 360 V 134",
      },
      {
        label: `${L}2`,
        kind,
        dir: "up",
        x: 360,
        y: 258,
        branchPath: "M 190 280 V 300 H 360 V 236",
      },
    ],
    body: (
      <g>
        <SourceCircle x={58} y={190} />
        <Wire d="M 74 182 H 96 V 110 H 118" />
        <Wire d="M 74 198 H 96 V 270 H 118" />
        <Transformer1P centerTap />
        <Wire d="M 190 100 V 70 H 360 V 90" />
        <Wire d="M 360 134 H 600" />
        <Wire d="M 360 134 V 236" />
        <Wire d="M 190 280 V 300 H 360 V 280" />
        <Wire d="M 190 190 H 168 V 330 H 600" />
        <JunctionDot x={190} y={190} />
        <LoadBlock x={600} y={149} loadType={loadType} />
        <Wire d={`M 600 ${coilEnd} V 330`} />
        <Txt x={614} y={128} color="var(--sig-sim)">+</Txt>
        <Txt x={614} y={342} color="var(--sig-sim)">−</Txt>
        <line x1={572} y1={158} x2={572} y2={coilEnd - 12} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={564} y={210} anchor="end" italic>ud</Txt>
        <line x1={420} y1={124} x2={480} y2={124} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={444} y={118} anchor="middle" italic>id</Txt>
      </g>
    ),
    dcFlowPath: `M 360 134 H 600 V ${coilEnd} V 330 H 168`,
  };
}

/* ================================================================== */
/* Builder — cầu 1 pha: diode / thyristor đối xứng / bán điều khiển     */
/* ================================================================== */

function buildBridge1P(
  mode: "diode" | "thyristor" | "semi",
  loadType: LoadType
): SchematicModel {
  const topKind: ValveKind = mode === "diode" ? "diode" : "thyristor";
  const botKind: ValveKind = "diode";
  const L = mode === "diode" ? "D" : "V";
  const D = "D";
  const loadBot = loadType === "RL" ? 249 : 153;
  const valves: ValvePlacement[] = [
    {
      label: `${L}1`,
      kind: topKind,
      dir: "up",
      x: 380,
      y: 102,
      branchPath: "M 380 80 V 170",
    },
    {
      label: `${L}3`,
      kind: topKind,
      dir: "up",
      x: 480,
      y: 102,
      branchPath: "M 480 80 V 170",
    },
    {
      label: mode === "semi" ? `${D}2` : `${L}2`,
      kind: botKind,
      dir: "up",
      x: 480,
      y: 298,
      branchPath: "M 480 320 V 210",
    },
    {
      label: mode === "semi" ? `${D}4` : `${L}4`,
      kind: botKind,
      dir: "up",
      x: 380,
      y: 298,
      branchPath: "M 380 320 V 210",
    },
  ];
  return {
    valves,
    body: (
      <g>
        <SourceCircle x={58} y={190} />
        <Wire d="M 74 182 H 96 V 110 H 118" />
        <Wire d="M 74 198 H 96 V 270 H 118" />
        <Transformer1P centerTap={false} />
        <Wire d="M 190 132 H 260 V 170 H 380 V 190" />
        <Wire d="M 190 248 V 250 H 230 V 210 H 480 V 190" />
        <Wire d="M 380 80 H 480" />
        <Wire d="M 380 320 H 480" />
        <Wire d="M 480 80 H 600" />
        <Wire d="M 480 320 H 600" />
        <JunctionDot x={380} y={190} />
        <JunctionDot x={480} y={190} />
        <LoadBlock x={600} y={95} loadType={loadType} />
        <Wire d={`M 600 ${loadBot} V 320`} />
        <Txt x={560} y={72} color="var(--sig-sim)">+</Txt>
        <Txt x={560} y={334} color="var(--sig-sim)">−</Txt>
        <line x1={572} y1={104} x2={572} y2={loadBot - 12} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={564} y={160} anchor="end" italic>ud</Txt>
        {mode === "semi" && (
          <Txt x={430} y={352} size={10} color="var(--ink-3)">
            Rail trên: SCR · Rail dưới: Diode
          </Txt>
        )}
      </g>
    ),
    dcFlowPath: "M 380 80 H 600 V 320 H 380",
  };
}

/* ================================================================== */
/* Builder — 3 pha tia (M3): diode / thyristor                          */
/* ================================================================== */

function buildTap3P(kind: ValveKind, loadType: LoadType): SchematicModel {
  const L = kind === "diode" ? "D" : "V";
  const phases = [
    { key: "a", label: `${L}1`, srcY: 140, legX: 360 },
    { key: "b", label: `${L}2`, srcY: 190, legX: 450 },
    { key: "c", label: `${L}3`, srcY: 240, legX: 540 },
  ];
  const coilEnd = loadType === "RL" ? 287 : 207;
  return {
    valves: phases.map((p) => ({
      label: p.label,
      kind,
      dir: "up" as const,
      x: p.legX,
      y: 118,
      branchPath: `M ${p.srcY === 140 ? 194 : 194} ${p.srcY} H ${p.legX} V 140`,
    })),
    body: (
      <g>
        {phases.map((p) => (
          <g key={p.key}>
            <SourceCircle x={180} y={p.srcY} label={`u${p.key}`} />
            <Wire d={`M 166 ${p.srcY} H 146`} />
            <Wire d={`M 194 ${p.srcY} H ${p.legX}${p.srcY === 140 ? "" : ` V 140`}`} />
          </g>
        ))}
        <Wire d="M 146 140 V 240" />
        <Wire d="M 146 190 H 122" />
        <Txt x={116} y={182} anchor="middle">N</Txt>
        <line x1={122} y1={196} x2={138} y2={196} stroke={WIRE} strokeWidth={1.4} />
        <line x1={126} y1={200} x2={134} y2={200} stroke={WIRE} strokeWidth={1.4} />
        <line x1={129} y1={204} x2={131} y2={204} stroke={WIRE} strokeWidth={1.4} />
        {phases.map((p) => (
          <g key={`leg-${p.key}`}>
            <Wire d={`M ${p.legX} 96 V 80`} />
            {p.srcY !== 140 && <Wire d={`M ${p.legX} 140 V 118`} />}
            {p.srcY !== 140 && <Wire d={`M ${p.legX} 140 V ${p.srcY}`} />}
          </g>
        ))}
        <Wire d="M 360 80 H 600" />
        <LoadBlock x={600} y={95} loadType={loadType} />
        <Wire d="M 600 320 H 146 V 240" />
        <JunctionDot x={146} y={240} />
        <Wire d={`M 600 ${coilEnd} V 320`} />
        <Txt x={560} y={72} color="var(--sig-sim)">+</Txt>
        <line x1={572} y1={104} x2={572} y2={coilEnd - 12} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={564} y={160} anchor="end" italic>ud</Txt>
        <Txt x={480} y={352} size={10} color="var(--ink-3)" anchor="middle">
          M3 · chung cathode · mỗi van dẫn 120°
        </Txt>
      </g>
    ),
    dcFlowPath: `M 360 80 H 600 V ${coilEnd} V 320 H 146`,
  };
}

/* ================================================================== */
/* Builder — cầu 3 pha: diode / thyristor / misfire / bán điều khiển    */
/* ================================================================== */

function buildBridge3P(
  mode: "diode" | "thyristor" | "misfire" | "semi",
  loadType: LoadType
): SchematicModel {
  const topKind: ValveKind = mode === "diode" ? "diode" : "thyristor";
  const botKind: ValveKind = mode === "semi" || mode === "diode" ? "diode" : "thyristor";
  const topL = mode === "diode" ? "D" : "V";
  const botL = botKind === "diode" ? "D" : "V";
  const TOP = { a: `${topL}1`, b: `${topL}3`, c: `${topL}5` };
  const BOT = { a: `${botL}4`, b: `${botL}6`, c: `${botL}2` };
  const legs = [
    { ph: "a" as const, x: 380, srcY: 145 },
    { ph: "b" as const, x: 460, srcY: 205 },
    { ph: "c" as const, x: 540, srcY: 265 },
  ];
  const feedRoutes: Record<string, string> = {
    a: "M 194 145 H 380 V 190",
    b: "M 194 205 H 420 V 190",
    c: "M 194 265 H 500 V 190",
  };
  const coilEnd = loadType === "RL" ? 287 : 207;
  return {
    valves: legs.flatMap((lg) => [
      {
        label: TOP[lg.ph],
        kind: topKind,
        dir: "up" as const,
        x: lg.x,
        y: 102,
        branchPath: `M ${lg.x} 80 V 170`,
      },
      {
        label: BOT[lg.ph],
        kind: botKind,
        dir: "up" as const,
        x: lg.x,
        y: 298,
        branchPath: `M ${lg.x} 320 V 210`,
      },
    ]),
    body: (
      <g>
        {legs.map((lg) => (
          <g key={lg.ph}>
            <SourceCircle x={180} y={lg.srcY} label={`u${lg.ph}`} />
            <Wire d={`M 166 ${lg.srcY} H 146`} />
            <Wire d={feedRoutes[lg.ph]} />
          </g>
        ))}
        <Wire d="M 146 145 V 265" />
        <Wire d="M 146 205 H 122" />
        <Wire d="M 380 190 H 540" />
        <Txt x={116} y={198} anchor="middle">N</Txt>
        {legs.map((lg) => (
          <g key={`mid-${lg.ph}`}>
            <JunctionDot x={lg.x} y={190} />
          </g>
        ))}
        <Wire d="M 380 80 H 540" />
        <Wire d="M 380 320 H 540" />
        <Wire d="M 540 80 H 600" />
        <Wire d="M 540 320 H 600" />
        <LoadBlock x={600} y={95} loadType={loadType} />
        <Wire d={`M 600 ${coilEnd} V 320`} />
        <Txt x={558} y={72} color="var(--sig-sim)">+</Txt>
        <Txt x={558} y={334} color="var(--sig-sim)">−</Txt>
        <line x1={572} y1={104} x2={572} y2={coilEnd - 12} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={564} y={160} anchor="end" italic>ud</Txt>
        <line x1={430} y1={68} x2={490} y2={68} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={456} y={62} anchor="middle" italic>id</Txt>
        {mode === "misfire" && (
          <g>
            <rect x={396} y={28} width={208} height={22} rx={4}
              fill="rgba(251,113,133,.12)" stroke="var(--sig-warn)" strokeWidth={1} />
            <Txt x={500} y={43} anchor="middle" size={11} color="#fb7185">
              SAI THỨ TỰ KÍCH (V5 ↔ V6)
            </Txt>
          </g>
        )}
        {mode === "semi" && (
          <Txt x={470} y={352} size={10} color="var(--ink-3)" anchor="middle">
            Rail trên: SCR · Rail dưới: Diode
          </Txt>
        )}
      </g>
    ),
    dcFlowPath: `M 380 80 H 600 V ${coilEnd} V 320 H 380`,
  };
}

/* ================================================================== */
/* Chương 3 — Điều áp AC 1 pha / 3 pha                                 */
/* ================================================================== */

function buildACReg1P(loadType: LoadType): SchematicModel {
  const coilEnd = loadType === "RL" ? 249 : 153;
  return {
    valves: [
      { label: "T1", kind: "thyristor", dir: "down", x: 380, y: 140, branchPath: "M 380 90 V 190" },
      { label: "T2", kind: "thyristor", dir: "up", x: 380, y: 250, branchPath: "M 380 190 V 310" },
    ],
    body: (
      <g>
        <SourceCircle x={70} y={200} label="u2" />
        <Wire d="M 86 192 H 380" />
        <Wire d="M 86 208 H 120 V 310 H 380" />
        <Wire d="M 380 90 V 118" />
        <Wire d="M 380 162 V 190" />
        <Wire d="M 380 190 V 228" />
        <Wire d="M 380 272 V 310" />
        <JunctionDot x={380} y={190} />
        <Wire d="M 380 90 H 560" />
        <Wire d="M 380 310 H 560" />
        <LoadBlock x={560} y={95} loadType={loadType} />
        <Wire d={`M 560 ${coilEnd} V 310`} />
        <Txt x={575} y={85} color="var(--sig-sim)">+</Txt>
        <line x1={572} y1={104} x2={572} y2={coilEnd - 12} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={562} y={160} anchor="end" italic>u tải</Txt>
        <Txt x={430} y={352} size={10} color="var(--ink-3)" anchor="middle">
          2 SCR ngược song song · cắt góc α
        </Txt>
      </g>
    ),
    dcFlowPath: "M 380 90 H 600 V 320 H 380",
  };
}

function buildACReg3P(loadType: LoadType): SchematicModel {
  void loadType;
  const legs = [
    { ph: "a" as const, x: 380, srcY: 145, zy: 120 },
    { ph: "b" as const, x: 460, srcY: 205, zy: 190 },
    { ph: "c" as const, x: 540, srcY: 265, zy: 260 },
  ];
  const feedRoutes: Record<string, string> = {
    a: "M 194 145 H 380 V 190",
    b: "M 194 205 H 420 V 190",
    c: "M 194 265 H 500 V 190",
  };
  const TOP = { a: "V1", b: "V3", c: "V5" };
  const BOT = { a: "V4", b: "V6", c: "V2" };
  return {
    valves: legs.flatMap((lg) => [
      { label: TOP[lg.ph], kind: "thyristor" as const, dir: "up" as const, x: lg.x, y: 102, branchPath: `M ${lg.x} 80 V 170` },
      { label: BOT[lg.ph], kind: "thyristor" as const, dir: "up" as const, x: lg.x, y: 298, branchPath: `M ${lg.x} 320 V 210` },
    ]),
    body: (
      <g>
        {legs.map((lg) => (
          <g key={lg.ph}>
            <SourceCircle x={180} y={lg.srcY} label={`u${lg.ph}`} />
            <Wire d={`M 166 ${lg.srcY} H 146`} />
            <Wire d={feedRoutes[lg.ph]} />
          </g>
        ))}
        <Wire d="M 146 145 V 265" />
        <Wire d="M 146 205 H 122" />
        <Wire d="M 380 190 H 540" />
        <Txt x={116} y={198} anchor="middle">N</Txt>
        <Wire d="M 380 80 H 540" />
        <Wire d="M 380 320 H 540" />
        {legs.map((lg) => (
          <g key={`z-${lg.ph}`}>
            <JunctionDot x={lg.x} y={190} />
            <Wire d={`M ${lg.x} 190 H 600 V ${lg.zy + 29}`} />
            <rect x={586} y={lg.zy} width={28} height={58} rx={3} fill="none" stroke={WIRE} strokeWidth={1.6} />
            <Txt x={620} y={lg.zy + 33}>Z</Txt>
          </g>
        ))}
        <Wire d="M 614 149 V 289" />
        <Txt x={628} y={222} italic>N</Txt>
        <Txt x={460} y={352} size={10} color="var(--ink-3)" anchor="middle">
          6 SCR · tải sao · u_ZA = nửa u_dây (2 van) hoặc u_pha (3 van)
        </Txt>
      </g>
    ),
    dcFlowPath: undefined,
  };
}

/* ================================================================== */
/* Chương 4 — Buck / Boost                                             */
/* ================================================================== */

function buildBuck(loadType: LoadType): SchematicModel {
  void loadType;
  return {
    valves: [
      { label: "V", kind: "igbt", dir: "down", x: 300, y: 140, branchPath: "M 300 90 V 190" },
      { label: "D0", kind: "diode", dir: "up", x: 300, y: 250, branchPath: "M 300 190 V 310" },
    ],
    body: (
      <g>
        <SourceCircle x={70} y={200} label="E" />
        <Wire d="M 86 192 H 120 V 90 H 300" />
        <Wire d="M 86 208 H 120 V 310 H 540" />
        <Wire d="M 300 90 V 118" />
        <Wire d="M 300 162 V 190" />
        <Wire d="M 300 190 V 228" />
        <Wire d="M 300 272 V 310" />
        <JunctionDot x={300} y={190} />
        <Wire d="M 300 190 H 320" />
        <path d="M 320 190 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0" fill="none" stroke={WIRE} strokeWidth={1.6} />
        <Txt x={356} y={178} italic>L</Txt>
        <Wire d="M 392 190 H 540" />
        <JunctionDot x={440} y={190} />
        <Wire d="M 440 190 V 240" />
        <line x1={424} y1={240} x2={456} y2={240} stroke={WIRE} strokeWidth={2} />
        <line x1={424} y1={250} x2={456} y2={250} stroke={WIRE} strokeWidth={2} />
        <Wire d="M 440 250 V 310" />
        <Txt x={466} y={248} italic>C</Txt>
        <LoadBlock x={540} y={190} loadType="R" />
        <Wire d="M 540 248 V 310" />
        <Txt x={556} y={182} color="var(--sig-sim)">+</Txt>
        <line x1={522} y1={198} x2={522} y2={236} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={512} y={222} anchor="end" italic>U t</Txt>
        <Txt x={420} y={352} size={10} color="var(--ink-3)" anchor="middle">
          U t = D·E ≤ E · trục 360° = chu kỳ T
        </Txt>
      </g>
    ),
    dcFlowPath: "M 300 90 H 540 V 320 H 120",
  };
}

function buildBoost(loadType: LoadType): SchematicModel {
  void loadType;
  return {
    valves: [
      { label: "V", kind: "igbt", dir: "down", x: 270, y: 140, branchPath: "M 270 90 V 310" },
      { label: "D", kind: "diode", dir: "down", rot: -90, x: 360, y: 90, branchPath: "M 270 90 H 560" },
    ],
    body: (
      <g>
        <SourceCircle x={70} y={200} label="E" />
        <Wire d="M 86 192 H 120 V 90 H 150" />
        <Wire d="M 86 208 H 120 V 310 H 560" />
        <path d="M 150 90 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0 a 9 9 0 0 1 18 0" fill="none" stroke={WIRE} strokeWidth={1.6} />
        <Txt x={196} y={78} italic>L</Txt>
        <Wire d="M 222 90 H 560" />
        <Wire d="M 270 90 V 118" />
        <Wire d="M 270 162 V 310" />
        <JunctionDot x={270} y={90} />
        <JunctionDot x={420} y={90} />
        <Wire d="M 420 90 V 240" />
        <line x1={404} y1={240} x2={436} y2={240} stroke={WIRE} strokeWidth={2} />
        <line x1={404} y1={250} x2={436} y2={250} stroke={WIRE} strokeWidth={2} />
        <Wire d="M 420 250 V 310" />
        <Txt x={446} y={248} italic>C</Txt>
        <LoadBlock x={560} y={95} loadType="R" />
        <Wire d="M 560 153 V 310" />
        <Txt x={576} y={85} color="var(--sig-sim)">+</Txt>
        <line x1={542} y1={104} x2={542} y2={141} stroke={LABEL_INK} strokeWidth={1} markerEnd="url(#cs-arrow)" />
        <Txt x={532} y={126} anchor="end" italic>U o</Txt>
        <Txt x={420} y={352} size={10} color="var(--ink-3)" anchor="middle">
          U o = E/(1−D) ≥ E · trục 360° = chu kỳ T
        </Txt>
      </g>
    ),
    dcFlowPath: "M 270 90 H 560 V 320 H 120",
  };
}

/* ================================================================== */
/* Chương 5 — Nghịch lưu nguồn áp 1 pha / 3 pha                        */
/* ================================================================== */

function buildInv1P(loadType: LoadType): SchematicModel {
  const hasL = loadType === "RL";
  const mk = (label: string, x: number, y: number, dir: "up" | "down"): ValvePlacement => ({
    label,
    kind: "igbt",
    dir,
    x,
    y,
    branchPath: `M ${x} ${dir === "down" ? 80 : 320} V ${dir === "down" ? 190 : 190}`,
  });
  return {
    valves: [
      mk("Tr1", 340, 120, "down"),
      mk("Tr3", 460, 120, "down"),
      mk("Tr4", 340, 260, "up"),
      mk("Tr2", 460, 260, "up"),
      { label: "D1", kind: "diode", dir: "up", x: 385, y: 120, branchPath: "" },
      { label: "D3", kind: "diode", dir: "up", x: 505, y: 120, branchPath: "" },
      { label: "D4", kind: "diode", dir: "down", x: 385, y: 260, branchPath: "" },
      { label: "D2", kind: "diode", dir: "down", x: 505, y: 260, branchPath: "" },
    ],
    body: (
      <g>
        <SourceCircle x={70} y={200} label="E" />
        <Wire d="M 86 192 H 120 V 80 H 460" />
        <Wire d="M 86 208 H 120 V 320 H 460" />
        <Wire d="M 340 80 V 98" />
        <Wire d="M 460 80 V 98" />
        <Wire d="M 340 142 V 238" />
        <Wire d="M 460 142 V 238" />
        <Wire d="M 340 282 V 320" />
        <Wire d="M 460 282 V 320" />
        <JunctionDot x={340} y={190} />
        <JunctionDot x={460} y={190} />
        <Wire d="M 340 190 H 370 V 227" />
        <Wire d="M 460 190 V 227" />
        <rect x={370} y={227} width={60} height={26} rx={3} fill="none" stroke={WIRE} strokeWidth={1.6} />
        <Txt x={400} y={244} anchor="middle">Z</Txt>
        {hasL && <Txt x={400} y={272} size={10} color="var(--ink-3)" anchor="middle">(R–L)</Txt>}
        <Txt x={300} y={186} anchor="end" italic>u z</Txt>
        <Txt x={400} y={352} size={10} color="var(--ink-3)" anchor="middle">
          4 IGBT + 4 diode ngược song song · dẫn 180°
        </Txt>
      </g>
    ),
    dcFlowPath: undefined,
  };
}

function buildInv3P(loadType: LoadType): SchematicModel {
  void loadType;
  const legs = [
    { ph: "a" as const, x: 380, srcY: 145, zy: 120 },
    { ph: "b" as const, x: 460, srcY: 205, zy: 190 },
    { ph: "c" as const, x: 540, srcY: 265, zy: 260 },
  ];
  const feedRoutes: Record<string, string> = {
    a: "M 194 145 H 380 V 190",
    b: "M 194 205 H 420 V 190",
    c: "M 194 265 H 500 V 190",
  };
  const TOP = { a: "Tr1", b: "Tr3", c: "Tr5" };
  const BOT = { a: "Tr4", b: "Tr6", c: "Tr2" };
  return {
    valves: legs.flatMap((lg) => [
      { label: TOP[lg.ph], kind: "igbt" as const, dir: "up" as const, x: lg.x, y: 102, branchPath: `M ${lg.x} 80 V 170` },
      { label: BOT[lg.ph], kind: "igbt" as const, dir: "up" as const, x: lg.x, y: 298, branchPath: `M ${lg.x} 320 V 210` },
    ]),
    body: (
      <g>
        <SourceCircle x={180} y={205} label="E" />
        <Wire d="M 196 197 H 240 V 80 H 540" />
        <Wire d="M 196 213 H 240 V 320 H 540" />
        {legs.map((lg) => (
          <g key={lg.ph}>
            <JunctionDot x={lg.x} y={190} />
            <Wire d={`M ${lg.x} 190 H 600 V ${lg.zy + 29}`} />
            <rect x={586} y={lg.zy} width={28} height={58} rx={3} fill="none" stroke={WIRE} strokeWidth={1.6} />
            <Txt x={620} y={lg.zy + 33}>Z</Txt>
          </g>
        ))}
        <Wire d="M 614 149 V 289" />
        <Txt x={628} y={222} italic>N</Txt>
        <Wire d="M 380 80 H 540" />
        <Wire d="M 380 320 H 540" />
        <Txt x={300} y={120} anchor="end" size={10} color="var(--ink-3)">+E/2</Txt>
        <Txt x={300} y={300} anchor="end" size={10} color="var(--ink-3)">−E/2</Txt>
        <Txt x={460} y={352} size={10} color="var(--ink-3)" anchor="middle">
          6 IGBT dẫn 180° · lệch 60° (kèm diode ngược song song)
        </Txt>
      </g>
    ),
    dcFlowPath: undefined,
  };
}

/* CSS nhúng trong SVG — dash chạy, gate nháy, tắt theo reduced-motion */
const SVG_CSS = `
.cs-flowdash { animation: cs-dashflow 0.9s linear infinite; }
@keyframes cs-dashflow { to { stroke-dashoffset: -74; } }
.cs-gate-blink { animation: cs-gblink 0.9s steps(2, start) infinite; }
@keyframes cs-gblink { 50% { opacity: 0.15; } }
@media (prefers-reduced-motion: reduce) {
  .cs-flow { display: none; }
  .cs-flowdash, .cs-gate-blink { animation: none; }
}
`;

/* ================================================================== */
/* Component chính                                                     */
/* ================================================================== */

export function CircuitSchematic({
  entry,
  valveStates,
  loadType,
  thetaDeg,
  className = "",
}: {
  entry: CatalogEntry | null;
  valveStates: ValveStateMap;
  loadType: LoadType;
  thetaDeg: number;
  className?: string;
}): JSX.Element {
  if (!entry) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-line bg-surface-1 ${className}`}
      >
        <p className="text-sm text-ink-3">Chọn một mạch để hiển thị sơ đồ</p>
      </div>
    );
  }

  let model: SchematicModel;
  switch (entry.topology) {
    case "tap1p-diode":
      model = buildTap1P("diode", loadType);
      break;
    case "tap1p-thyristor":
      model = buildTap1P("thyristor", loadType);
      break;
    case "bridge1p-diode":
      model = buildBridge1P("diode", loadType);
      break;
    case "bridge1p-thyristor":
      model = buildBridge1P("thyristor", loadType);
      break;
    case "bridge1p-semi":
      model = buildBridge1P("semi", loadType);
      break;
    case "tap3p-diode":
      model = buildTap3P("diode", loadType);
      break;
    case "tap3p-thyristor":
      model = buildTap3P("thyristor", loadType);
      break;
    case "bridge3p-diode":
      model = buildBridge3P("diode", loadType);
      break;
    case "bridge3p-thyristor":
      model = buildBridge3P("thyristor", loadType);
      break;
    case "bridge3p-misfire":
      model = buildBridge3P("misfire", loadType);
      break;
    case "bridge3p-semi":
      model = buildBridge3P("semi", loadType);
      break;
    case "ac1p-regulator":
      model = buildACReg1P(loadType);
      break;
    case "ac3p-regulator":
      model = buildACReg3P(loadType);
      break;
    case "dcdc-buck":
      model = buildBuck(loadType);
      break;
    case "dcdc-boost":
      model = buildBoost(loadType);
      break;
    case "inv1p-full":
      model = buildInv1P(loadType);
      break;
    case "inv3p-180":
      model = buildInv3P(loadType);
      break;
  }

  const uid = `cs-${entry.catalogId}`;
  const conductingValves = model.valves.filter(
    (v) => valveStates[v.label] === "conducting"
  );

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-sm font-medium text-ink-1">{entry.circuitName}</h3>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-3">
          {entry.topology}
        </span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-3">
          θ = {Math.round(thetaDeg)}°
        </span>
      </div>
      <svg
        viewBox="0 0 700 400"
        className="h-auto w-full"
        shapeRendering="geometricPrecision"
        role="img"
        aria-label={entry.circuitName}
      >
        <style>{SVG_CSS}</style>
        <defs>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="cs-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill={LABEL_INK} />
          </marker>
        </defs>

        {model.body}

        {model.valves.map((v) => (
          <ValveSymbol key={v.label} v={v} state={valveStates[v.label]} glowId={`${uid}-glow`} />
        ))}

        {conductingValves.map((v) => (
          <FlowParticles key={`flow-${v.label}`} d={v.branchPath} />
        ))}

        {conductingValves.length > 0 && model.dcFlowPath && (
          <path
            d={model.dcFlowPath}
            fill="none"
            stroke={COLOR_CONDUCTING}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray="10 64"
            opacity={0.9}
            className="cs-flowdash"
          />
        )}
      </svg>
      <p className="mt-2 px-1 text-xs leading-relaxed text-ink-3">{entry.descriptionVN}</p>
    </div>
  );
}
