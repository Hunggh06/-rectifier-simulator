/**
 * simulator.ts — Kiểu dữ liệu trung tâm của bộ mô phỏng chỉnh lưu.
 *
 * Mọi trường khớp CHÍNH XÁC với JSON do pipeline MATLAB/Simulink
 * (matlab/export_simulink_data.m) hoặc bộ sinh dữ liệu mẫu
 * (scripts/generate-dataset.mjs) xuất ra.
 */

/** Loại tải của mạch chỉnh lưu */
export type LoadType = "R" | "RL";

/** Gia đình mạch: 1 pha / 3 pha */
export type CircuitFamily = "1P" | "3P" | "C3" | "C4" | "C5";

/** Một mục trong danh mục 12 mạch chỉnh lưu (tĩnh, phục vụ UI) */
export interface CatalogEntry {
  catalogId: string;
  circuitName: string;
  family: CircuitFamily;
  /** Khóa topology để CircuitSchematic biết vẽ sơ đồ nào */
  topology:
    | "half1p-diode"
    | "tap1p-diode"
    | "tap1p-thyristor"
    | "bridge1p-diode"
    | "bridge1p-thyristor"
    | "bridge1p-semi"
    | "tap3p-diode"
    | "tap3p-thyristor"
    | "bridge3p-diode"
    | "bridge3p-thyristor"
    | "bridge3p-misfire"
    | "bridge3p-semi"
    | "ac1p-regulator"
    | "ac3p-regulator"
    | "dcdc-buck"
    | "dcdc-boost"
    | "inv1p-full"
    | "inv3p-180";
  controlled: boolean;
  /** Nhãn van theo thứ tự vẽ trên sơ đồ */
  valveLabels: string[];
  /** Công thức Udα dạng LaTeX (render bằng KaTeX) */
  formulaTex: string;
  /** Hệ số Ud0/U2 lý thuyết ở alpha = 0 */
  ud0FactorVsU2: number;
  descriptionVN: string;
}

/** Chỉ số đối chiếu lý thuyết ↔ Simulink cho một điểm dữ liệu */
export interface CircuitMetrics {
  theory: {
    /** Điện áp chỉnh lưu trung bình [V] */
    Ud: number;
    Urms?: number;
    /** Điện áp ngược lớn nhất trên van 1 [V] */
    UngMax: number;
    /** Dòng trung bình qua tải [A] */
    Iavg: number;
    /** Công suất tính toán máy biến áp [VA] */
    Sba: number;
  };
  simulink: {
    Ud: number;
    Urms?: number;
    UngMax: number;
    Iavg: number;
    Irms: number;
    /** |sim − theory| / theory × 100 [%] */
    errorPercent: number;
  };
}

/** Mốc chuyển mạch quan trọng — nơi Process Stepper tự dừng giải thích */
export interface CircuitMilestone {
  /** Góc pha [độ] trong khoảng 0..720 */
  theta: number;
  title: string;
  description: string;
  /** Nhãn các van đang dẫn điện tại mốc này, ví dụ ["D1","D3"] */
  activeValves: string[];
  /** Mô tả ngắn trạng thái mạch (VD: "D1 phân cực thuận, chờ xung kích") */
  circuitState: string;
}

/** Dạng sóng rời rạc đã downsample về lưới 1° (721 điểm = 2 chu kỳ) */
export interface CircuitWaveforms {
  thetaDeg: number[];
  /** Điện áp nguồn: 1P là u2, 3P là ua (ub, uc suy ra lệch 120°) */
  uSource: number[];
  udTheory: number[];
  udSimulink: number[];
  idSimulink: number[];
  uVan1: number[];
  iVan1: number[];
  gatePulses: number[];
}

/** Một bản ghi mô phỏng đầy đủ cho 1 mạch + 1 góc kích + 1 loại tải */
export interface CircuitSimulationData {
  circuitId: string;
  circuitName: string;
  catalogId: string;
  alphaDeg: number;
  loadType: LoadType;
  metrics: CircuitMetrics;
  waveforms: CircuitWaveforms;
  milestones: CircuitMilestone[];
}

/** Toàn bộ tệp dataset JSON */
export interface SimulatorDataset {
  meta: {
    generatedAtISO: string;
    generator: "matlab-simulink" | "analytic-mock";
    matlabRelease?: string;
    solver?: string;
    TsStep?: number;
    fGridHz: number;
    noteVN: string;
  };
  catalog: CatalogEntry[];
  circuits: CircuitSimulationData[];
}

/* ------------------------------------------------------------------ */
/* Trạng thái UI                                                       */
/* ------------------------------------------------------------------ */

/** Trạng thái dẫn điện của một van tại góc quét hiện tại */
export type ValveState = "conducting" | "forward-blocked" | "reverse-blocked";

/** Bản đồ trạng thái van: nhãn van → trạng thái */
export type ValveStateMap = Record<string, ValveState>;

/** Lớp sóng bật/tắt được trên máy hiện sóng */
export interface WaveLayerVisibility {
  udTheory: boolean;
  udSimulink: boolean;
  idSimulink: boolean;
  uVan1: boolean;
  iVan1: boolean;
  gatePulses: boolean;
}
