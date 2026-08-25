
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
      dir: "down",
      x: 380,
      y: 102,
      branchPath: "M 380 80 V 170",
    },
    {
      label: `${L}3`,
      kind: topKind,
      dir: "down",
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
