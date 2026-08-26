"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Activity, ChevronLeft, ChevronRight, Clock, Cpu, Sparkles } from "lucide-react";
import { Formula } from "@/components/ui/Formula";
import {
  getCircuitExplanation,
  type CircuitStage,
} from "@/lib/circuitExplanations";
import { useSimulatorStore } from "@/store/useSimulatorStore";

const mod360 = (x: number) => ((x % 360) + 360) % 360;

export function StageExplanationTable({
  catalogId,
  alphaDeg,
  loadType,
  thetaDeg,
  className = "",
}: {
  catalogId: string | null;
  alphaDeg: number;
  loadType: "R" | "RL";
  thetaDeg: number;
  className?: string;
}): JSX.Element {
  const setTheta = useSimulatorStore((s) => s.setTheta);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const explanation = useMemo(
    () => getCircuitExplanation(catalogId),
    [catalogId]
  );

  const stages = useMemo(() => {
    if (!explanation) return [];
    return explanation.getStages(alphaDeg, loadType);
  }, [explanation, alphaDeg, loadType]);

  const currentPh = mod360(thetaDeg);

  const activeStageIndex = useMemo(() => {
    if (stages.length === 0) return -1;
    const idx = stages.findIndex((st) => {
      if (st.startDeg <= st.endDeg) {
        return currentPh >= st.startDeg && currentPh < st.endDeg;
      }
      return currentPh >= st.startDeg || currentPh < st.endDeg;
    });
    return idx >= 0 ? idx : 0;
  }, [stages, currentPh]);

  const activeStage = stages[activeStageIndex] ?? null;

  const scrollToStage = useCallback((id: string) => {
    const el = stageRefs.current[id];
    const container = containerRef.current;
    if (el && container) {
      const topPos = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: Math.max(0, topPos - 12), behavior: "smooth" });
    }
  }, []);

  const handleSelectStage = useCallback(
    (stage: CircuitStage) => {
      setTheta(stage.startDeg);
      scrollToStage(stage.id);
    },
    [setTheta, scrollToStage]
  );

  const handleStepStage = useCallback(
    (dir: 1 | -1) => {
      if (stages.length === 0) return;
      const nextIdx = (activeStageIndex + dir + stages.length) % stages.length;
      const nextStage = stages[nextIdx];
      if (nextStage) {
        handleSelectStage(nextStage);
      }
    },
    [activeStageIndex, stages, handleSelectStage]
  );

  useEffect(() => {
    if (activeStage) {
      scrollToStage(activeStage.id);
    }
  }, [activeStage, scrollToStage]);

  if (!catalogId || stages.length === 0) {
    return (
      <section
        aria-label="Thuyết minh giai đoạn hoạt động"
        className={`rounded-lg border border-line bg-surface-1 p-4 shadow-panel ${className}`}
      >
        <p className="text-center text-sm text-ink-3">
          Chọn mạch và điều kiện hoạt động để xem thuyết minh các giai đoạn
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Thuyết minh giai đoạn hoạt động"
      className={`overflow-hidden rounded-lg border border-line bg-surface-1 shadow-panel ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-sig-sim" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-ink-1 sm:text-base">
            Thuyết minh các khoảng góc pha
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide font-bold"
            style={{
              borderColor: "rgba(34,211,238,.45)",
              backgroundColor: "rgba(34,211,238,.12)",
              color: "#22d3ee",
            }}
          >
            <Clock size={12} aria-hidden="true" />
            Khoảng {activeStageIndex + 1}/{stages.length} · θ = {Math.round(thetaDeg)}°
          </span>

          <div className="flex items-center rounded-md border border-line bg-surface-3">
            <button
              type="button"
              onClick={() => handleStepStage(-1)}
              title="Khoảng trước"
              className="px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleStepStage(1)}
              title="Khoảng sau"
              className="px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors border-l border-line"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="max-h-[540px] divide-y divide-line overflow-y-auto scroll-smooth"
      >
        {stages.map((stage: CircuitStage, idx: number) => {
          const isActive = idx === activeStageIndex;
          return (
            <div
              key={stage.id}
              ref={(el) => {
                stageRefs.current[stage.id] = el;
              }}
              onClick={() => handleSelectStage(stage)}
              className={`group cursor-pointer p-4 transition-all duration-200 ${
                isActive
                  ? "bg-cyan-950/30 border-l-[5px] border-l-[#22d3ee] shadow-[inset_0_0_16px_rgba(34,211,238,0.08)]"
                  : "hover:bg-surface-2/60 border-l-[5px] border-l-transparent"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                      isActive
                        ? "bg-[#22d3ee] text-black"
                        : "bg-surface-3 text-ink-2"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div
                    className={`rounded px-2.5 py-0.5 font-mono text-xs font-semibold ${
                      isActive
                        ? "bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/40"
                        : "bg-surface-3 text-sig-theory"
                    }`}
                  >
                    <Formula tex={stage.intervalTex} />
                  </div>
                  <span
                    className={`text-xs font-bold sm:text-sm ${
                      isActive ? "text-ink-1 font-bold" : "text-ink-2"
                    }`}
                  >
                    {stage.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium"
                    style={{
                      borderColor: isActive
                        ? "rgba(52,211,153,.6)"
                        : "var(--line)",
                      backgroundColor: isActive
                        ? "rgba(52,211,153,.2)"
                        : "var(--surface-2)",
                      color: isActive ? "#34d399" : "var(--ink-2)",
                    }}
                  >
                    <Cpu size={11} aria-hidden="true" />
                    <span>Van dẫn:</span>
                    <Formula tex={stage.valves} />
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded bg-sig-on/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sig-on border border-sig-on/40 animate-pulse">
                      <Sparkles size={10} aria-hidden="true" />
                      Đang quét
                    </span>
                  )}
                </div>
              </div>

              <div className="my-2.5 grid grid-cols-1 gap-2 rounded-md bg-surface-0/90 p-2.5 sm:grid-cols-3">
                <div
                  className={`space-y-0.5 rounded border px-2.5 py-1.5 ${
                    isActive
                      ? "border-[#22d3ee]/30 bg-[#22d3ee]/5"
                      : "border-line/60 bg-surface-2/40"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Điện áp tức thời u_d
                  </p>
                  <div className="overflow-x-auto text-xs font-semibold text-sig-sim">
                    <Formula tex={stage.uOutTex} />
                  </div>
                </div>

                <div
                  className={`space-y-0.5 rounded border px-2.5 py-1.5 ${
                    isActive
                      ? "border-amber-400/30 bg-amber-400/5"
                      : "border-line/60 bg-surface-2/40"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Điện áp trên van u_T
                  </p>
                  <div className="overflow-x-auto text-xs font-semibold text-sig-warn">
                    <Formula tex={stage.uValveTex} />
                  </div>
                </div>

                <div
                  className={`space-y-0.5 rounded border px-2.5 py-1.5 ${
                    isActive
                      ? "border-blue-400/30 bg-blue-400/5"
                      : "border-line/60 bg-surface-2/40"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Dòng điện tải i_d
                  </p>
                  <div className="overflow-x-auto text-xs font-semibold text-[#60a5fa]">
                    <Formula tex={stage.iLoadTex} />
                  </div>
                </div>
              </div>

              <p
                className={`text-xs leading-relaxed ${
                  isActive ? "text-ink-1 font-medium" : "text-ink-2"
                }`}
              >
                {stage.physicsExplanation}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
