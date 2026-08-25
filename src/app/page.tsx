"use client";

/**
 * Trang Dashboard tổng thể — bố cục 3 cột kiểu console kỹ thuật:
 *  trái: danh mục 12 mạch + điều khiển α / tải / phát
 *  giữa: sơ đồ mạch động + máy hiện sóng 6 kênh + thanh quét θ
 *  phải: công thức + bảng đối chiếu Lý thuyết ↔ Simulink
 * Dữ liệu ưu tiên từ Simulink (public/data/*.simulink.json),
 * fallback về bộ mock giải tích đi kèm.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Activity,
  Atom,
  ChevronRight,
  Cpu,
  Gauge,
  Pause,
  Play,
  Radio,
  Zap,
} from "lucide-react";

import mockDatasetJson from "@/data/simulink_verified_dataset.json";
import type {
  CircuitMilestone,
  LoadType,
  SimulatorDataset,
} from "@/types/simulator";
import {
  computeValveStatesAt,
  useActiveCatalogEntry,
  useActiveCircuit,
  useAvailableAlphas,
  useSimulatorStore,
} from "@/store/useSimulatorStore";
import { CircuitSchematic } from "@/components/schematic/CircuitSchematic";
import { MultiChannelCanvas } from "@/components/oscilloscope/MultiChannelCanvas";
import { MilestoneExplanation } from "@/components/pedagogical/MilestoneExplanation";
import { TheoryVsSimulinkTable } from "@/components/comparison/TheoryVsSimulinkTable";
import { Formula } from "@/components/ui/Formula";

const MOCK_DATASET = mockDatasetJson as unknown as SimulatorDataset;

const SPEED_OPTIONS = [
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

export default function Home() {
  const catalog = useSimulatorStore((s) => s.catalog);
  const selectedCatalogId = useSimulatorStore((s) => s.selectedCatalogId);
  const selectedAlphaDeg = useSimulatorStore((s) => s.selectedAlphaDeg);
  const selectedLoadType = useSimulatorStore((s) => s.selectedLoadType);
  const thetaDeg = useSimulatorStore((s) => s.thetaDeg);
  const isPlaying = useSimulatorStore((s) => s.isPlaying);
  const playSpeed = useSimulatorStore((s) => s.playSpeed);
  const layers = useSimulatorStore((s) => s.layers);
  const pausedAtMilestoneTheta = useSimulatorStore((s) => s.pausedAtMilestoneTheta);

  const loadDataset = useSimulatorStore((s) => s.loadDataset);
  const selectCatalog = useSimulatorStore((s) => s.selectCatalog);
  const selectAlpha = useSimulatorStore((s) => s.selectAlpha);
  const selectLoadType = useSimulatorStore((s) => s.selectLoadType);
  const setTheta = useSimulatorStore((s) => s.setTheta);
  const togglePlay = useSimulatorStore((s) => s.togglePlay);
  const setPlaySpeed = useSimulatorStore((s) => s.setPlaySpeed);
  const toggleLayer = useSimulatorStore((s) => s.toggleLayer);
  const jumpToMilestone = useSimulatorStore((s) => s.jumpToMilestone);
  const dismissMilestonePause = useSimulatorStore((s) => s.dismissMilestonePause);

  const activeCircuit = useActiveCircuit();
  const activeEntry = useActiveCatalogEntry();
  const alphas = useAvailableAlphas();

  /* Nạp dữ liệu: Simulink trước, mock sau; ?catalog=&alpha=&load= để chia sẻ trạng thái */
  const hydrated = useRef(false);
  const applyUrlParams = useCallback(() => {
    const q = new URLSearchParams(window.location.search);
    const cat = q.get("catalog");
    const alpha = q.get("alpha");
    const load = q.get("load");
    if (cat) selectCatalog(cat);
    if (load === "R" || load === "RL") selectLoadType(load);
    if (alpha !== null && !Number.isNaN(Number(alpha))) selectAlpha(Number(alpha));
  }, [selectCatalog, selectLoadType, selectAlpha]);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/simulink_verified_dataset.simulink.json");
        if (res.ok) {
          const sim = (await res.json()) as SimulatorDataset;
          if (alive && Array.isArray(sim.circuits) && sim.circuits.length > 0) {
            loadDataset(sim);
            applyUrlParams();
            return;
          }
        }
      } catch {
        /* chưa có dữ liệu Simulink — dùng mock */
      }
      if (alive) {
        loadDataset(MOCK_DATASET);
        applyUrlParams();
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadDataset]);

  /* ------------------------- Trạng thái van ----------------------------- */
  const valveStates = useMemo(
    () => (activeCircuit ? computeValveStatesAt(activeCircuit, thetaDeg) : {}),
    [activeCircuit, thetaDeg]
  );

  /* --------------------------- Vòng lặp phát ---------------------------- */
  const milestones: CircuitMilestone[] = activeCircuit?.milestones ?? [];
  const thetaRef = useRef(thetaDeg);
  thetaRef.current = thetaDeg;
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  useEffect(() => {
    if (!isPlaying || !activeCircuit) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const next = thetaRef.current + (playSpeed * dt * 60) / 1000;
      // Tự dừng tại mốc chuyển mạch nếu vươn qua trong bước này
      const hit = milestones.find((m) => {
        const a = thetaRef.current;
        let b = next % 720;
        if (b < a) {
          return m.theta >= a || m.theta <= b;
        }
        return m.theta > a && m.theta <= b;
      });
      if (hit !== undefined && milestones.length > 0) {
        setTheta(hit.theta);
        useSimulatorStore.setState({ isPlaying: false, pausedAtMilestoneTheta: hit.theta });
        return;
      }
      setTheta(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playSpeed, activeCircuit?.circuitId]);

  /* ----------------------------- Bàn phím ------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setTheta(thetaRef.current + 5);
      else if (e.key === "ArrowLeft") setTheta(thetaRef.current - 5);
      else if (e.code === "Space") {
        e.preventDefault();
        dismissMilestonePause();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheta, togglePlay, dismissMilestonePause]);

  /* ------------------------ Điều hướng mốc ------------------------------ */
  const currentMilestoneIndex = useMemo(() => {
    if (milestones.length === 0) return -1;
    const paused = pausedAtMilestoneTheta;
    if (paused !== null) {
      const idx = milestones.findIndex((m) => m.theta === paused);
      if (idx >= 0) return idx;
    }
    let best = -1;
    let bestDist = Infinity;
    milestones.forEach((m, i) => {
      const d = Math.abs(m.theta - thetaDeg);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [milestones, pausedAtMilestoneTheta, thetaDeg]);

  const goMilestone = useCallback(
    (dir: 1 | -1) => {
      if (currentMilestoneIndex < 0) return;
      const nextIdx = Math.min(Math.max(currentMilestoneIndex + dir, 0), milestones.length - 1);
      jumpToMilestone(milestones[nextIdx].theta);
    },
    [currentMilestoneIndex, milestones, jumpToMilestone]
  );

  const families: Array<{ key: "1P" | "3P"; label: string }> = [
    { key: "1P", label: "Một pha" },
    { key: "3P", label: "Ba pha" },
  ];

  return (
    <div className="relative min-h-[100dvh] bg-surface-0 text-ink-1">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface-1/90 px-4 backdrop-blur lg:px-6">
        <Activity size={18} className="text-sig-sim" aria-hidden />
        <h1 className="text-sm font-semibold tracking-tight">Simulator Chỉnh lưu</h1>
        <span className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-3 sm:inline">
          Chương 2 · Điện tử công suất
        </span>
        <span
          className="ml-auto hidden items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase md:inline-flex"
          style={{
            border: "1px solid rgba(34,211,238,.35)",
            backgroundColor: "rgba(34,211,238,.10)",
            color: "#22d3ee",
          }}
        >
          <Cpu size={11} aria-hidden />
          {catalog.length > 0 ? `${catalog.length} mạch · ${useSimulatorStore.getState().circuits.length} bộ dữ liệu` : "Đang nạp…"}
        </span>
      </header>

      <main className="mx-auto grid max-w-[1560px] grid-cols-12 gap-4 p-4 lg:p-6">
        {/* ============================ CỘT TRÁI ============================ */}
        <aside className="col-span-12 space-y-4 lg:col-span-3">
          <section className="panel" aria-label="Danh mục mạch chỉnh lưu">
            <div className="panel-header">
              <Radio size={13} aria-hidden /> Danh mục mạch
            </div>
            <div className="max-h-[320px] space-y-3 overflow-y-auto p-2">
              {families.map((fam) => (
                <div key={fam.key}>
                  <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                    {fam.label}
                  </p>
                  <div className="space-y-1">
                    {catalog
                      .filter((c) => c.family === fam.key)
                      .map((c) => {
                        const activeSel = c.catalogId === selectedCatalogId;
                        return (
                          <button
                            key={c.catalogId}
                            type="button"
                            onClick={() => selectCatalog(c.catalogId)}
                            aria-pressed={activeSel}
                            className={`w-full rounded-md px-2.5 py-2 text-left text-xs transition-colors duration-150 ${
                              activeSel
                                ? "border border-sig-sim/40 bg-sig-sim/10 text-ink-1"
                                : "border border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink-1"
                            }`}
                          >
                            <span className="block leading-snug">{c.circuitName}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
              {catalog.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-ink-3">Đang nạp danh mục…</p>
              )}
            </div>
          </section>

          <section className="panel" aria-label="Điều khiển mô phỏng">
            <div className="panel-header">
              <Gauge size={13} aria-hidden /> Điều khiển
            </div>
            <div className="space-y-4 p-3">
              <div>
                <p className="pb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  Loại tải
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["R", "RL"] as LoadType[]).map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => selectLoadType(lt)}
                      aria-pressed={selectedLoadType === lt}
                      className={`rounded-md border px-2 py-1.5 font-mono text-xs transition-colors ${
                        selectedLoadType === lt
                          ? "border-sig-sim/40 bg-sig-sim/10 text-ink-1"
                          : "border-line text-ink-2 hover:bg-surface-2"
                      }`}
                    >
                      {lt === "R" ? "Thuần trở R" : "Trở – cảm R-L"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="pb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  Góc kích α
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {alphas.length === 0 && (
                    <p className="text-xs text-ink-3">Không có dữ liệu cho tổ hợp này</p>
                  )}
                  {alphas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => selectAlpha(a)}
                      aria-pressed={a === selectedAlphaDeg}
                      className={`min-w-[46px] rounded-md border px-2 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                        a === selectedAlphaDeg
                          ? "border-sig-theory/50 bg-sig-theory/10 text-sig-theory"
                          : "border-line text-ink-2 hover:bg-surface-2"
                      }`}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dismissMilestonePause();
                    togglePlay();
                  }}
                  disabled={!activeCircuit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sig-on/40 bg-sig-on/10 px-3 py-1.5 font-mono text-xs text-sig-on transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isPlaying ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                  {isPlaying ? "Dừng" : "Quét"}
                </button>
                <div className="ml-auto flex overflow-hidden rounded-md border border-line">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setPlaySpeed(s.value)}
                      aria-pressed={playSpeed === s.value}
                      className={`px-2.5 py-1.5 font-mono text-xs ${
                        playSpeed === s.value
                          ? "bg-surface-3 text-ink-1"
                          : "text-ink-3 hover:text-ink-2"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {activeEntry && (
            <section className="panel" aria-label="Công thức tính toán">
              <div className="panel-header">
                <Atom size={13} aria-hidden /> Công thức
              </div>
              <div className="space-y-3 p-3">
                <div className="overflow-x-auto rounded-md bg-surface-2 px-3 py-3 text-center">
                  <Formula tex={activeEntry.formulaTex} displayMode />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px] tabular-nums">
                  <dt className="text-ink-3">U_d0 / U_2</dt>
                  <dd className="text-right text-ink-1">{activeEntry.ud0FactorVsU2.toFixed(2)}</dd>
                  <dt className="text-ink-3">Số van</dt>
                  <dd className="text-right text-ink-1">{activeEntry.valveLabels.length}</dd>
                  <dt className="text-ink-3">Điều khiển</dt>
                  <dd className="text-right text-ink-1">
                    {activeEntry.controlled ? "SCR" : "Diode"}
                  </dd>
                </dl>
              </div>
            </section>
          )}
        </aside>

        {/* ============================ CỘT GIỮA ============================ */}
        <section className="col-span-12 space-y-4 lg:col-span-6" aria-label="Sơ đồ và dạng sóng">
          <div className="panel p-3">
            <CircuitSchematic
              entry={activeEntry}
              valveStates={valveStates}
              loadType={selectedLoadType}
              thetaDeg={thetaDeg}
            />
          </div>

          <div className="panel">
            {/* Bật/tắt lớp sóng */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
              {(
                [
                  ["udTheory", "Lý thuyết", "var(--sig-theory)"],
                  ["udSimulink", "Simulink", "var(--sig-sim)"],
                  ["idSimulink", "i_tải", "var(--sig-on)"],
                  ["uVan1", "u_van1", "var(--sig-warn)"],
                  ["iVan1", "i_van1", "#60a5fa"],
                  ["gatePulses", "Gate", "var(--sig-gate)"],
                ] as const
              ).map(([key, label, color]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleLayer(key)}
                  aria-pressed={layers[key]}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                    layers[key]
                      ? "border-line-strong bg-surface-3 text-ink-1"
                      : "border-line text-ink-3 hover:text-ink-2"
                  }`}
                >
                  <span
                    className="inline-block h-[2px] w-3.5"
                    style={{ backgroundColor: layers[key] ? color : "var(--ink-3)" }}
                    aria-hidden
                  />
                  {label}
                </button>
              ))}
            </div>

            <MultiChannelCanvas
              waveforms={activeCircuit?.waveforms ?? null}
              thetaDeg={thetaDeg}
              layers={layers}
              milestones={milestones}
              isThreePhase={activeEntry?.family === "3P"}
              className="p-2 pt-1"
            />

            {/* Thanh quét góc pha */}
            <div className="border-t border-line px-3 pb-3 pt-2.5">
              <div className="flex items-center justify-between pb-1.5 font-mono text-[11px] text-ink-3">
                <span>Trục góc pha θ ∈ [0°, 720°]</span>
                <span className="tabular-nums text-sig-scrub">
                  θ = {Math.round(thetaDeg)}° ·{" "}
                  {(Math.round(thetaDeg) / 360).toFixed(2)} chu kỳ
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={719}
                step={1}
                value={Math.round(thetaDeg)}
                onChange={(e) => setTheta(Number(e.target.value))}
                className="scrubber"
                aria-label="Vạch quét góc pha"
              />
              {/* Chip mốc chuyển mạch */}
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
                {milestones.map((m) => {
                  const isActive =
                    currentMilestoneIndex >= 0 &&
                    milestones[currentMilestoneIndex]?.theta === m.theta;
                  return (
                    <button
                      key={`${m.theta}-${m.title}`}
                      type="button"
                      onClick={() => jumpToMilestone(m.theta)}
                      title={m.title}
                      className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                        isActive
                          ? "border-sig-gate/50 bg-sig-gate/10 text-sig-gate"
                          : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                      }`}
                    >
                      {m.theta}°
                    </button>
                  );
                })}
                {milestones.length === 0 && (
                  <span className="py-1 text-[11px] text-ink-3">Chưa có mốc chuyển mạch</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============================ CỘT PHẢI =========================== */}
        <aside className="col-span-12 space-y-4 lg:col-span-3">
          <TheoryVsSimulinkTable circuit={activeCircuit} />

          <section className="panel" aria-label="Danh sách mốc chuyển mạch">
            <div className="panel-header">
              <Zap size={13} style={{ color: "var(--sig-gate)" }} aria-hidden /> Mốc chuyển mạch
            </div>
            <ol className="max-h-[300px] divide-y divide-line overflow-y-auto">
              {milestones.map((m, i) => (
                <li key={`${m.theta}-${m.title}`}>
                  <button
                    type="button"
                    onClick={() => jumpToMilestone(m.theta)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
                      i === currentMilestoneIndex ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ink-2">
                      {m.theta}°
                    </span>
                    <span className="text-xs leading-snug text-ink-2">
                      {m.title}
                      <ChevronRight size={11} className="ml-1 inline text-ink-3" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
              {milestones.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-ink-3">
                  Chọn mạch để xem mốc chuyển mạch
                </li>
              )}
            </ol>
          </section>
        </aside>
      </main>

      {/* Card giải thích nổi khi dừng tại mốc */}
      <div className="pointer-events-none fixed inset-0 z-30">
        <div className="pointer-events-auto absolute bottom-4 right-4">
          <MilestoneExplanation
            milestone={
              pausedAtMilestoneTheta !== null && currentMilestoneIndex >= 0
                ? milestones[currentMilestoneIndex] ?? null
                : null
            }
            thetaDeg={thetaDeg}
            onClose={() => dismissMilestonePause()}
            onPrev={() => goMilestone(-1)}
            onNext={() => goMilestone(1)}
            hasPrev={currentMilestoneIndex > 0}
            hasNext={currentMilestoneIndex < milestones.length - 1}
          />
        </div>
      </div>
    </div>
  );
}
