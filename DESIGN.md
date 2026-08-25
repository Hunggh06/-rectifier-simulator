# DESIGN.md — Rectifier Simulator

Technical dark-mode engineering console for teaching power-electronics rectifiers (Điện tử công suất — Chương 2). Data-driven: every waveform comes from a Simulink-verified JSON dataset.

## Palette (locked roles)

| Token | Hex | Role |
|---|---|---|
| surface-0..3 | `#0a0c10 → #1d222e` | layered cool-zinc backgrounds, no pure black |
| line / line-strong | `#232936` / `#333b4d` | hairlines & borders |
| ink-1/2/3 | `#e7eaf0 / #98a1b3 / #626c80` | primary/secondary/tertiary text |
| sig-sim | `#22d3ee` cyan | **Simulink measured** waveforms (solid stroke) |
| sig-theory | `#f5a524` amber | **analytic theory** waveforms (dashed stroke) |
| sig-scrub | `#ef4444` red | phase-angle scrubber only |
| sig-on | `#34d399` green | conducting valve state |
| sig-gate | `#a78bfa` violet | gate pulse traces |
| sig-warn | `#fb7185` rose | reverse-blocking states / error |

Rules: one accent per semantic role across the whole app; never repurpose the red scrubber color elsewhere.

## Typography

- Sans: Outfit (`--font-sans`) for labels/UI copy.
- Mono: JetBrains Mono (`--font-mono`) for ALL numeric readouts, axis ticks, table values (`tabular-nums`).
- No serif anywhere.

## Shape & spacing

- Radius: 8px panels, 6px buttons/inputs, 3px scrubber thumb. Consistent everywhere.
- Panels: `border border-line bg-surface-1 shadow-panel`; headers use 13px uppercase tracking-wide ink-2.
- Density: cockpit-grade but breathable; grid layouts, 1px separators over nested cards.

## Motion

- Scrubber sync is instant (driven by pointer/state); particle flow in schematics uses CSS `offset-path`/transform loops gated by `prefers-reduced-motion`.
- Hover: border brightens + subtle bg lift only. Active buttons: `scale-[0.98]`.

## Accessibility constraints

- WCAG AA contrast on all text (ink-2 minimum on surface-1).
- Sliders are real `<input type="range">` with aria-labels; milestone stepping reachable via keyboard buttons.
- Reduced motion collapses particle animation and auto-play.
