# SPEC — Pedagogical + Comparison components

Two files to create:
1. `src/components/pedagogical/MilestoneExplanation.tsx`
2. `src/components/comparison/TheoryVsSimulinkTable.tsx`

Read first: `src/types/simulator.ts`. KaTeX helper exists: `src/components/ui/Formula.tsx`
exports `Formula({tex, displayMode?, className?})` — use it for symbols.

---

## A) MilestoneExplanation.tsx

```tsx
"use client";
import type { CircuitMilestone } from "@/types/simulator";

interface MilestoneExplanationProps {
  milestone: CircuitMilestone | null;   // null => render nothing
  thetaDeg: number;                     // current sweep position
  onClose: () => void;
  onNext?: () => void;                  // optional prev/next milestone nav
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}
export function MilestoneExplanation(props): JSX.Element;
```

Design (dark technical, matches DESIGN.md):
- Fixed-position card bottom-right (or inline card variant via className merge) — choose an absolutely-positioned floating card anchored bottom-right within its relative parent; parent page wraps it.
- Width ~360px max-w-[calc(100vw-2rem)], bg-surface-2 border-line rounded-lg shadow-panel.
- Header row: Zap icon (lucide, size 14, color var(--sig-gate)) + title (font-medium ink-1, text-sm) + θ chip right-aligned mono `θ=xx°` (bg-surface-3 rounded px-1.5 py-0.5).
- Body: circuitState line (mono 11px uppercase tracking-wide ink-3); description paragraph text-sm ink-2 leading-relaxed.
- activeValves badges: green pills (border rgba(52,211,153,.35), bg rgba(52,211,153,.12), text #34d399, mono 11px) each valve label.
- Footer: prev/next icon buttons (ChevronLeft/Right, disabled state opacity-30 cursor-not-allowed) + close X button top-right corner of header.
- Entrance: CSS transition opacity+translate-y-2 (150ms ease-out) keyed by milestone.theta; respect reduced motion (transition-none under media query is global already).

## B) TheoryVsSimulinkTable.tsx

```tsx
"use client";
import type { CircuitSimulationData } from "@/types/simulator";

interface TheoryVsSimulinkTableProps {
  circuit: CircuitSimulationData | null;
  className?: string;
}
export function TheoryVsSimulinkTable(props): JSX.Element;
```

Rows (when circuit present):
| Đại lượng | Ký hiệu | Lý thuyết | Simulink | Sai số |
- Ud → Formula tex `U_{d}` ; theory metrics.theory.Ud V; sim metrics.simulink.Ud V; error from metrics.simulink.errorPercent
- UngMax → `U_{ng,max}`
- Iavg → `I_{d\,tb}` (sim column shows simulink.Iavg)
- Irms → `I_{rms}` theory column "—" (em dash), sim shows Irms
- Sba → `S_{ba}` theory Sba VA, sim "—"

Formatting: values via `formatSI(v, unit)` helper local fn (e.g. `123.4 V`, `1.25 kVA`) using Intl.NumberFormat('vi-VN') fallback manual; ALL numeric cells font-mono tabular-nums text-right; header cells uppercase 11px ink-3; row borders border-line.
Error cell coloring: <1% → text-[#34d399]; <3% → text-[#f5a524]; else text-[#fb7185]; show `±x.xx %`.
Also a summary strip above table: big error readout "Sai số Ud: x.xx %" + badge "VERIFIED ✓" style (no emoji — use CheckCircle2 lucide icon) when errorPercent < 3.
circuit null → empty hint row "Chưa chọn dữ liệu đối chiếu".

Quality bar: strict TS, no any/ts-ignore, Vietnamese UI text, self-review after writing both files.
