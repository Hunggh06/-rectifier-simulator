"use client";

import { create } from "zustand";
import type {
  CatalogEntry,
  CircuitSimulationData,
  ValveState,
  ValveStateMap,
  WaveLayerVisibility,
} from "@/types/simulator";

/**
 * useSimulatorStore — Zustand store điều khiển toàn bộ tiến trình:
 * chọn mạch/góc/tải, quét trục góc pha θ, bật/tắt lớp sóng, tự dừng ở milestone.
 */

const DEFAULT_LAYERS: WaveLayerVisibility = {
  udTheory: true,
  udSimulink: true,
  idSimulink: false,
  uVan1: false,
  iVan1: false,
  gatePulses: false,
};

interface SimulatorState {
  /* Dữ liệu */
  catalog: CatalogEntry[];
  circuits: CircuitSimulationData[];

  /* Lựa chọn hiện tại */
  selectedCatalogId: string | null;
  selectedAlphaDeg: number;
  selectedLoadType: "R" | "RL";

  /* Tiến trình quét */
  thetaDeg: number; // 0..720
  isPlaying: boolean;
  playSpeed: number; // độ / frame

  /* Milestone */
  pausedAtMilestoneTheta: number | null;

  /* Lớp sóng hiển thị */
  layers: WaveLayerVisibility;

  /* Hành động */
  loadDataset: (dataset: {
    catalog: CatalogEntry[];
    circuits: CircuitSimulationData[];
  }) => void;
  selectCatalog: (catalogId: string) => void;
  selectAlpha: (alphaDeg: number) => void;
  selectLoadType: (loadType: "R" | "RL") => void;
  setTheta: (thetaDeg: number) => void;
  nudgeTheta: (deltaDeg: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  toggleLayer: (key: keyof WaveLayerVisibility) => void;
  jumpToMilestone: (theta: number) => void;
  dismissMilestonePause: () => void;
}

/** Tìm bản ghi mô phỏng khớp lựa chọn hiện tại */
export function selectActiveCircuit(
  state: Pick<
    SimulatorState,
    "circuits" | "selectedCatalogId" | "selectedAlphaDeg" | "selectedLoadType"
  >
): CircuitSimulationData | null {
  return (
    state.circuits.find(
      (c) =>
        c.catalogId === state.selectedCatalogId &&
        c.alphaDeg === state.selectedAlphaDeg &&
        c.loadType === state.selectedLoadType
    ) ?? null
  );
}

/** Danh sách góc kích khả dụng cho 1 mạch + 1 loại tải */
export function availableAlphas(
  catalog: CatalogEntry[],
  circuits: CircuitSimulationData[],
  catalogId: string | null,
  loadType: "R" | "RL"
): number[] {
  const hasAny = circuits.some((c) => c.catalogId === catalogId && c.loadType === loadType);
  if (!hasAny) return [];
  return [
    ...new Set(
      circuits
        .filter((c) => c.catalogId === catalogId && c.loadType === loadType)
        .map((c) => c.alphaDeg)
    ),
  ].sort((a, b) => a - b);
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  catalog: [],
  circuits: [],

  selectedCatalogId: null,
  selectedAlphaDeg: 0,
  selectedLoadType: "R",

  thetaDeg: 0,
  isPlaying: false,
  playSpeed: 2,

  pausedAtMilestoneTheta: null,

  layers: { ...DEFAULT_LAYERS },

  loadDataset: ({ catalog, circuits }) => {
    const first = catalog[0]?.catalogId ?? null;
    // Chọn mặc định: entry đầu tiên có sẵn của mạch đầu tiên
    let alpha = 0;
    let load: "R" | "RL" = "R";
    if (first !== null) {
      const firstCircuit = circuits.find((c) => c.catalogId === first);
      if (firstCircuit) {
        alpha = firstCircuit.alphaDeg;
        load = firstCircuit.loadType;
      }
    }
    set({
      catalog,
      circuits,
      selectedCatalogId: first,
      selectedAlphaDeg: alpha,
      selectedLoadType: load,
      thetaDeg: 0,
      isPlaying: false,
      pausedAtMilestoneTheta: null,
    });
  },

  selectCatalog: (catalogId) => {
    const { circuits } = get();
    const firstForCatalog = circuits.find((c) => c.catalogId === catalogId);
    set({
      selectedCatalogId: catalogId,
      selectedAlphaDeg: firstForCatalog?.alphaDeg ?? 0,
      selectedLoadType: firstForCatalog?.loadType ?? "R",
      thetaDeg: 0,
      pausedAtMilestoneTheta: null,
      isPlaying: false,
    });
  },

  selectAlpha: (alphaDeg) =>
    set({ selectedAlphaDeg: alphaDeg, thetaDeg: 0, pausedAtMilestoneTheta: null }),

  selectLoadType: (loadType) => {
    const { circuits, selectedCatalogId } = get();
    const match = circuits.find(
      (c) =>
        c.catalogId === selectedCatalogId &&
        c.loadType === loadType &&
        c.alphaDeg === get().selectedAlphaDeg
    );
    const fallback =
      circuits.find((c) => c.catalogId === selectedCatalogId && c.loadType === loadType) ?? null;
    set({
      selectedLoadType: loadType,
      selectedAlphaDeg: match ? get().selectedAlphaDeg : fallback?.alphaDeg ?? 0,
      thetaDeg: 0,
      pausedAtMilestoneTheta: null,
    });
  },

  setTheta: (thetaDeg) => {
    const wrapped = ((thetaDeg % 720) + 720) % 720;
    const { pausedAtMilestoneTheta } = get();
    set({ thetaDeg: wrapped, pausedAtMilestoneTheta: pausedAtMilestoneTheta });
  },

  nudgeTheta: (deltaDeg) => {
    const { thetaDeg, setTheta } = get();
    setTheta(thetaDeg + deltaDeg);
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),

  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),

  jumpToMilestone: (theta) =>
    set({ thetaDeg: theta, isPlaying: false, pausedAtMilestoneTheta: theta }),

  dismissMilestonePause: () => set({ pausedAtMilestoneTheta: null }),
}));

/** Hook tiện lợi: lấy bản ghi mô phỏng đang hoạt động */
export function useActiveCircuit(): CircuitSimulationData | null {
  return useSimulatorStore((s) => {
    const active = selectActiveCircuit(s);
    return active;
  });
}

/** Hook tiện lợi: danh sách góc khả dụng của lựa chọn hiện tại */
export function useAvailableAlphas(): number[] {
  return useSimulatorStore((s) =>
    availableAlphas(s.catalog, s.circuits, s.selectedCatalogId, s.selectedLoadType)
  );
}

/** Hook tiện lợi: entry danh mục đang chọn */
export function useActiveCatalogEntry(): CatalogEntry | null {
  return useSimulatorStore(
    (s) => s.catalog.find((c) => c.catalogId === s.selectedCatalogId) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Tiện ích tính trạng thái van từ dữ liệu                             */
/* ------------------------------------------------------------------ */

/**
 * Xác định trạng thái các van tại góc θ hiện hành.
 * activeValves của milestone gần nhất (±0.5°) được dùng trực tiếp;
 * ngoài ra suy luận từ dấu dòng van: |iVan| > ngưỡng → conducting,
 * uVan âm sâu → reverse-blocked, còn lại → forward-blocked.
 */
export function computeValveStatesAt(
  circuit: CircuitSimulationData,
  thetaDeg: number
): ValveStateMap {
  const idx = Math.round(((thetaDeg % 720) + 720) % 720);
  const w = circuit.waveforms;
  const n = w.thetaDeg.length;
  const i = Math.min(Math.max(idx, 0), n - 1);

  const states: ValveStateMap = {};
  for (const label of valveLabelsOf(circuit)) {
    states[label] = "forward-blocked";
  }

  // Van 1 có đo trực tiếp
  if (Math.abs(w.iVan1[i]) > 0.05 * Math.max(1, peakAbs(w.idSimulink))) {
    states[valveLabelsOf(circuit)[0]] = "conducting";
  } else if (w.uVan1[i] < -1) {
    states[valveLabelsOf(circuit)[0]] = "reverse-blocked";
  }

  // Các van khác: suy từ milestone gần nhất
  const nearest = nearestMilestone(circuit, thetaDeg);
  if (nearest) {
    for (const label of Object.keys(states)) {
      if (nearest.activeValves.includes(label)) {
        states[label] = "conducting";
      }
    }
  }
  return states;
}

function valveLabelsOf(circuit: CircuitSimulationData): string[] {
  // Suy từ milestones nếu có
  for (const m of circuit.milestones) {
    if (m.activeValves.length > 0) {
      // không đủ tin cậy làm danh sách đầy đủ — chỉ dùng khi cần
      break;
    }
  }
  // Quy ước theo số pha/loại mạch
  const id = circuit.catalogId;
  if (id.startsWith("pha3_bridge")) {
    return ["V1", "V2", "V3", "V4", "V5", "V6"];
  }
  if (id.startsWith("pha3_tap")) {
    return ["D1", "D2", "D3"];
  }
  if (id.startsWith("pha1_tap")) {
    return ["D1", "D2"];
  }
  return ["D1", "D2", "D3", "D4"];
}

function nearestMilestone(circuit: CircuitSimulationData, thetaDeg: number) {
  let best: CircuitSimulationData["milestones"][number] | null = null;
  let bestDist = Infinity;
  for (const m of circuit.milestones) {
    const d = Math.abs(m.theta - thetaDeg);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  // Chỉ tin cậy trong cửa sổ hẹp quanh mốc — ngoài vùng này van 1
  // vẫn được suy từ iVan1 đo trực tiếp, các van khác hiển thị khóa
  return bestDist <= 30 ? best : null;
}

function peakAbs(arr: number[]): number {
  let p = 0;
  for (const v of arr) {
    const a = Math.abs(v);
    if (a > p) p = a;
  }
  return p;
}

export type { ValveState };
