"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { CircuitMilestone, CircuitWaveforms, WaveLayerVisibility } from "@/types/simulator";
import type { AnalyticExtras, ValveCurrentSample } from "@/lib/analyticWaveforms";

interface MultiChannelCanvasProps {
  waveforms: CircuitWaveforms | null;
  thetaDeg: number;
  layers: WaveLayerVisibility;
  milestones?: CircuitMilestone[];
  isThreePhase?: boolean;
  extras?: AnalyticExtras | null;
  sourceName?: string;
  className?: string;
}

export function MultiChannelCanvas({
  waveforms,
  thetaDeg,
  layers,
  milestones,
  isThreePhase = false,
  extras = null,
  sourceName,
  className = "",
}: MultiChannelCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const dpr = useMemo(() => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1), []);

  // Channel configuration — 6 LANE cố định; một lane có thể chứa nhiều trace chồng nhau
  const HEADER_HEIGHT = 26;
  const X_AXIS_HEIGHT = 28;
  const LEFT_PADDING = 44;
  const RIGHT_PADDING = 56;
  const TOP_PADDING = 8;
  const BOTTOM_PADDING = 8;

  interface TraceDef {
    key: string;
    color: string;
    dataKey: keyof CircuitWaveforms | "custom";
    visible: boolean;
    isDigital?: boolean;
    lineWidth: number;
    dash: number[];
    /** độ mờ khi vẽ (ub/uc nền mờ phía sau ua) */
    alpha?: number;
    /** dịch pha sóng [độ] — dùng cho ub (+120°), uc (+240°) */
    shiftDeg?: number;
    /** dữ liệu giải tích tự tính (φE/φF, i_MBA) — ưu tiên hơn dataKey */
    custom?: number[];
  }
  interface ValveRowSet {
    labels: string[];
    cells: ValveCurrentSample[][];
  }
  interface GateRowSet {
    labels: string[];
    pulses: number[][];
  }
  interface LaneDef {
    label: string;
    kind?: "wave" | "valveRows" | "gateRows";
    scaleGroup?: "V" | "A";
    height?: number;
    traces: TraceDef[];
    valveRows?: ValveRowSet;
    gateRows?: GateRowSet;
  }

  const ROW_PALETTE = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#38bdf8"];
  const CHANNEL_HEIGHT = 96;

  const lanes = useMemo<LaneDef[]>(() => {
    const mkTrace = (
      key: string,
      color: string,
      dataKey: keyof CircuitWaveforms | "custom",
      visible: boolean,
      opts?: Partial<TraceDef>
    ): TraceDef => ({
      key,
      color,
      dataKey,
      visible,
      lineWidth: 1.8,
      dash: [],
      ...opts,
    });
    const hasValveRows = !!extras && extras.valveLabels.length > 0;
    const hasGates = !!extras && extras.gateLabels.length > 0;
    const list: LaneDef[] = [
      {
        label:
          "CH1 · NGUỒN " +
          (sourceName ?? (isThreePhase ? "UA UB UC" : "U2")) +
          " [V]",
        scaleGroup: "V",
        traces: [
          ...(isThreePhase
            ? [
                mkTrace("ub", "#8b93a7", "uSource", true, { alpha: 0.35, shiftDeg: 120 }),
                mkTrace("uc", "#8b93a7", "uSource", true, { alpha: 0.35, shiftDeg: 240 }),
              ]
            : []),
          mkTrace("ua", "#8b93a7", "uSource", true),
          ...(extras?.phiE
            ? [
                mkTrace("phiE", "#22d3ee", "custom", true, {
                  custom: extras.phiE,
                  lineWidth: 1,
                  dash: [5, 4],
                  alpha: 0.75,
                }),
                mkTrace("phiF", "#fb7185", "custom", true, {
                  custom: extras.phiF ?? [],
                  lineWidth: 1,
                  dash: [5, 4],
                  alpha: 0.75,
                }),
              ]
            : []),
        ],
      },
      {
        label: "CH2 · UD — ĐIỆN ÁP CHỈNH LƯU [V]",
        scaleGroup: "V",
        traces: [
          mkTrace("udTheory", "var(--sig-theory)", "udTheory", layers.udTheory, {
            lineWidth: 1.4,
            dash: [6, 4],
          }),
          mkTrace("udSimulink", "var(--sig-sim)", "udSimulink", layers.udSimulink, {
            lineWidth: 1.8,
          }),
        ],
      },
      {
        label: "CH3 · ID — DÒNG ĐIỆN TẢI [A]",
        scaleGroup: "A",
        height: 72,
        traces: [mkTrace("id", "var(--sig-on)", "idSimulink", layers.idSimulink)],
      },
      {
        label: "CH4 · UT — ĐIỆN ÁP TRÊN VAN 1 [V]",
        scaleGroup: "V",
        traces: [mkTrace("uvan", "var(--sig-warn)", "uVan1", layers.uVan1)],
      },
      {
        label: "CH5 · IT — DÒNG QUA VAN 1 [A]",
        scaleGroup: "A",
        height: 72,
        traces: [mkTrace("ivan", "#60a5fa", "iVan1", layers.iVan1)],
      },
      hasGates
        ? {
            label: "CH6 · GATE X₁…Xₙ" + (isThreePhase ? " (XUNG KÉP 60°)" : "") + " [–]",
            kind: "gateRows",
            height: 96,
            traces: [],
            gateRows: { labels: extras!.gateLabels, pulses: extras!.gates },
          }
        : {
            label: "CH6 · GATE — XÚNG KÍCH VAN 1 [–]",
            height: 72,
            traces: [
              mkTrace("gate", "var(--sig-gate)", "gatePulses", layers.gatePulses, {
                isDigital: true,
                lineWidth: 2,
              }),
            ],
          },
    ];
    if (hasValveRows) {
      list.splice(5, 0, {
        label: "CH5b · I QUA TỪNG VAN — tải R: nửa sin · tải RL: phẳng (gạch = freewheel)",
        kind: "valveRows",
        height: 152,
        traces: [],
        valveRows: { labels: extras!.valveLabels, cells: extras!.valveCurrents },
      });
      list.push({
        label: (isThreePhase ? "CH7 · IA = IV1 − IV4" : "CH7 · I2") + " — DÒNG PHA MBA [–]",
        height: 72,
        traces: [
          mkTrace("iline", "#c084fc", "custom", true, {
            custom: extras!.lineCurrent,
            lineWidth: 1.6,
          }),
        ],
      });
    }
    return list;
  }, [layers, isThreePhase, extras]);

  // Compute nice max for auto-scaling
  const getNiceMax = useCallback((data: number[]): number => {
    if (!data || data.length === 0) return 1;
    const maxAbs = Math.max(...data.map(Math.abs));
    if (maxAbs === 0) return 1;
    const target = maxAbs * 1.05;
    const exponent = Math.floor(Math.log10(target));
    const fraction = target / Math.pow(10, exponent);
    let niceFraction: number;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * Math.pow(10, exponent);
  }, []);

  const totalContentHeight = lanes.reduce(
    (sum, l) => sum + (l.height ?? CHANNEL_HEIGHT) + HEADER_HEIGHT,
    0
  );
  const canvasHeight = totalContentHeight + X_AXIS_HEIGHT + TOP_PADDING + BOTTOM_PADDING;

  const getTraceData = useCallback(
    (trace: TraceDef, wf: CircuitWaveforms | null): number[] => {
      if (trace.custom && trace.custom.length > 0) return trace.custom;
      if (!wf) return [];
      const base = wf[trace.dataKey as keyof CircuitWaveforms] as number[] | undefined;
      if (!base || base.length === 0) return [];
      if (!trace.shiftDeg) return base;
      const theta = wf.thetaDeg;
      const theta0 = theta.length > 0 ? theta[0] : 0;
      return base.map((fallback, i) => {
        const d = theta[i] ?? i;
        const target = (((d + trace.shiftDeg!) % 720) + 720) % 720;
        const idx = Math.round(target - theta0);
        return idx >= 0 && idx < base.length ? base[idx] : fallback;
      });
    },
    []
  );

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssWidth = wrapper.clientWidth;
    const cssHeight = canvasHeight;

    // Set up high-DPI canvas
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Colors from CSS variables
    const getColor = (name: string): string => {
      if (name.startsWith("var(")) {
        const computed = getComputedStyle(document.documentElement).getPropertyValue(name.slice(4, -1).trim());
        return computed.trim() || name;
      }
      return name;
    };

    const gridMajorColor = getColor("var(--line)");
    const gridMinorColor = getColor("var(--line)");
    const zeroLineColor = getColor("var(--line)");
    const ink2Color = getColor("var(--ink-2)");
    const ink3Color = getColor("var(--ink-3)");
    const scrubberColor = getColor("var(--sig-scrub)");
    const gateColor = getColor("var(--sig-gate)");

    const plotWidth = cssWidth - LEFT_PADDING - RIGHT_PADDING;
    const plotLeft = LEFT_PADDING;
    const plotRight = cssWidth - RIGHT_PADDING;

    const groupSamples: Record<"V" | "A", number[]> = { V: [], A: [] };
    lanes.forEach((lane) => {
      if (!lane.scaleGroup) return;
      for (const t of lane.traces) {
        if (t.visible) groupSamples[lane.scaleGroup].push(...getTraceData(t, waveforms));
      }
    });
    const groupMax: Record<"V" | "A", number> = {
      V: getNiceMax(groupSamples.V),
      A: getNiceMax(groupSamples.A),
    };

    // Draw grid and x-axis labels (bottom strip)
    const xAxisY = TOP_PADDING + totalContentHeight;
    const xAxisBottom = xAxisY + X_AXIS_HEIGHT;

    // Vertical grid lines
    for (let deg = 0; deg <= 720; deg += 30) {
      const x = plotLeft + (deg / 720) * plotWidth;
      const isMajor = deg % 90 === 0;
      ctx.beginPath();
      ctx.moveTo(x, TOP_PADDING);
      ctx.lineTo(x, xAxisY);
      ctx.strokeStyle = isMajor ? gridMajorColor : gridMinorColor;
      ctx.lineWidth = 1;
      if (!isMajor) {
        ctx.setLineDash([2, 4]);
        ctx.globalAlpha = 0.35;
      } else {
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // X-axis tick labels (0° to 720°)
    ctx.font = "10px monospace";
    ctx.fillStyle = ink3Color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let deg = 0; deg <= 720; deg += 90) {
      const x = plotLeft + (deg / 720) * plotWidth;
      ctx.fillText(`${deg}°`, x, xAxisY + 4);
    }

    // X-axis baseline
    ctx.beginPath();
    ctx.moveTo(plotLeft, xAxisY);
    ctx.lineTo(plotRight, xAxisY);
    ctx.strokeStyle = gridMajorColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vẽ từng lane — lane có thể chứa nhiều trace chồng nhau (vd CH2: lý thuyết + Simulink)
    lanes.forEach((lane, laneIndex) => {
      const laneH = lane.height ?? CHANNEL_HEIGHT;
      const channelTop = TOP_PADDING + lanes.slice(0, laneIndex).reduce((s, l) => s + (l.height ?? CHANNEL_HEIGHT) + HEADER_HEIGHT, 0);
      const headerY = channelTop;
      const contentTop = channelTop + HEADER_HEIGHT;
      const contentBottom = contentTop + laneH;
      const centerY = contentTop + laneH / 2;

      const visibleTraces = lane.traces.filter((t) => t.visible);

      ctx.fillStyle = visibleTraces.length > 0 ? ink2Color : ink3Color;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(lane.label, LEFT_PADDING + 4, headerY + HEADER_HEIGHT / 2);

      if (lane.kind === "valveRows" && lane.valveRows) {
        const { labels, cells } = lane.valveRows;
        const n = Math.max(1, labels.length);
        const rowH = laneH / n;
        const ampH = rowH * 0.38;
        labels.forEach((lbl, ri) => {
          const rTop = contentTop + ri * rowH;
          const rCy = rTop + rowH / 2;
          if (ri > 0) {
            ctx.beginPath();
            ctx.moveTo(plotLeft, rTop);
            ctx.lineTo(plotRight, rTop);
            ctx.strokeStyle = gridMajorColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = ROW_PALETTE[ri % ROW_PALETTE.length];
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(plotLeft, rCy);
          ctx.lineTo(plotRight, rCy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          const rowColor = ROW_PALETTE[ri % ROW_PALETTE.length];
          const samples = cells[ri] ?? [];
          const yOf = (s: ValveCurrentSample) => rCy - (s.on ? s.amp : 0) * ampH;
          ctx.strokeStyle = rowColor;
          ctx.lineWidth = 1.6;
          ctx.lineJoin = "round";
          ctx.beginPath();
          samples.forEach((s, si) => {
            const d = extras?.thetaDeg[si] ?? si;
            const x = plotLeft + (d / 720) * plotWidth;
            const y = yOf(s);
            if (si === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.lineTo(plotRight, yOf(samples[samples.length - 1] ?? { on: false, fw: false, amp: 0 }));
          ctx.stroke();

          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.8;
          let run = -1;
          const flushFw = (end: number) => {
            if (run < 0) return;
            ctx.beginPath();
            for (let si = run; si < end; si++) {
              const s = samples[si];
              const d = extras?.thetaDeg[si] ?? si;
              const x = plotLeft + (d / 720) * plotWidth;
              const y = yOf(s);
              if (si === run) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            run = -1;
          };
          samples.forEach((s, si) => {
            if (s.on && s.fw) {
              if (run < 0) run = si;
            } else flushFw(si);
          });
          flushFw(samples.length);
          ctx.setLineDash([]);

          ctx.fillStyle = "#0b0f17";
          ctx.fillRect(plotLeft + 2, rCy - 7, 26, 14);
          ctx.fillStyle = rowColor;
          ctx.font = "10px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(lbl, plotLeft + 4, rCy);
        });
        return;
      }

      if (lane.kind === "gateRows" && lane.gateRows) {
        const { labels, pulses } = lane.gateRows;
        const n = Math.max(1, labels.length);
        const rowH = laneH / n;
        const gateCol = getColor("var(--sig-gate)");
        labels.forEach((lbl, ri) => {
          const rTop = contentTop + ri * rowH;
          const hiY = rTop + rowH * 0.24;
          const loY = rTop + rowH * 0.82;
          if (ri > 0) {
            ctx.beginPath();
            ctx.moveTo(plotLeft, rTop);
            ctx.lineTo(plotRight, rTop);
            ctx.strokeStyle = gridMajorColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = gateCol;
          ctx.font = "10px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          const seq = pulses[ri] ?? [];
          ctx.beginPath();
          ctx.strokeStyle = gateCol;
          ctx.lineWidth = 1.4;
          let curY = loY;
          ctx.moveTo(plotLeft, loY);
          for (let si = 0; si < seq.length; si++) {
            const d = extras?.thetaDeg[si] ?? si;
            const x = plotLeft + (d / 720) * plotWidth;
            const y = seq[si] === 1 ? hiY : loY;
            if (y !== curY) {
              ctx.lineTo(x, curY);
              ctx.lineTo(x, y);
              curY = y;
            }
          }
          ctx.lineTo(plotRight, curY);
          ctx.stroke();

          ctx.fillStyle = "#0b0f17";
          ctx.fillRect(plotLeft + 2, rTop + rowH * 0.52 - 7, 26, 14);
          ctx.fillStyle = gateCol;
          ctx.fillText(`X${lbl.replace(/^V/, "")}`, plotLeft + 4, rTop + rowH * 0.52);
        });
        return;
      }

      if (visibleTraces.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fillRect(plotLeft, contentTop, plotWidth, laneH);
        ctx.fillStyle = ink3Color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("tắt", plotLeft + plotWidth / 2, centerY);
      }

      // Zero baseline
      ctx.beginPath();
      ctx.moveTo(plotLeft, centerY);
      ctx.lineTo(plotRight, centerY);
      ctx.strokeStyle = zeroLineColor;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      if (visibleTraces.length === 0) return;
      const needsWaveforms = visibleTraces.some((t) => !(t.custom && t.custom.length > 0));
      if (needsWaveforms && !waveforms) return;

      // Thang đo chung cho mọi trace trong lane (trừ digital gate: thang cố định 0..1)
      const isDigitalLane = visibleTraces.some((t) => t.isDigital);
      let maxVal: number;
      if (isDigitalLane) {
        maxVal = 1.25;
      } else if (lane.scaleGroup && groupMax[lane.scaleGroup] > 0) {
        maxVal = groupMax[lane.scaleGroup];
      } else {
        const combined: number[] = [];
        for (const t of visibleTraces) combined.push(...getTraceData(t, waveforms));
        maxVal = getNiceMax(combined);
      }
      const scale = CHANNEL_HEIGHT / (maxVal * 2);

      for (const trace of visibleTraces) {
        const data = getTraceData(trace, waveforms);
        ctx.beginPath();
        ctx.strokeStyle = getColor(trace.color);
        ctx.lineWidth = trace.lineWidth;
        ctx.globalAlpha = trace.alpha ?? 1;
        if (trace.dash.length > 0) ctx.setLineDash(trace.dash);

        for (let i = 0; i < data.length; i++) {
          const deg =
            (trace.custom && trace.custom.length > 0
              ? extras?.thetaDeg[i]
              : waveforms?.thetaDeg[i]) ?? i;
          const x = plotLeft + (deg / 720) * plotWidth;
          const y = centerY - data[i] * scale;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else if (trace.isDigital) {
            const prevDeg =
              (trace.custom && trace.custom.length > 0
                ? extras?.thetaDeg[i - 1]
                : waveforms?.thetaDeg[i - 1]) ??
              i - 1;
            ctx.lineTo(plotLeft + (prevDeg / 720) * plotWidth, y);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }

      ctx.font = "10px monospace";
      ctx.fillStyle = ink3Color;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(maxVal.toFixed(1), plotRight - 2, contentTop + 2);
      ctx.textBaseline = "bottom";
      ctx.fillText((-maxVal).toFixed(1), plotRight - 2, contentBottom - 2);
    });

    // Draw milestone markers
    if (milestones && milestones.length > 0) {
      milestones.forEach((ms) => {
        const x = plotLeft + (ms.theta / 720) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(x, TOP_PADDING);
        ctx.lineTo(x, xAxisY);
        ctx.strokeStyle = gateColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);

        // Tiny dot at top
        ctx.beginPath();
        ctx.arc(x, TOP_PADDING + 4, 2, 0, Math.PI * 2);
        ctx.fillStyle = gateColor;
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // Draw scrubber line across all channels
    const scrubX = plotLeft + (Math.max(0, Math.min(720, thetaDeg)) / 720) * plotWidth;
    ctx.beginPath();
    ctx.moveTo(scrubX, TOP_PADDING);
    ctx.lineTo(scrubX, xAxisY);
    ctx.strokeStyle = scrubberColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Scrubber triangle handle at top
    ctx.beginPath();
    ctx.moveTo(scrubX, TOP_PADDING - 6);
    ctx.lineTo(scrubX - 5, TOP_PADDING);
    ctx.lineTo(scrubX + 5, TOP_PADDING);
    ctx.closePath();
    ctx.fillStyle = scrubberColor;
    ctx.fill();

    // Scrubber chip with θ value
    const chipText = `θ = ${Math.round(thetaDeg)}°`;
    ctx.font = "11px monospace";
    const textMetrics = ctx.measureText(chipText);
    const chipPaddingX = 8;
    const chipPaddingY = 3;
    const chipWidth = textMetrics.width + chipPaddingX * 2;
    const chipHeight = 18;
    let chipX = scrubX + 10;
    if (chipX + chipWidth > plotRight - 4 || chipX < plotLeft + chipWidth + 16) {
      chipX = scrubX - chipWidth - 10;
      if (chipX < plotLeft + 4) chipX = plotLeft + 4;
    }
    const chipY = TOP_PADDING + HEADER_HEIGHT + 6;

    // Chip background
    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const radius = 4;
    ctx.moveTo(chipX + radius, chipY);
    ctx.lineTo(chipX + chipWidth - radius, chipY);
    ctx.quadraticCurveTo(chipX + chipWidth, chipY, chipX + chipWidth, chipY + radius);
    ctx.lineTo(chipX + chipWidth, chipY + chipHeight - radius);
    ctx.quadraticCurveTo(chipX + chipWidth, chipY + chipHeight, chipX + chipWidth - radius, chipY + chipHeight);
    ctx.lineTo(chipX + radius, chipY + chipHeight);
    ctx.quadraticCurveTo(chipX, chipY + chipHeight, chipX, chipY + chipHeight - radius);
    ctx.lineTo(chipX, chipY + radius);
    ctx.quadraticCurveTo(chipX, chipY, chipX + radius, chipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chip text
    ctx.fillStyle = scrubberColor;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(chipText, chipX + chipWidth / 2, chipY + chipHeight / 2);

    // Empty state overlay if no waveforms at all
    if (!waveforms) {
      ctx.fillStyle = ink3Color;
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Không có dữ liệu dạng sóng", cssWidth / 2, cssHeight / 2);
    }
  }, [waveforms, thetaDeg, milestones, lanes, extras, dpr, canvasHeight, getNiceMax, getTraceData]);

  // ResizeObserver setup
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const ro = new ResizeObserver(() => {
      draw();
    });
    ro.observe(wrapper);
    resizeObserverRef.current = ro;

    // Initial draw
    draw();

    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
    };
  }, [draw]);

  // Redraw on prop changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Legend row
  const legendItems = useMemo(
    () => [
      { label: "Lý thuyết", color: "var(--sig-theory)", dash: [6, 4] },
      { label: "Simulink", color: "var(--sig-sim)", dash: [] },
      { label: "Bao φ_E / φ_F", color: "#22d3ee", dash: [5, 4] },
      { label: "Freewheeling", color: "var(--sig-on)", dash: [3, 3] },
      { label: "Vạch quét θ", color: "var(--sig-scrub)", dash: [] },
    ],
    []
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {/* Legend row */}
      <div className="flex flex-wrap gap-4 px-2 py-1 text-xs font-mono" style={{ color: "var(--ink-2)" }}>
        {legendItems.map((item, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <span
              className="inline-block"
              style={{
                width: 20,
                height: 2,
                backgroundColor: item.color,
                borderStyle: item.dash.length > 0 ? "dashed" : "solid",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}