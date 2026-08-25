
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
        dir: "down" as const,
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
