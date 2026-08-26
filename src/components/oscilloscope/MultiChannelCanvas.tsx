"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { CircuitMilestone, CircuitWaveforms, WaveLayerVisibility } from "@/types/simulator";
import type { AnalyticExtras } from "@/lib/analyticWaveforms";

interface MultiChannelCanvasProps {
  waveforms: CircuitWaveforms | null;
  thetaDeg: number;
  layers: WaveLayerVisibility;
  milestones?: CircuitMilestone[];
  isThreePhase?: boolean;
  extras?: AnalyticExtras | null;
  sourceName?: string;
  timeSpan?: "1T" | "2T";
  selectedValve?: string;
  onSelectValve?: (valve: string) => void;
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
  timeSpan = "1T",
  selectedValve = "T1",
  className = "",
}: MultiChannelCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dpr = useMemo(() => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1), []);

  const maxAngle = timeSpan === "1T" ? 360 : 720;

  const HEADER_HEIGHT = 28;
  const X_AXIS_HEIGHT = 38;
  const LEFT_PADDING = 52;
  const RIGHT_PADDING = 58;
  const TOP_PADDING = 8;
  const BOTTOM_PADDING = 8;
  const CHANNEL_HEIGHT = 118;

  interface TraceDef {
    key: string;
    label: string;
    color: string;
    dataKey: keyof CircuitWaveforms | "custom";
    visible: boolean;
    isDigital?: boolean;
    lineWidth: number;
    dash: number[];
    alpha?: number;
    shiftDeg?: number;
    custom?: number[];
  }

  interface LaneDef {
    id: string;
    label: string;
    subLabel?: string;
    scaleGroup?: "V" | "A";
    height?: number;
    traces: TraceDef[];
    unit: string;
  }

  const valveDisplay = selectedValve || extras?.selectedValve || "T1";

  const lanes = useMemo<LaneDef[]>(() => {
    const mkTrace = (
      key: string,
      label: string,
      color: string,
      dataKey: keyof CircuitWaveforms | "custom",
      visible: boolean,
      opts?: Partial<TraceDef>
    ): TraceDef => ({
      key,
      label,
      color,
      dataKey,
      visible,
      lineWidth: 1.9,
      dash: [],
      ...opts,
    });

    const list: LaneDef[] = [
      {
        id: "ch1",
        label: `CH1 · NGUỒN ${sourceName ?? (isThreePhase ? "u_a, u_b, u_c" : "u_2")}`,
        subLabel: isThreePhase ? "Điểm tự nhiên π/6, 5π/6, 3π/2 · Góc kích α · Tô đậm pha dẫn" : undefined,
        scaleGroup: "V",
        unit: "V",
        height: 128,
        traces: [
          ...(isThreePhase
            ? [
                mkTrace("ub", "u_b", "#60a5fa", "custom", true, {
                  custom: extras?.uSourceB,
                  alpha: 0.45,
                  lineWidth: 1.4,
                }),
                mkTrace("uc", "u_c", "#f43f5e", "custom", true, {
                  custom: extras?.uSourceC,
                  alpha: 0.45,
                  lineWidth: 1.4,
                }),
                mkTrace("ua", "u_a", "#38bdf8", "custom", true, {
                  custom: extras?.uSourceA,
                  alpha: 0.75,
                  lineWidth: 1.6,
                }),
              ]
            : [mkTrace("ua", "u_2", "#38bdf8", "uSource", true, { lineWidth: 1.8 })]),
        ],
      },
      {
        id: "ch2",
        label: "CH2 · u_d — ĐIỆN ÁP TRÊN TẢI",
        subLabel: "Ngắt quãng theo từng xung dẫn, bám theo các pha",
        scaleGroup: "V",
        unit: "V",
        height: 120,
        traces: [
          mkTrace("udTheory", "Lý thuyết", "var(--sig-theory)", "udTheory", layers.udTheory, {
            lineWidth: 1.5,
            dash: [6, 4],
          }),
          mkTrace("udSimulink", "Mô phỏng", "var(--sig-sim)", "udSimulink", layers.udSimulink, {
            lineWidth: 2.2,
          }),
        ],
      },
      {
        id: "ch3",
        label: "CH3 · i_d — DÒNG ĐIỆN TẢI (i_d = u_d / R_d)",
        subLabel: "Đồng dạng hoàn toàn với u_d",
        scaleGroup: "A",
        unit: "A",
        height: 104,
        traces: [
          mkTrace("id", "i_d", "var(--sig-on)", "idSimulink", layers.idSimulink, {
            lineWidth: 2.0,
          }),
        ],
      },
      {
        id: "ch4",
        label: `CH4 · i_${valveDisplay} — DÒNG QUA VAN ${valveDisplay}`,
        subLabel: `Chỉ xuất hiện xung dòng trong khoảng dẫn của van ${valveDisplay}`,
        scaleGroup: "A",
        unit: "A",
        height: 104,
        traces: [
          mkTrace(
            "iSelected",
            `i_${valveDisplay}`,
            "#38bdf8",
            "custom",
            layers.iVan1,
            {
              custom: extras?.iSelectedValve,
              lineWidth: 2.2,
            }
          ),
        ],
      },
      {
        id: "ch5",
        label: `CH5 · u_${valveDisplay} — ĐIỆN ÁP TRÊN VAN ${valveDisplay}`,
        subLabel: "Thuận trước kích → 0V khi dẫn → Kéo âm theo áp dây",
        scaleGroup: "V",
        unit: "V",
        height: 132,
        traces: [
          mkTrace(
            "uSelected",
            `u_${valveDisplay}`,
            "var(--sig-warn)",
            "custom",
            layers.uVan1,
            {
              custom: extras?.uSelectedValve,
              lineWidth: 2.2,
            }
          ),
        ],
      },
    ];

    if (layers.gatePulses && extras && extras.gates.length > 0) {
      list.push({
        id: "ch6_gate",
        label: "CH6 · GATE — XUNG KÍCH VAN",
        height: 80,
        unit: "–",
        traces: [
          mkTrace("gate", "Gate", "var(--sig-gate)", "gatePulses", true, {
            isDigital: true,
            lineWidth: 1.8,
          }),
        ],
      });
    }

    return list;
  }, [layers, isThreePhase, extras, sourceName, valveDisplay]);

  const getNiceMax = useCallback((data: number[]): number => {
    if (!data || data.length === 0) return 1;
    const maxAbs = Math.max(...data.map(Math.abs));
    if (maxAbs === 0) return 1;
    const target = maxAbs * 1.08;
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssWidth = wrapper.clientWidth;
    const cssHeight = canvasHeight;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const getColor = (name: string): string => {
      if (name.startsWith("var(")) {
        const computed = getComputedStyle(document.documentElement).getPropertyValue(name.slice(4, -1).trim());
        return computed.trim() || name;
      }
      return name;
    };

    const gridMajorColor = getColor("var(--line)");
    const gridMinorColor = getColor("var(--line)");
    const zeroLineColor = "rgba(255, 255, 255, 0.42)";
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
        if (t.visible) {
          const raw = getTraceData(t, waveforms);
          const sliced = raw.slice(0, maxAngle + 1);
          groupSamples[lane.scaleGroup].push(...sliced);
        }
      }
    });

    const groupMax: Record<"V" | "A", number> = {
      V: Math.max(getNiceMax(groupSamples.V), 100),
      A: Math.max(getNiceMax(groupSamples.A), 10),
    };

    const xAxisY = TOP_PADDING + totalContentHeight;

    const gridStep = timeSpan === "1T" ? 30 : 60;
    for (let deg = 0; deg <= maxAngle; deg += gridStep) {
      const x = plotLeft + (deg / maxAngle) * plotWidth;
      const isMajor = deg % (timeSpan === "1T" ? 90 : 180) === 0;
      const isPiOver6 = deg === 30 || deg === 150 || deg === 270 || deg === 390;

      ctx.beginPath();
      ctx.moveTo(x, TOP_PADDING);
      ctx.lineTo(x, xAxisY);

      if (isPiOver6 && isThreePhase) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
      } else {
        ctx.strokeStyle = isMajor ? gridMajorColor : gridMinorColor;
        ctx.lineWidth = isMajor ? 1.2 : 0.8;
        ctx.setLineDash(isMajor ? [] : [2, 4]);
        ctx.globalAlpha = isMajor ? 0.9 : 0.4;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    const radTicks1T: Array<{ deg: number; rad: string }> = [
      { deg: 0, rad: "0" },
      { deg: 30, rad: "π/6" },
      { deg: 90, rad: "π/2" },
      { deg: 150, rad: "5π/6" },
      { deg: 180, rad: "π" },
      { deg: 210, rad: "7π/6" },
      { deg: 270, rad: "3π/2" },
      { deg: 330, rad: "11π/6" },
      { deg: 360, rad: "2π" },
    ];

    const radTicks2T: Array<{ deg: number; rad: string }> = [
      { deg: 0, rad: "0" },
      { deg: 90, rad: "π/2" },
      { deg: 180, rad: "π" },
      { deg: 270, rad: "3π/2" },
      { deg: 360, rad: "2π" },
      { deg: 450, rad: "5π/2" },
      { deg: 540, rad: "3π" },
      { deg: 630, rad: "7π/2" },
      { deg: 720, rad: "4π" },
    ];

    const radTicks = timeSpan === "1T" ? radTicks1T : radTicks2T;

    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    radTicks.forEach(({ deg, rad }) => {
      const x = plotLeft + (deg / maxAngle) * plotWidth;
      const isNatural = isThreePhase && (deg === 30 || deg === 150 || deg === 270);

      ctx.fillStyle = isNatural ? "#fbbf24" : ink2Color;
      ctx.fillText(rad, x, xAxisY + 4);

      ctx.font = "10px monospace";
      ctx.fillStyle = ink3Color;
      ctx.fillText(`${deg}°`, x, xAxisY + 18);
      ctx.font = "11px monospace";
    });

    ctx.beginPath();
    ctx.moveTo(plotLeft, xAxisY);
    ctx.lineTo(plotRight, xAxisY);
    ctx.strokeStyle = gridMajorColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    lanes.forEach((lane, laneIndex) => {
      const laneH = lane.height ?? CHANNEL_HEIGHT;
      const channelTop =
        TOP_PADDING +
        lanes.slice(0, laneIndex).reduce((s, l) => s + (l.height ?? CHANNEL_HEIGHT) + HEADER_HEIGHT, 0);
      const headerY = channelTop;
      const contentTop = channelTop + HEADER_HEIGHT;
      const contentBottom = contentTop + laneH;
      const centerY = contentTop + laneH / 2;

      ctx.fillStyle = ink2Color;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(lane.label, LEFT_PADDING, headerY + HEADER_HEIGHT / 2);

      if (lane.subLabel) {
        ctx.fillStyle = ink3Color;
        ctx.font = "10px monospace";
        ctx.fillText(lane.subLabel, LEFT_PADDING + ctx.measureText(lane.label).width + 12, headerY + HEADER_HEIGHT / 2);
      }

      ctx.beginPath();
      ctx.moveTo(plotLeft, centerY);
      ctx.lineTo(plotRight, centerY);
      ctx.strokeStyle = zeroLineColor;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`0 ${lane.unit}`, plotLeft - 6, centerY);

      const visibleTraces = lane.traces.filter((t) => t.visible);
      if (visibleTraces.length === 0) return;

      const isDigitalLane = visibleTraces.some((t) => t.isDigital);
      let maxVal: number;
      if (isDigitalLane) {
        maxVal = 1.2;
      } else if (lane.scaleGroup && groupMax[lane.scaleGroup] > 0) {
        maxVal = groupMax[lane.scaleGroup];
      } else {
        const combined: number[] = [];
        for (const t of visibleTraces) combined.push(...getTraceData(t, waveforms));
        maxVal = getNiceMax(combined);
      }
      const scale = (laneH * 0.44) / maxVal;

      for (const trace of visibleTraces) {
        const data = getTraceData(trace, waveforms);
        if (!data || data.length === 0) continue;

        ctx.beginPath();
        ctx.strokeStyle = getColor(trace.color);
        ctx.lineWidth = trace.lineWidth;
        ctx.globalAlpha = trace.alpha ?? 1;
        if (trace.dash.length > 0) ctx.setLineDash(trace.dash);

        const limit = Math.min(data.length, maxAngle + 1);
        for (let i = 0; i < limit; i++) {
          const deg = i;
          const x = plotLeft + (deg / maxAngle) * plotWidth;
          const y = centerY - data[i] * scale;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else if (trace.isDigital) {
            const prevDeg = i - 1;
            ctx.lineTo(plotLeft + (prevDeg / maxAngle) * plotWidth, y);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }

      if (lane.id === "ch1" && isThreePhase && extras && extras.conductingPhase) {
        const cond = extras.conductingPhase;
        const limit = Math.min(cond.length, maxAngle + 1);

        ctx.lineWidth = 3.2;
        ctx.lineCap = "round";

        let curPhase: "a" | "b" | "c" | null = null;
        let segStart = 0;

        const flushSegment = (endDeg: number, phase: "a" | "b" | "c") => {
          const uSource = phase === "a" ? extras.uSourceA : phase === "b" ? extras.uSourceB : extras.uSourceC;
          if (!uSource) return;

          ctx.beginPath();
          ctx.strokeStyle = phase === "a" ? "#38bdf8" : phase === "b" ? "#60a5fa" : "#f43f5e";
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 4;

          for (let d = segStart; d <= endDeg && d < limit; d++) {
            const x = plotLeft + (d / maxAngle) * plotWidth;
            const y = centerY - uSource[d] * scale;
            if (d === segStart) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        };

        for (let d = 0; d < limit; d++) {
          const ph = cond[d];
          if (ph !== curPhase) {
            if (curPhase !== null) {
              flushSegment(d, curPhase);
            }
            curPhase = ph;
            segStart = d;
          }
        }
        if (curPhase !== null) {
          flushSegment(limit - 1, curPhase);
        }
        ctx.lineCap = "butt";

        if (extras.alphaPoints && extras.alphaPoints.length > 0) {
          extras.alphaPoints.forEach((ap) => {
            if (ap.startDeg > maxAngle) return;
            const x1 = plotLeft + (ap.startDeg / maxAngle) * plotWidth;
            const x2 = plotLeft + (Math.min(ap.endDeg, maxAngle) / maxAngle) * plotWidth;
            const arrowY = contentTop + 14;

            ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
            ctx.fillRect(x1, contentTop, Math.max(x2 - x1, 1), laneH);

            if (x2 - x1 > 3) {
              ctx.beginPath();
              ctx.moveTo(x1, arrowY);
              ctx.lineTo(x2, arrowY);
              ctx.strokeStyle = "#fbbf24";
              ctx.lineWidth = 1.4;
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(x2, arrowY);
              ctx.lineTo(x2 - 4, arrowY - 3);
              ctx.lineTo(x2 - 4, arrowY + 3);
              ctx.closePath();
              ctx.fillStyle = "#fbbf24";
              ctx.fill();

              ctx.font = "bold 9px monospace";
              ctx.textAlign = "center";
              ctx.fillText(`α (${ap.valve})`, (x1 + x2) / 2, arrowY - 4);
            }
          });
        }
      }

      ctx.font = "10px monospace";
      ctx.fillStyle = ink3Color;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`+${maxVal.toFixed(1)} ${lane.unit}`, plotRight + 52, contentTop + 2);
      ctx.textBaseline = "bottom";
      ctx.fillText(`-${maxVal.toFixed(1)} ${lane.unit}`, plotRight + 52, contentBottom - 2);
    });

    if (milestones && milestones.length > 0) {
      milestones.forEach((ms) => {
        if (ms.theta > maxAngle) return;
        const x = plotLeft + (ms.theta / maxAngle) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(x, TOP_PADDING);
        ctx.lineTo(x, xAxisY);
        ctx.strokeStyle = gateColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x, TOP_PADDING + 4, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gateColor;
        ctx.fill();
      });
    }

    const currentSweepDeg = ((thetaDeg % maxAngle) + maxAngle) % maxAngle;
    const scrubX = plotLeft + (currentSweepDeg / maxAngle) * plotWidth;

    ctx.beginPath();
    ctx.moveTo(scrubX, TOP_PADDING);
    ctx.lineTo(scrubX, xAxisY);
    ctx.strokeStyle = scrubberColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = scrubberColor;
    ctx.beginPath();
    ctx.moveTo(scrubX, TOP_PADDING);
    ctx.lineTo(scrubX - 5, TOP_PADDING - 6);
    ctx.lineTo(scrubX + 5, TOP_PADDING - 6);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(scrubX, xAxisY);
    ctx.lineTo(scrubX - 5, xAxisY + 6);
    ctx.lineTo(scrubX + 5, xAxisY + 6);
    ctx.closePath();
    ctx.fill();
  }, [
    canvasHeight,
    dpr,
    extras,
    getNiceMax,
    getTraceData,
    isThreePhase,
    lanes,
    maxAngle,
    milestones,
    thetaDeg,
    timeSpan,
    totalContentHeight,
    waveforms,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}
