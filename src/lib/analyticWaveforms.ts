/**
 * analyticWaveforms — sinh dạng sóng giảng dạy GIẢI TÍCH trên lưới θ 0..720°,
 * không phụ thuộc dataset (dùng được cho cả mock và dữ liệu Simulink thật).
 * Khớp quy ước generator: ua = sinθ, ub = sin(θ−120°), uc = sin(θ−240°).
 */

import { analyticConduction } from "@/store/useSimulatorStore";

export interface ValveCurrentSample {
  /** van đang dẫn dòng tải */
  on: boolean;
  /** đoạn dẫn dòng xả tự do freewheeling (vẽ nét gạch) */
  fw: boolean;
  /** biên độ tức thời chuẩn hoá 0..1: tải R theo hình ud, tải RL ≈ phẳng */
  amp: number;
}

export interface AnalyticExtras {
  thetaDeg: number[];
  /** nhãn các van theo thứ tự hàng hiển thị */
  valveLabels: string[];
  /** i qua từng van, chuẩn hoá 0..1 */
  valveCurrents: ValveCurrentSample[][];
  /** dòng pha thứ cấp MBA: 1P = ±1 vuông đối xứng; 3P = i_A = i_V1 − i_V4 */
  lineCurrent: number[];
  /** cầu 3P: bao cực dương φ_E / cực âm φ_F (điện áp pha) */
  phiE: number[] | null;
  phiF: number[] | null;
  /** nhãn gate theo van; mảng rỗng với mạch diode */
  gateLabels: string[];
  /** 0/1 mỗi van; cầu thyristor là xung kép cách 60° */
  gates: number[][];
}

const mod360 = (x: number) => ((x % 360) + 360) % 360;

function valveLabelSet(catalogId: string): string[] {
  if (catalogId === "ac1p_regulator") return ["T1", "T2"];
  if (catalogId === "ac3p_regulator") return ["V1", "V3", "V5", "V4", "V6", "V2"];
  if (catalogId === "dcdc_buck") return ["V", "D0"];
  if (catalogId === "dcdc_boost") return ["V", "D"];
  if (catalogId === "inv1p_full") return ["Tr1", "Tr2", "Tr3", "Tr4", "D1", "D2", "D3", "D4"];
  if (catalogId === "inv3p_180") return ["Tr1", "Tr2", "Tr3", "Tr4", "Tr5", "Tr6"];
  if (catalogId === "pha3_bridge_diode") return ["D1", "D3", "D5", "D4", "D6", "D2"];
  if (catalogId.includes("pha3_bridge_semicontrolled")) return ["V1", "V3", "V5", "D4", "D6", "D2"];
  if (catalogId.startsWith("pha3_bridge")) return ["V1", "V3", "V5", "V4", "V6", "V2"];
  if (catalogId.startsWith("pha3_tap")) {
    return catalogId.endsWith("thyristor") ? ["V1", "V2", "V3"] : ["D1", "D2", "D3"];
  }
  if (catalogId.startsWith("pha1_tap")) {
    return catalogId.endsWith("thyristor") ? ["V1", "V2"] : ["D1", "D2"];
  }
  if (catalogId.includes("pha1_bridge_semicontrolled")) return ["V1", "V3", "D2", "D4"];
  return catalogId.includes("diode") ? ["D1", "D3", "D2", "D4"] : ["V1", "V2", "V3", "V4"];
}

/** Cặp van cùng rail (không tạo điện áp dây) → freewheeling */
function isFreewheelPair(catalogId: string, active: string[]): boolean {
  const railTop = new Set(["V1", "V3", "V5", "D1", "D3", "D5"]);
  const railBot = new Set(["V4", "V6", "V2", "D4", "D6", "D2"]);
  if (active.length !== 2) return false;
  const sameRail =
    (railTop.has(active[0]) && railTop.has(active[1])) ||
    (railBot.has(active[0]) && railBot.has(active[1]));
  // 1P: freewheel khi cặp nằm cùng nửa mạch tia hoặc cùng phía cầu bán ĐK
  const halfTap = new Set(["D1", "V1"]);
  const halfTap2 = new Set(["D2", "V2"]);
  const semiLeft = new Set(["V1", "D4"]);
  const semiRight = new Set(["V3", "D2"]);
  return (
    sameRail ||
    (halfTap.has(active[0]) && halfTap.has(active[1]) && catalogId.startsWith("pha1_tap")) ||
    (semiLeft.has(active[0]) && semiLeft.has(active[1])) ||
    (semiRight.has(active[0]) && semiRight.has(active[1]))
  );
}

export function buildAnalyticExtras(
  catalogId: string,
  alphaDeg: number,
  loadType: "R" | "RL",
  controlled: boolean
): AnalyticExtras {
  const rl = loadType === "RL";
  const thetaDeg: number[] = [];
  for (let t = 0; t < 720; t += 1) thetaDeg.push(t);

  const valveLabels = valveLabelSet(catalogId);
  const valveCurrents: ValveCurrentSample[][] = valveLabels.map(() => []);

  const rad = (d: number) => (d * Math.PI) / 180;
  const phaseU: Record<string, number> = { a: 0, b: 0, c: 0 };
  const phiE: number[] | null = catalogId.startsWith("pha3_bridge") ? [] : null;
  const phiF: number[] | null = catalogId.startsWith("pha3_bridge") ? [] : null;
  const lineCurrent: number[] = [];

  const is3p = catalogId.startsWith("pha3");
  const isBridge = catalogId.startsWith("pha1_bridge") || catalogId.startsWith("pha3_bridge");
  const topPhaseOf: Record<string, string> = { V1: "a", V3: "b", V5: "c", D1: "a", D3: "b", D5: "c" };
  const botPhaseOf: Record<string, string> = { V4: "a", V6: "b", V2: "c", D4: "a", D6: "b", D2: "c" };

  for (const th of thetaDeg) {
    const active = analyticConduction(catalogId, alphaDeg, loadType, th);
    const actSet = new Set(active);
    const fw = isFreewheelPair(catalogId, active);

    const p = mod360(th);
    phaseU.a = Math.sin(rad(p));
    phaseU.b = Math.sin(rad(p - 120));
    phaseU.c = Math.sin(rad(p - 240));

    // Biên độ dòng tải chuẩn hoá: RL (L lớn) ≈ hằng số; R theo hình ud
    let ampId: number;
    if (rl) {
      ampId = 1;
    } else if (!is3p) {
      ampId = Math.abs(phaseU.a);
    } else if (!isBridge) {
      ampId = Math.max(phaseU.a, phaseU.b, phaseU.c);
    } else {
      const tp = topPhaseOf[active[0] ?? ""];
      const bp = botPhaseOf[active[1] ?? ""];
      const udPu = tp && bp ? phaseU[tp as "a" | "b" | "c"] - phaseU[bp as "a" | "b" | "c"] : 0;
      ampId = Math.min(Math.max(udPu / Math.sqrt(3), 0), 1);
    }

    valveLabels.forEach((lbl, vi) => {
      const on = actSet.has(lbl);
      valveCurrents[vi].push({ on, fw: fw && on, amp: on ? ampId : 0 });
    });

    if (phiE && phiF) {
      const peak = Math.SQRT2 * 100;
      phiE.push(peak * Math.max(phaseU.a, phaseU.b, phaseU.c));
      phiF.push(peak * Math.min(phaseU.a, phaseU.b, phaseU.c));
    }

    // Dòng pha MBA: hiệu dòng van "vào" trừ van "ra" của cùng pha
    let iline = 0;
    if (catalogId === "ac1p_regulator") {
      iline = actSet.has("T1") ? 1 : actSet.has("T2") ? -1 : 0;
    } else if (catalogId === "dcdc_buck" || catalogId === "dcdc_boost") {
      iline = actSet.has("V") ? 1 : 0;
    } else if (catalogId === "inv1p_full") {
      iline = actSet.has("Tr1") || actSet.has("Tr2") ? 1 : actSet.has("D1") || actSet.has("D2") ? -1 : actSet.has("Tr3") || actSet.has("Tr4") ? -1 : 1;
    } else if (catalogId === "inv3p_180") {
      iline = actSet.has("Tr1") ? 1 : actSet.has("D1") ? -1 : actSet.has("Tr4") ? -1 : actSet.has("D4") ? 1 : 0;
    } else if (!is3p) {
      if (catalogId.includes("tap")) {
        const fwd = actSet.has("D1") || actSet.has("V1");
        const rev = actSet.has("D2") || actSet.has("V2");
        iline = (fwd ? 1 : 0) - (rev ? 1 : 0);
      } else {
        const fwd = actSet.has("D1") || actSet.has("V1");
        const ret = actSet.has("D4") || actSet.has("V4");
        iline = (fwd ? 1 : 0) - (ret ? 1 : 0);
      }
    } else if (isBridge) {
      const topA = actSet.has("V1") || actSet.has("D1");
      const botA = actSet.has("V4") || actSet.has("D4");
      iline = (topA ? 1 : 0) - (botA ? 1 : 0);
    } else {
      // tia 3P: pha A = D1/V1 đang dẫn
      iline = actSet.has("V1") || actSet.has("D1") ? 1 : 0;
    }
    lineCurrent.push(iline);
  }

  const gateLabels: string[] = [];
  const gates: number[][] = [];
  if (controlled) {
    const pushGate = (lbl: string, fire: number, width: number) => {
      gateLabels.push(lbl);
      const f = mod360(fire);
      gates.push(
        thetaDeg.map((th) => (mod360(mod360(th) - f) < width ? 1 : 0))
      );
    };

    if (catalogId === "dcdc_buck" || catalogId === "dcdc_boost") {
      pushGate("V", 0, (alphaDeg / 100) * 360);
    } else if (catalogId === "ac1p_regulator") {
      pushGate("T1", alphaDeg, 10);
      pushGate("T2", 180 + alphaDeg, 10);
    } else if (catalogId === "inv1p_full") {
      pushGate("Tr1/2", 0, 180);
      pushGate("Tr3/4", 180, 180);
    } else if (catalogId === "inv3p_180") {
      for (let k = 0; k < 6; k++) pushGate(`Tr${k + 1}`, k * 60, 180);
    } else if (catalogId === "ac3p_regulator") {
      for (let k = 0; k < 6; k++) pushGate(`V${((k + 5) % 6) + 1}`, 30 + 60 * k + alphaDeg, 180);
    } else {
      for (const lbl of valveLabels) {
        if (!/^V/.test(lbl)) continue;
        const num = Number(lbl.slice(1));
        const is3pBridge = catalogId.startsWith("pha3_bridge");
        const natural = catalogId.startsWith("pha1_tap")
          ? num === 1
            ? 0
            : 180
          : catalogId.startsWith("pha1_bridge")
            ? num <= 2
              ? 0
              : 180
            : 30 + 60 * ((num + 5) % 6);
        const f1 = mod360(natural + alphaDeg);
        gateLabels.push(lbl);
        const row: number[] = [];
        for (const th of thetaDeg) {
          const p = mod360(th);
          let g = p >= f1 && p < f1 + (is3pBridge ? 5 : 10) ? 1 : 0;
          if (!g && is3pBridge) {
            const f2 = mod360(f1 + 60);
            g = p >= f2 && p < f2 + 5 ? 1 : 0;
          }
          row.push(g);
        }
        gates.push(row);
      }
    }
  }

  return { thetaDeg, valveLabels, valveCurrents, lineCurrent, phiE, phiF, gateLabels, gates };
}
