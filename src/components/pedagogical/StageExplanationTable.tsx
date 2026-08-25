"use client";

import { useMemo } from "react";
import { Activity, Clock, Cpu, Sparkles } from "lucide-react";
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

  const explanation = useMemo(
    () => getCircuitExplanation(catalogId),
    [catalogId]
  );

  const stages = useMemo(() => {
    if (!explanation) return [];
    return explanation.getStages(alphaDeg, loadType);
  }, [explanation, alphaDeg, loadType]);

  const currentPh = mod360(thetaDeg);

  const activeStageId = useMemo(() => {
    if (stages.length === 0) return null;
    const match = stages.find((st) => {
      if (st.startDeg <= st.endDeg) {
        return currentPh >= st.startDeg && currentPh < st.endDeg;
      }
      return currentPh >= st.startDeg || currentPh < st.endDeg;
    });
    return match ? match.id : stages[0].id;
  }, [stages, currentPh]);

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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-sig-sim" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-ink-1 sm:text-base">
            Thuyết minh chi tiết các giai đoạn hoạt động
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
          style={{
            borderColor: "rgba(34,211,238,.35)",
            backgroundColor: "rgba(34,211,238,.10)",
            color: "#22d3ee",
          }}
        >
          <Clock size={11} aria-hidden="true" />
          {stages.length} giai đoạn · θ = {Math.round(thetaDeg)}°
        </span>
      </div>

      {/* Danh sách các giai đoạn */}
      <div className="divide-y divide-line">
        {stages.map((stage: CircuitStage, idx: number) => {
          const isActive = stage.id === activeStageId;
          return (
            <div
              key={stage.id}
              onClick={() => setTheta(stage.startDeg)}
              className={`group cursor-pointer p-3.5 transition-colors duration-150 sm:p-4 ${
                isActive
                  ? "bg-sig-sim/10 border-l-4 border-l-sig-sim"
                  : "hover:bg-surface-2 border-l-4 border-l-transparent"
              }`}
            >
              {/* Thanh tiêu đề giai đoạn */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 font-mono text-[10px] font-semibold text-ink-2">
                    {idx + 1}
                  </span>
                  <div className="rounded bg-surface-3 px-2 py-0.5 font-mono text-xs font-medium text-sig-theory">
                    <Formula tex={stage.intervalTex} />
                  </div>
                  <span className="text-xs font-semibold text-ink-1 sm:text-sm">
                    {stage.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium"
                    style={{
                      borderColor: isActive
                        ? "rgba(52,211,153,.5)"
                        : "var(--line)",
                      backgroundColor: isActive
                        ? "rgba(52,211,153,.15)"
                        : "var(--surface-2)",
                      color: isActive ? "#34d399" : "var(--ink-2)",
                    }}
                  >
                    <Cpu size={11} aria-hidden="true" />
                    <span>Van:</span>
                    <Formula tex={stage.valves} />
                  </span>
                  {isActive && (
                    <span className="hidden items-center gap-1 rounded bg-sig-on/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sig-on sm:inline-flex">
                      <Sparkles size={10} aria-hidden="true" />
                      Đang chạy
                    </span>
                  )}
                </div>
              </div>

              {/* Lưới công thức LaTeX tức thời của giai đoạn */}
              <div className="my-2.5 grid grid-cols-1 gap-2 rounded-md bg-surface-0/80 p-2.5 sm:grid-cols-3">
                <div className="space-y-0.5 rounded border border-line/60 bg-surface-2/40 px-2.5 py-1.5">
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Điện áp tức thời u_d / u_tải
                  </p>
                  <div className="overflow-x-auto text-xs text-sig-sim">
                    <Formula tex={stage.uOutTex} />
                  </div>
                </div>

                <div className="space-y-0.5 rounded border border-line/60 bg-surface-2/40 px-2.5 py-1.5">
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Điện áp trên van u_V
                  </p>
                  <div className="overflow-x-auto text-xs text-sig-warn">
                    <Formula tex={stage.uValveTex} />
                  </div>
                </div>

                <div className="space-y-0.5 rounded border border-line/60 bg-surface-2/40 px-2.5 py-1.5">
                  <p className="font-mono text-[10px] uppercase text-ink-3">
                    Dòng điện tải i_d & nguồn
                  </p>
                  <div className="overflow-x-auto text-xs text-[#60a5fa]">
                    <Formula tex={stage.iLoadTex} />
                  </div>
                </div>
              </div>

              {/* Thuyết minh vật lý chi tiết */}
              <p className="text-xs leading-relaxed text-ink-2 sm:text-xs">
                {stage.physicsExplanation}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
