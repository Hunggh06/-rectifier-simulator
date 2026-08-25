# SPEC — MultiChannelCanvas.tsx

Target file (create): `src/components/oscilloscope/MultiChannelCanvas.tsx`
Read first: `src/types/simulator.ts` (import types, never redefine).

## Component contract (EXACT)

```tsx
"use client";
import type { CircuitMilestone, CircuitWaveforms, WaveLayerVisibility } from "@/types/simulator";

interface MultiChannelCanvasProps {
  waveforms: CircuitWaveforms | null;
  thetaDeg: number;                 // scrubber 0..720
  layers: WaveLayerVisibility;
  milestones?: CircuitMilestone[];  // vertical dashed markers color var(--sig-gate) alpha .4
  isThreePhase?: boolean;           // plot ub/uc (shift −120°/−240°, same peak as uSource) faint behind ua
  className?: string;
}
export function MultiChannelCanvas(props: MultiChannelCanvasProps): JSX.Element;
```

Pure presentational props-only. Allowed imports: react (+ hooks), lucide-react. NO chart libs.

## Channels top→bottom (fixed lanes; a fully-disabled lane stays visible but dimmed with "tắt" hint — never collapse)

1. CH1 `ua — Điện áp nguồn [V]`: uSource gray #8b93a7 (+ub/uc at 35% alpha when isThreePhase)
2. CH2 `ud — Điện áp chỉnh lưu [V]`: udTheory DASHED var(--sig-theory)=#f5a524 lw1.4 dash[6,4]; udSimulink SOLID var(--sig-sim)=#22d3ee lw1.8
3. CH3 `id — Dòng điện tải [A]`: idSimulink var(--sig-on)=#34d399
4. CH4 `uT — Điện áp trên van 1 [V]`: uVan1 var(--sig-warn)=#fb7185
5. CH5 `iT — Dòng qua van 1 [A]`: iVan1 #60a5fa
6. CH6 `Gate — Xung kích van 1 [–]`: gatePulses DIGITAL step waveform lw2 var(--sig-gate)=#a78bfa

Layer visibility flags map: udTheory→CH2 theory, udSimulink→CH2 sim, idSimulink→CH3, uVan1→CH4, iVan1→CH5, gatePulses→CH6. CH1 always on.

## Rendering

- ONE `<canvas>` in a wrapper div. Channel height 110px content + 26px header strip each; bottom x-axis strip 28px. Width = wrapper clientWidth via ResizeObserver; devicePixelRatio scaling (canvas.width=cssW*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)).
- Redraw on resize + every prop change (useEffect deps).
- Layout paddings: left 44 (y labels), right 56 (min/max labels), top/bottom small.
- Per channel: niceMax auto-scale (steps 1/2/5×10^k ≥ max*1.05; bipolar → symmetric ±max), zero-baseline line var(--line); min/max mono 10px fill var(--ink-3) right side.
- Grid: major vertical every 90° solid var(--line); minor every 30° dotted alpha .35; tick labels 0°..720° mono 10px on bottom strip only.
- Channel header text inside canvas: `CH2 · UD — ĐIỆN ÁP CHỈNH LƯU [V]` mono 10px uppercase fill var(--ink-2).
- SCRUBBER across ALL channels full height: line 1.5px var(--sig-scrub)=#ef4444; triangle handle top; chip `θ = xxx°` mono bg rgba(239,68,68,.15) border rgba(239,68,68,.4) rounded px-1.5; flips side near right edge.
- Milestone markers: dashed vertical lines alpha .4 violet with tiny dot at top; skip if undefined.
- Empty state: grid + centered "Không có dữ liệu dạng sóng" ink-3.
- HTML legend row above canvas (flex gap-4): sample swatches — dashed amber "Lý thuyết", solid cyan "Simulink", red bar "Vạch quét θ".

Quality bar: strict TS (no any/ts-ignore), Vietnamese labels, self-review after writing (hooks deps correct, no NaN when arrays empty, canvas cleaned up on unmount — cancel ResizeObserver).
