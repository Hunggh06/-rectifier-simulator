
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
      <svg viewBox="0 0 700 400" className="h-auto w-full" role="img" aria-label={entry.circuitName}>
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
