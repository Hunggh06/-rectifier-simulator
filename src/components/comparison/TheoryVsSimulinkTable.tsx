"use client";

/**
 * TheoryVsSimulinkTable — bảng đối chiếu chỉ số lý thuyết ↔ Simulink.
 *
 * Hàng: Ud, UngMax, Iavg, Irms, Sba. Số liệu mono tabular-nums,
 * định dạng vi-VN, tô màu sai số theo ngưỡng (<1% xanh, <3% vàng, còn lại hồng).
 * Ký hiệu render bằng KaTeX qua helper Formula.
 */

import { CheckCircle2 } from "lucide-react";
import type { CircuitSimulationData } from "@/types/simulator";
import { Formula } from "@/components/ui/Formula";

interface TheoryVsSimulinkTableProps {
  circuit: CircuitSimulationData | null;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Định dạng số (vi-VN)                                                */
/* ------------------------------------------------------------------ */

const SI_PREFIXES: ReadonlyArray<{ threshold: number; prefix: string }> = [
  { threshold: 1e9, prefix: "G" },
  { threshold: 1e6, prefix: "M" },
  { threshold: 1e3, prefix: "k" },
];

/** 123.4 -> "123,4 V"; 1250 VA -> "1,25 kVA" */
function formatSI(value: number, unit: string): string {
  const abs = Math.abs(value);
  const match = SI_PREFIXES.find((p) => abs >= p.threshold);
  const scaled = match ? value / match.threshold : value;
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(scaled);
  return `${formatted} ${match ? `${match.prefix}` : ""}${unit}`;
}

function formatPercent(value: number): string {
  return `±${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} %`;
}

/** Tầng màu sai số theo spec: <1% xanh lá, <3% hổ phách, còn lại hồng */
function errorTierClass(errorPercent: number): string {
  if (errorPercent < 1) return "text-[#34d399]";
  if (errorPercent < 3) return "text-[#f5a524]";
  return "text-[#fb7185]";
}

/* ------------------------------------------------------------------ */
/* Mô hình hàng bảng                                                   */
/* ------------------------------------------------------------------ */

interface MetricRow {
  id: string;
  /** Tên đại lượng (tiếng Việt) */
  quantityVN: string;
  /** LaTeX ký hiệu cho KaTeX */
  symbolTex: string;
  /** Chuỗi đã format; null => hiển thị "—" */
  theory: string | null;
  simulink: string | null;
  errorPercent: number | null;
}

function buildRows(metrics: CircuitSimulationData["metrics"]): MetricRow[] {
  const { theory, simulink } = metrics;
  return [
    {
      id: "Ud",
      quantityVN: "Điện áp chỉnh lưu trung bình",
      symbolTex: "U_{d}",
      theory: formatSI(theory.Ud, "V"),
      simulink: formatSI(simulink.Ud, "V"),
      errorPercent: simulink.errorPercent,
    },
    {
      id: "UngMax",
      quantityVN: "Điện áp ngược cực đại trên van",
      symbolTex: "U_{ng,max}",
      theory: formatSI(theory.UngMax, "V"),
      simulink: formatSI(simulink.UngMax, "V"),
      errorPercent: simulink.errorPercent,
    },
    {
      id: "Iavg",
      quantityVN: "Dòng tải trung bình",
      symbolTex: "I_{d\\,tb}",
      theory: formatSI(theory.Iavg, "A"),
      simulink: formatSI(simulink.Iavg, "A"),
      errorPercent: simulink.errorPercent,
    },
    {
      id: "Irms",
      quantityVN: "Dòng tải hiệu dụng",
      symbolTex: "I_{rms}",
      theory: null,
      simulink: formatSI(simulink.Irms, "A"),
      errorPercent: null,
    },
    {
      id: "Sba",
      quantityVN: "Công suất tính toán máy biến áp",
      symbolTex: "S_{ba}",
      theory: formatSI(theory.Sba, "VA"),
      simulink: null,
      errorPercent: null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const HEADERS = ["Đại lượng", "Ký hiệu", "Lý thuyết", "Simulink", "Sai số"] as const;

export function TheoryVsSimulinkTable({
  circuit,
  className = "",
}: TheoryVsSimulinkTableProps): JSX.Element {
  const rows = circuit ? buildRows(circuit.metrics) : [];
  const udError = circuit ? circuit.metrics.simulink.errorPercent : null;
  const verified = udError !== null && udError < 3;

  return (
    <section
      aria-label="Bảng đối chiếu lý thuyết và Simulink"
      className={`overflow-hidden rounded-lg border border-line bg-surface-1 shadow-panel ${className}`}
    >
      {/* Dải tổng hợp: sai số Ud lớn + huy hiệu VERIFIED */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        {udError !== null ? (
          <>
            <p className="text-base font-medium text-ink-1 sm:text-lg">
              Sai số Ud:{" "}
              <span className={`font-mono tabular-nums ${errorTierClass(udError)}`}>
                {formatPercent(udError)}
              </span>
            </p>
            {verified && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] leading-none"
                style={{
                  border: "1px solid rgba(52,211,153,.35)",
                  backgroundColor: "rgba(52,211,153,.12)",
                  color: "#34d399",
                }}
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                VERIFIED
              </span>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-3">Chưa chọn dữ liệu đối chiếu</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[430px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {HEADERS.map((header) => {
                const numeric = header === "Lý thuyết" || header === "Simulink" || header === "Sai số";
                return (
                  <th
                    key={header}
                    scope="col"
                    className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-3 first:pl-4 last:pr-4 ${
                      numeric ? "text-right" : "text-left"
                    }`}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {!circuit && (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-6 text-center text-sm text-ink-3">
                  Chưa chọn dữ liệu đối chiếu
                </td>
              </tr>
            )}
            {circuit &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 pl-4 text-left text-ink-2">{row.quantityVN}</td>
                  <td className="px-3 py-2 text-left text-ink-1">
                    <Formula tex={row.symbolTex} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-1">
                    {row.theory ?? <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-3 py-2 pr-4 text-right font-mono tabular-nums text-ink-1">
                    {row.simulink ?? <span className="text-ink-3">—</span>}
                  </td>
                  <td
                    className={`px-3 py-2 pr-4 text-right font-mono tabular-nums ${
                      row.errorPercent !== null ? errorTierClass(row.errorPercent) : "text-ink-3"
                    }`}
                  >
                    {row.errorPercent !== null ? formatPercent(row.errorPercent) : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
