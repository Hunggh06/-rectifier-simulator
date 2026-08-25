# SPEC — CircuitSchematic.tsx

Target file (create): `src/components/schematic/CircuitSchematic.tsx`
Read first: `src/types/simulator.ts` (types already exist — import them, never redefine).

## Component contract (EXACT)

```tsx
"use client";
import type { CatalogEntry, LoadType, ValveStateMap } from "@/types/simulator";

interface CircuitSchematicProps {
  entry: CatalogEntry | null;
  valveStates: ValveStateMap;   // {"D1":"conducting", ...}; missing keys => "forward-blocked"
  loadType: LoadType;
  thetaDeg: number;             // 0..720 current sweep angle
  className?: string;
}
export function CircuitSchematic(props: CircuitSchematicProps): JSX.Element;
```

Pure presentational. NO store import, NO canvas/chart libs, NO framer-motion.
Allowed imports: `react`, lucide-react icons, `@/types/simulator`.

## Topologies (ALL 11 must be implemented — no placeholders)

topology values from CatalogEntry:
- `tap1p-diode`, `tap1p-thyristor`: AC source → center-tapped secondary (u21/u22 dot marks), two vertical valve branches → common top node → load (R [+ L]) → center tap return.
- `bridge1p-diode`, `bridge1p-thyristor`, `bridge1p-semi`: 4-valve diamond bridge from AC source u2; semi = thyristors V1/V3 on TOP rail, diodes D4/D2 BOTTOM (valveLabels order [V1,V3,D2,D4]).
- `tap3p-diode`, `tap3p-thyristor`: star secondaries ua/ub/uc, three valve branches to common cathode rail → load → neutral.
- `bridge3p-diode`, `bridge3p-thyristor`, `bridge3p-misfire`, `bridge3p-semi`: 6-valve bridge. Upper rail L→R: V1(a), V3(b), V5(c); lower rail: V4(a), V6(b), V2(c). misfire adds warning badge text "SAI THỨ TỰ KÍCH". semi: upper SCR V1/V3/V5 + lower diode D4/D6/D2.

## Drawing rules

- One SVG viewBox="0 0 640 380" responsive; wires stroke `var(--line-strong)` width 1.5; junction dots r=2.5.
- Diode symbol: filled triangle + bar. Thyristor: same + short angled gate lead.
- Valve label = mono 11px fill var(--ink-2) placed beside each valve.
- Load: IEC resistor box labeled R; when loadType==="RL" add series inductor bumps labeled L. Output "+" / "−", ud/id arrows.
- Title row (HTML above svg): circuitName + topology chip (10px uppercase border-line rounded).
- entry===null → dashed-border empty panel "Chọn một mạch để hiển thị sơ đồ".

## Live state reaction

- conducting → color var(--sig-on) #34d399 + subtle glow filter; forward-blocked → var(--ink-3); reverse-blocked → var(--sig-warn) #fb7185.
- Current particles: per CONDUCTING branch, 2–3 circles r=2.5 animated along the branch wire via SMIL `<animateMotion>` + `<mpath>` (dur 1.2s, staggered begin). Flowing dash overlay on DC output wire (stroke-dasharray 6 10 + CSS keyframes stroke-dashoffset infinite linear). Gate stub blinks when its thyristor conducts.
- All animation disabled under `prefers-reduced-motion` (embed a `<style>` media query inside the SVG).
- Deterministic unique ids prefixed `cs-<catalogId>-`.

## Quality bar

Strict TS: no `any`, no ts-ignore. Vietnamese comments/labels. Factor shared sub-components in-file (ValveSymbol, Wire, ResistorBox, InductorCoil, SourceCircle, JunctionDot...). Self-review after writing: every sub-component defined, JSX closed, switch covers all 11 cases.
