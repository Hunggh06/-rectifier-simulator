"use client";

/**
 * MilestoneExplanation — thẻ nổi giải thích mốc chuyển mạch (Process Stepper).
 *
 * Thiết kế theo DESIGN.md: panel kỹ thuật nền tối, viền hairline,
 * chip góc θ mono, pill van dẫn màu sig-on (#34d399).
 * Card neo bottom-right bên trong cha có position: relative.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Zap } from "lucide-react";
import type { CircuitMilestone } from "@/types/simulator";

interface MilestoneExplanationProps {
  /** Mốc hiện tại; null => không render gì */
  milestone: CircuitMilestone | null;
  /** Vị trí quét góc pha hiện tại [độ] */
  thetaDeg: number;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/** Pill van dẫn điện — xanh sig-on theo DESIGN.md */
function ValvePill({ label }: { label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[11px] leading-none"
      style={{
        border: "1px solid rgba(52,211,153,.35)",
        backgroundColor: "rgba(52,211,153,.12)",
        color: "#34d399",
      }}
    >
      {label}
    </span>
  );
}

/** Icon-button điều hướng mốc, trạng thái disabled mờ 30% */
function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick?: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md p-1 text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink-1 active:scale-[0.98] ${
        disabled ? "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-ink-2" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** Thân card — tách riêng để chạy hiệu ứng vào mỗi lần đổi mốc (key = theta) */
function MilestoneCardBody({
  milestone,
  thetaDeg,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: Required<Pick<MilestoneExplanationProps, "thetaDeg" | "onClose">> & {
  milestone: CircuitMilestone;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}) {
  // Hiệu ứng vào: opacity + translate-y-2 -> 0, 150ms ease-out, chạy lại theo milestone.theta
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const prevDisabled = !hasPrev || typeof onPrev !== "function";
  const nextDisabled = !hasNext || typeof onNext !== "function";

  return (
    <section
      aria-label="Giải thích mốc chuyển mạch"
      className={`w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface-2 shadow-panel transition-all duration-150 ease-out motion-reduce:transition-none ${
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {/* Header: Zap + tiêu đề + chip θ + nút đóng */}
      <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <Zap size={14} style={{ color: "var(--sig-gate)" }} aria-hidden="true" />
        <h3 className="truncate text-sm font-medium text-ink-1">{milestone.title}</h3>
        <span
          className="ml-auto shrink-0 rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] leading-none text-ink-2"
          title="Góc pha hiện tại"
        >
          θ={Math.round(thetaDeg)}°
        </span>
        <NavButton onClick={onClose} disabled={false} label="Đóng giải thích">
          <X size={14} aria-hidden="true" />
        </NavButton>
      </header>

      {/* Body: trạng thái mạch + mô tả + van đang dẫn */}
      <div className="space-y-2 px-3.5 py-3" aria-live="polite">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-3">
          {milestone.circuitState}
        </p>
        <p className="text-sm leading-relaxed text-ink-2">{milestone.description}</p>

        {milestone.activeValves.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] uppercase tracking-wide text-ink-3">Van dẫn:</span>
            {milestone.activeValves.map((valve) => (
              <ValvePill key={valve} label={valve} />
            ))}
          </div>
        )}
      </div>

      {/* Footer: điều hướng mốc trước / sau */}
      <footer className="flex items-center justify-between border-t border-line px-2.5 py-2">
        <NavButton onClick={onPrev} disabled={prevDisabled} label="Mốc trước">
          <ChevronLeft size={16} aria-hidden="true" />
        </NavButton>
        <NavButton onClick={onNext} disabled={nextDisabled} label="Mốc sau">
          <ChevronRight size={16} aria-hidden="true" />
        </NavButton>
      </footer>
    </section>
  );
}

export function MilestoneExplanation({
  milestone,
  thetaDeg,
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}: MilestoneExplanationProps): JSX.Element {
  if (!milestone) {
    return <></>;
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-30">
      {/* key = theta: remount để hiệu ứng vào chạy lại ở từng mốc */}
      <MilestoneCardBody
        key={milestone.theta}
        milestone={milestone}
        thetaDeg={thetaDeg}
        onClose={onClose}
        onNext={onNext}
        onPrev={onPrev}
        hasNext={hasNext}
        hasPrev={hasPrev}
      />
    </div>
  );
}
