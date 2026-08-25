"use client";

import { useMemo } from "react";
import { Atom, BookOpen, ShieldCheck, Zap } from "lucide-react";
import { Formula } from "@/components/ui/Formula";
import { getCircuitExplanation } from "@/lib/circuitExplanations";
import type { CatalogEntry } from "@/types/simulator";

export function FormulaPanel({
  entry,
  alphaDeg = 0,
  loadType = "R",
  className = "",
}: {
  entry: CatalogEntry | null;
  alphaDeg?: number;
  loadType?: "R" | "RL";
  className?: string;
}): JSX.Element {
  const explanation = useMemo(
    () => (entry ? getCircuitExplanation(entry.catalogId) : null),
    [entry]
  );

  const formulas = useMemo(() => {
    if (!explanation) return null;
    return explanation.getFormulas(alphaDeg, loadType);
  }, [explanation, alphaDeg, loadType]);

  if (!entry || !formulas) {
    return (
      <section
        aria-label="Công thức tính toán"
        className={`panel p-3 ${className}`}
      >
        <div className="panel-header">
          <Atom size={13} aria-hidden="true" /> Công thức tính toán
        </div>
        <p className="p-3 text-center text-xs text-ink-3">
          Chọn một mạch để xem đầy đủ công thức
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Bảng công thức tính toán và thiết kế"
      className={`panel ${className}`}
    >
      <div className="panel-header flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-ink-1">
          <BookOpen size={13} className="text-sig-theory" aria-hidden="true" />
          Công thức thiết kế & tính toán
        </span>
        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
          LaTeX chuẩn
        </span>
      </div>

      <div className="space-y-3 p-3 text-xs">
        {/* Điện áp ra */}
        <div className="rounded-md border border-line/60 bg-surface-2 p-2.5">
          <p className="pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-sig-theory">
            1. Điện áp ra (Trung bình / Hiệu dụng)
          </p>
          <div className="overflow-x-auto text-center font-medium text-ink-1">
            <Formula tex={formulas.uOut} displayMode />
          </div>
        </div>

        {/* Điện áp ngược cực đại */}
        <div className="rounded-md border border-line/60 bg-surface-2 p-2.5">
          <p className="pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-sig-warn">
            2. Điện áp ngược cực đại trên van (U_ng,max)
          </p>
          <div className="overflow-x-auto text-center font-medium text-ink-1">
            <Formula tex={formulas.uRevMax} displayMode />
          </div>
        </div>

        {/* Dòng điện qua van */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line/60 bg-surface-2 p-2">
            <p className="pb-0.5 font-mono text-[10px] uppercase text-ink-3">
              Dòng TB qua van (I_v,tb)
            </p>
            <div className="overflow-x-auto text-center text-[11px] text-ink-1">
              <Formula tex={formulas.iValveAvg} />
            </div>
          </div>
          <div className="rounded-md border border-line/60 bg-surface-2 p-2">
            <p className="pb-0.5 font-mono text-[10px] uppercase text-ink-3">
              Dòng hiệu dụng (I_v,rms)
            </p>
            <div className="overflow-x-auto text-center text-[11px] text-ink-1">
              <Formula tex={formulas.iValveRms} />
            </div>
          </div>
        </div>

        {/* Công suất MBA & Độ gợn sóng */}
        <div className="space-y-2 rounded-md border border-line/60 bg-surface-2 p-2.5">
          <div>
            <p className="pb-0.5 font-mono text-[10px] uppercase text-ink-3">
              Công suất tính toán MBA (S_ba) / Tải
            </p>
            <div className="overflow-x-auto text-[11px] text-ink-1">
              <Formula tex={formulas.sBa} />
            </div>
          </div>
          <div className="border-t border-line/60 pt-1.5">
            <p className="pb-0.5 font-mono text-[10px] uppercase text-ink-3">
              Tần số gợn sóng & Hệ số đập mạch
            </p>
            <div className="overflow-x-auto text-[11px] text-ink-1">
              <Formula tex={formulas.ripple} />
            </div>
          </div>
        </div>

        {/* Công thức đặc thù */}
        {formulas.special && (
          <div className="rounded-md border border-sig-sim/30 bg-sig-sim/5 p-2.5">
            <p className="pb-1 font-mono text-[10px] font-semibold uppercase text-sig-sim">
              {formulas.special.label}
            </p>
            <div className="overflow-x-auto text-center text-xs text-ink-1">
              <Formula tex={formulas.special.tex} displayMode />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
