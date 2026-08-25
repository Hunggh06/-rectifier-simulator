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

  for (const th of thetaDeg) {
    const active = analyticConduction(catalogId, alphaDeg, loadType, th);
    const actSet = new Set(active);
    const fw = isFreewheelPair(catalogId, active);
    valveLabels.forEach((lbl, vi) => {
      valveCurrents[vi].push({ on: actSet.has(lbl), fw: fw && actSet.has(lbl) });
    });

    const p = mod360(th);
    phaseU.a = Math.sin(rad(p));
    phaseU.b = Math.sin(rad(p - 120));
    phaseU.c = Math.sin(rad(p - 240));
    if (phiE && phiF) {
      phiE.push(Math.max(phaseU.a, phaseU.b, phaseU.c));
      phiF.push(Math.min(phaseU.a, phaseU.b, phaseU.c));
    }

    // Dòng pha MBA: hiệu dòng van "vào" trừ van "ra" của cùng pha
    let iline = 0;
    const pick = (labels: string[]) => labels.find((l) => actSet.has(l));
    if (!is3p) {
      const topOn = pick(["D1", "V1"]) !== undefined;
      const botOn = pick(["D2", "V4"]) !== undefined || pick(["D4"]) !== undefined;
      iline = (topOn ? 1 : 0) - (botOn ? 1 : 0);
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
    for (const lbl of valveLabels) {
      if (!/^V/.test(lbl)) continue;
      gateLabels.push(lbl);
      const row: number[] = [];
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
          : 30 + 60 * ((num + 5) % 6); // V1→30, V2→90, … V6→330
      for (const th of thetaDeg) {
        const p = mod360(th);
        const f1 = mod360(natural + alphaDeg);
        let g = p >= f1 && p < f1 + (is3pBridge ? 5 : 10) ? 1 : 0;
        if (!g && is3pBridge) {
          const f2 = mod360(f1 + 60); // xung nhắc lại sau 60°
          g = p >= f2 && p < f2 + 5 ? 1 : 0;
        }
        row.push(g);
      }
      gates.push(row);
    }
  }

  return { thetaDeg, valveLabels, valveCurrents, lineCurrent, phiE, phiF, gateLabels, gates };
}
