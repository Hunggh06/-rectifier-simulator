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
  idSimulink: true,
  uVan1: true,
  iVan1: true,
  gatePulses: true,
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
  pauseAtMilestones: boolean;

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
  togglePauseAtMilestone: () => void;
  stepNextMilestone: () => void;
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
  pauseAtMilestones: false,

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
    const still = pausedAtMilestoneTheta !== null && Math.abs(wrapped - pausedAtMilestoneTheta) < 0.5;
    set({ thetaDeg: wrapped, pausedAtMilestoneTheta: still ? pausedAtMilestoneTheta : null });
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

  togglePauseAtMilestone: () =>
    set((s) => ({ pauseAtMilestones: !s.pauseAtMilestones })),

  stepNextMilestone: () => {
    const { circuits, selectedCatalogId, selectedAlphaDeg, selectedLoadType, thetaDeg } = get();
    const c = circuits.find(
      (x) =>
        x.catalogId === selectedCatalogId &&
        x.alphaDeg === selectedAlphaDeg &&
        x.loadType === selectedLoadType
    );
    if (!c || c.milestones.length === 0) return;
    const a = ((thetaDeg % 720) + 720) % 720;
    const ms = c.milestones
      .map((m) => ((m.theta % 720) + 720) % 720)
      .sort((x, y) => x - y);
    const nxt = ms.find((t) => t > a + 0.5) ?? ms[0];
    set({ thetaDeg: nxt, isPlaying: false, pausedAtMilestoneTheta: nxt });
  },
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
/* Engine dẫn giải tích — PORT 1-1 từ scripts/generate-dataset.mjs      */
/* (trước đây dùng heuristic milestone ±30° nên hiển thị sai cặp van     */
/*  ở nửa thời gian quanh mỗi mốc — nay thay bằng bảng giải tích)        */
/* ------------------------------------------------------------------ */

const rad = (d: number) => (d * Math.PI) / 180;
const uaOf = (ph: number) => Math.sin(rad(ph));
const ubOf = (ph: number) => Math.sin(rad(ph - 120));
const ucOf = (ph: number) => Math.sin(rad(ph - 240));
const mod360 = (x: number) => ((x % 360) + 360) % 360;
/** ph nằm trong cửa sổ [start, start+len) theo mô-đun 360 */
const inWin = (ph: number, start: number, len: number) => mod360(ph - start) < len;

type PhKey = "a" | "b" | "c";

function argmaxArgmin(ph: number): { top: PhKey; bot: PhKey } {
  const arr: Array<[PhKey, number]> = [
    ["a", uaOf(ph)],
    ["b", ubOf(ph)],
    ["c", ucOf(ph)],
  ];
  let top = arr[0];
  let bot = arr[0];
  for (const p of arr) {
    if (p[1] > top[1]) top = p;
    if (p[1] < bot[1]) bot = p;
  }
  return { top: top[0], bot: bot[0] };
}

/**
 * Danh sách nhãn van đang dẫn tại θ — NHÃN KHỚP SCHEMATIC
 * (generator dùng V* cho mọi mode cầu 3P, schematic dùng D* cho mode diode
 *  và rail dưới bán điều khiển — hàm này chuẩn hoá về nhãn schematic).
 */
export function analyticConduction(
  catalogId: string,
  alphaDeg: number,
  loadType: "R" | "RL",
  thetaDeg: number
): string[] {
  const ph = mod360(thetaDeg);
  const a = alphaDeg;
  const rl = loadType === "RL";

  /* ---------------- 1 pha — tia hai nửa ---------------- */
  if (catalogId.startsWith("pha1_tap")) {
    if (catalogId.endsWith("diode")) {
      return ph < 180 ? ["D1"] : ["D2"];
    }
    // Thyristor: T1 kích tại α; RL duy trì đủ 180° (đến khi T2 kích),
    // tải R đoạn dẫn ngắn hơn: kết thúc khi pha hết bán chu kỳ dương.
    const len = rl ? 180 : 180 - a;
    if (inWin(ph, a, len)) return ["V1"];
    if (inWin(ph, mod360(180 + a), len)) return ["V2"];
    return [];
  }

  /* ---------------- 1 pha — cầu ---------------- */
  if (catalogId.startsWith("pha1_bridge")) {
    if (catalogId.endsWith("diode")) {
      return ph < 180 ? ["D1", "D3"] : ["D2", "D4"];
    }
    if (catalogId.endsWith("thyristor")) {
      return inWin(ph, a, 180) ? ["V1", "V2"] : ["V3", "V4"];
    }
    // Bán điều khiển: rail trên SCR lệch α, rail dưới diode tự nhiên;
    // RL có freewheeling qua cặp cùng phía sau biên 180°.
    if (rl) {
      if (inWin(ph, a, 180 - a)) return ["V1", "D2"];
      if (inWin(ph, 180, a)) return ["V1", "D4"]; // freewheel
      if (inWin(ph, 180 + a, 180 - a)) return ["V3", "D4"];
      return ["V3", "D2"]; // freewheel [360, 360+α)
    }
    if (inWin(ph, a, 180 - a)) return ["V1", "D2"];
    if (inWin(ph, 180 + a, 180 - a)) return ["V3", "D4"];
    return [];
  }

  /* ---------------- 3 pha — tia (M3) ---------------- */
  if (catalogId.startsWith("pha3_tap")) {
    const V = catalogId.endsWith("thyristor");
    const lbl: Record<PhKey, string> = V
      ? { a: "V1", b: "V2", c: "V3" }
      : { a: "D1", b: "D2", c: "D3" };
    if (!V) {
      return [lbl[argmaxArgmin(ph).top]];
    }
    // Điểm tự nhiên {a:30,b:150,c:270}; span RL=120°, R=min(120,150−α)
    const span = rl ? 120 : Math.min(120, 150 - a);
    const natStart: Record<PhKey, number> = { a: 30, b: 150, c: 270 };
    for (const k of ["a", "b", "c"] as PhKey[]) {
      if (inWin(ph, natStart[k] + a, span)) return [lbl[k]];
    }
    return [];
  }

  /* ---------------- 3 pha — cầu ---------------- */
  const TOP_V: Record<PhKey, string> = { a: "V1", b: "V3", c: "V5" };
  const BOT_V: Record<PhKey, string> = { a: "V4", b: "V6", c: "V2" };

  if (catalogId === "pha3_bridge_diode" || catalogId === "pha3_bridge_diode") {
    const { top, bot } = argmaxArgmin(ph);
    const TOP_D: Record<PhKey, string> = { a: "D1", b: "D3", c: "D5" };
    const BOT_D: Record<PhKey, string> = { a: "D4", b: "D6", c: "D2" };
    return [TOP_D[top], BOT_D[bot]];
  }

  if (catalogId.includes("semicontrolled")) {
    // Rail trên SCR (V1@30+α, V3@150+α, V5@270+α — chọn lần kích gần nhất trước ph);
    // rail dưới diode tự nhiên (argmin). Cùng pha → freewheel ud=0.
    const { bot } = argmaxArgmin(ph);
    const BOT_D: Record<PhKey, string> = { a: "D4", b: "D6", c: "D2" };
    const scrTimes: Array<{ k: PhKey; t: number }> = [
      { k: "a", t: 30 + a },
      { k: "b", t: 150 + a },
      { k: "c", t: 270 + a },
    ];
    let best = scrTimes[0];
    let bestDelta = Infinity;
    for (const s of scrTimes) {
      const d = mod360(ph - s.t);
      if (d < bestDelta) {
        bestDelta = d;
        best = s;
      }
    }
    if (best.k === bot) return [TOP_V[best.k], BOT_D[best.k]]; // freewheel
    return [TOP_V[best.k], BOT_D[bot]];
  }

  // Thyristor đối xứng & misfire — máy trạng thái theo thứ tự kích
  const misfire = catalogId.endsWith("misfire");
  const fireOrder = ["V1", "V2", "V3", "V4", "V5", "V6"];
  const effectiveOrder = misfire ? ["V1", "V2", "V3", "V4", "V6", "V5"] : fireOrder;
  const fireTime: Record<string, number> = {};
  fireOrder.forEach((v, idx) => (fireTime[v] = 30 + 60 * idx));
  const phaseOfTop: Record<string, PhKey> = { V1: "a", V3: "b", V5: "c" };
  const phaseOfBot: Record<string, PhKey> = { V4: "a", V6: "b", V2: "c" };

  let cur: number | null = null;
  for (let k = 0; k < 6; k++) {
    const ft = mod360(fireTime[effectiveOrder[k]] + a);
    const nt = mod360(fireTime[effectiveOrder[(k + 1) % 6]] + a);
    const inW = ft <= nt ? ph >= ft && ph < nt : ph >= ft || ph < nt;
    if (inW) {
      cur = k;
      break;
    }
  }
  if (cur === null) return [];
  const curV = effectiveOrder[cur];
  const prevV = effectiveOrder[(cur - 1 + 6) % 6];
  const topV = phaseOfTop[curV] ? curV : phaseOfTop[prevV] ? prevV : null;
  const botV = phaseOfBot[curV] ? curV : phaseOfBot[prevV] ? prevV : null;
  if (!topV || !botV) {
    // Hai van cùng rail dẫn → freewheel ud=0 (đúng vật lý, hiện cả hai van)
    return [prevV, curV];
  }
  return [topV, botV];
}

/**
 * Xác định trạng thái các van tại góc θ hiện hành — giải tích thuần,
 * đồng bộ tuyệt đối với dữ liệu sóng/milestone do generator sinh ra.
 */
export function computeValveStatesAt(
  circuit: CircuitSimulationData,
  thetaDeg: number
): ValveStateMap {
  const states: ValveStateMap = {};
  const active = new Set(
    analyticConduction(circuit.catalogId, circuit.alphaDeg, circuit.loadType, thetaDeg)
  );
  for (const label of valveLabelsOf(circuit)) {
    states[label] = active.has(label) ? "conducting" : "forward-blocked";
  }
  return states;
}

function valveLabelsOf(circuit: CircuitSimulationData): string[] {
  const id = circuit.catalogId;
  if (id === "pha3_bridge_diode") return ["D1", "D2", "D3", "D4", "D5", "D6"];
  if (id.includes("pha3_bridge_semicontrolled")) return ["V1", "V3", "V5", "D2", "D4", "D6"];
  if (id.startsWith("pha3_bridge")) return ["V1", "V2", "V3", "V4", "V5", "V6"];
  if (id.startsWith("pha3_tap")) {
    return id.endsWith("thyristor")
      ? ["V1", "V2", "V3"]
      : ["D1", "D2", "D3"];
  }
  if (id.startsWith("pha1_tap")) {
    return id.endsWith("thyristor") ? ["V1", "V2"] : ["D1", "D2"];
  }
  if (id.includes("pha1_bridge_semicontrolled")) return ["V1", "V3", "D2", "D4"];
  return id.includes("diode") ? ["D1", "D2", "D3", "D4"] : ["V1", "V2", "V3", "V4"];
}

export type { ValveState };
