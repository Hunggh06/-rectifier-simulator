import { analyticConduction } from "@/store/useSimulatorStore";

export interface ValveCurrentSample {
  on: boolean;
  fw: boolean;
  amp: number;
}

export interface NaturalIntersection {
  theta: number;
  label: string;
  fromPhase: string;
  toPhase: string;
}

export interface AlphaPoint {
  startDeg: number;
  endDeg: number;
  valve: string;
}

export interface AnalyticExtras {
  thetaDeg: number[];
  valveLabels: string[];
  selectedValve: string;
  uSelectedValve: number[];
  iSelectedValve: number[];
  uSourceA: number[];
  uSourceB: number[];
  uSourceC: number[];
  conductingPhase: Array<"a" | "b" | "c" | null>;
  naturalIntersections: NaturalIntersection[];
  alphaPoints: AlphaPoint[];
  valveCurrents: ValveCurrentSample[][];
  lineCurrent: number[];
  phiE: number[] | null;
  phiF: number[] | null;
  gateLabels: string[];
  gates: number[][];
}

const mod360 = (x: number) => ((x % 360) + 360) % 360;

function valveLabelSet(catalogId: string): string[] {
  if (catalogId === "pha1_half_diode") return ["D1"];
  if (catalogId === "pha1_half_thyristor") return ["V1"];
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

function isFreewheelPair(catalogId: string, active: string[]): boolean {
  const railTop = new Set(["V1", "V3", "V5", "D1", "D3", "D5"]);
  const railBot = new Set(["V4", "V6", "V2", "D4", "D6", "D2"]);
  if (active.length !== 2) return false;
  const sameRail =
    (railTop.has(active[0]) && railTop.has(active[1])) ||
    (railBot.has(active[0]) && railBot.has(active[1]));
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
  controlled: boolean,
  observedValve?: string | null
): AnalyticExtras {
  const rl = loadType === "RL";
  const thetaDeg: number[] = [];
  for (let t = 0; t < 720; t += 1) thetaDeg.push(t);

  const valveLabels = valveLabelSet(catalogId);
  const selectedValve =
    observedValve && valveLabels.includes(observedValve)
      ? observedValve
      : valveLabels[0] ?? "V1";

  const valveCurrents: ValveCurrentSample[][] = valveLabels.map(() => []);

  const rad = (d: number) => (d * Math.PI) / 180;
  const phiE: number[] | null = catalogId.startsWith("pha3_bridge") ? [] : null;
  const phiF: number[] | null = catalogId.startsWith("pha3_bridge") ? [] : null;
  const lineCurrent: number[] = [];

  const uSourceA: number[] = [];
  const uSourceB: number[] = [];
  const uSourceC: number[] = [];
  const uSelectedValve: number[] = [];
  const iSelectedValve: number[] = [];
  const conductingPhase: Array<"a" | "b" | "c" | null> = [];

  const is3p = catalogId.startsWith("pha3");
  const isBridge = catalogId.startsWith("pha1_bridge") || catalogId.startsWith("pha3_bridge");
  const topPhaseOf: Record<string, string> = { V1: "a", V3: "b", V5: "c", D1: "a", D3: "b", D5: "c" };
  const botPhaseOf: Record<string, string> = { V4: "a", V6: "b", V2: "c", D4: "a", D6: "b", D2: "c" };

  const peakVoltage = Math.SQRT2 * 100;
  const rLoad = 10;

  for (const th of thetaDeg) {
    const active = analyticConduction(catalogId, alphaDeg, loadType, th);
    const actSet = new Set(active);
    const fw = isFreewheelPair(catalogId, active);

    const p = mod360(th);
    const ua = peakVoltage * Math.sin(rad(p));
    const ub = peakVoltage * Math.sin(rad(p - 120));
    const uc = peakVoltage * Math.sin(rad(p - 240));

    uSourceA.push(ua);
    uSourceB.push(ub);
    uSourceC.push(uc);

    const phaseU = { a: Math.sin(rad(p)), b: Math.sin(rad(p - 120)), c: Math.sin(rad(p - 240)) };

    let cPhase: "a" | "b" | "c" | null = null;
    if (is3p) {
      if (actSet.has("V1") || actSet.has("D1") || actSet.has("T1")) cPhase = "a";
      else if (actSet.has("V2") || actSet.has("D2") || actSet.has("T2")) cPhase = "b";
      else if (actSet.has("V3") || actSet.has("D3") || actSet.has("T3")) cPhase = "c";
      else if (actSet.has("V5") || actSet.has("D5")) cPhase = "c";
    }
    conductingPhase.push(cPhase);

    let ampId: number;
    let udVolt = 0;
    if (catalogId.startsWith("pha1_half")) {
      const aRad = (alphaDeg * Math.PI) / 180;
      const thRad = (p * Math.PI) / 180;
      const phiRad = Math.atan(2 * Math.PI * 50 * (0.08 / 10));
      const wTau = 2 * Math.PI * 50 * (0.08 / 10);
      if (rl) {
        const cur = Math.sin(thRad - phiRad) - Math.sin(aRad - phiRad) * Math.exp(-((p - alphaDeg) * (Math.PI / 180)) / wTau);
        ampId = Math.max(cur, 0);
        udVolt = actSet.has("V1") || actSet.has("D1") ? ua : 0;
      } else {
        ampId = Math.max(phaseU.a, 0);
        udVolt = actSet.has("V1") || actSet.has("D1") ? Math.max(ua, 0) : 0;
      }
    } else if (catalogId.startsWith("pha3_tap")) {
      if (cPhase === "a") udVolt = ua;
      else if (cPhase === "b") udVolt = ub;
      else if (cPhase === "c") udVolt = uc;
      else udVolt = 0;
      ampId = rl ? 1 : Math.max(udVolt / peakVoltage, 0);
    } else if (rl) {
      ampId = 1;
      if (isBridge && is3p) {
        const tp = topPhaseOf[active[0] ?? ""];
        const bp = botPhaseOf[active[1] ?? ""];
        const uPos = tp === "a" ? ua : tp === "b" ? ub : tp === "c" ? uc : 0;
        const uNeg = bp === "a" ? ua : bp === "b" ? ub : bp === "c" ? uc : 0;
        udVolt = uPos - uNeg;
      }
    } else if (!is3p) {
      ampId = Math.abs(phaseU.a);
      udVolt = Math.abs(ua);
    } else if (!isBridge) {
      ampId = Math.max(phaseU.a, phaseU.b, phaseU.c);
    } else {
      const tp = topPhaseOf[active[0] ?? ""];
      const bp = botPhaseOf[active[1] ?? ""];
      const udPu = tp && bp ? phaseU[tp as "a" | "b" | "c"] - phaseU[bp as "a" | "b" | "c"] : 0;
      ampId = Math.min(Math.max(udPu / Math.sqrt(3), 0), 1);
      const uPos = tp === "a" ? ua : tp === "b" ? ub : tp === "c" ? uc : 0;
      const uNeg = bp === "a" ? ua : bp === "b" ? ub : bp === "c" ? uc : 0;
      udVolt = uPos - uNeg;
    }

    valveLabels.forEach((lbl, vi) => {
      const on = actSet.has(lbl);
      valveCurrents[vi].push({ on, fw: fw && on, amp: on ? ampId : 0 });
    });

    let uVal = 0;
    let iVal = 0;
    const isSelectedConducting = actSet.has(selectedValve);

    if (catalogId.startsWith("pha3_tap")) {
      const isV1 = selectedValve === "V1" || selectedValve === "D1" || selectedValve === "T1";
      const isV2 = selectedValve === "V2" || selectedValve === "D2" || selectedValve === "T2";
      const isV3 = selectedValve === "V3" || selectedValve === "D3" || selectedValve === "T3";
      const uPhase = isV1 ? ua : isV2 ? ub : isV3 ? uc : ua;

      if (isSelectedConducting) {
        uVal = 0;
        iVal = udVolt / rLoad;
      } else {
        uVal = uPhase - udVolt;
        iVal = 0;
      }
    } else if (catalogId.startsWith("pha1_tap")) {
      const isV1 = selectedValve === "V1" || selectedValve === "D1";
      if (isSelectedConducting) {
        uVal = 0;
        iVal = Math.max(Math.abs(ua) / rLoad, 0);
      } else {
        uVal = isV1 ? -2 * Math.abs(ua) : 2 * Math.abs(ua);
        iVal = 0;
      }
    } else if (catalogId.startsWith("pha1_half")) {
      if (isSelectedConducting) {
        uVal = 0;
        iVal = ampId * (peakVoltage / rLoad);
      } else {
        uVal = ua;
        iVal = 0;
      }
    } else if (is3p && isBridge) {
      if (isSelectedConducting) {
        uVal = 0;
        iVal = ampId * (peakVoltage / rLoad);
      } else {
        const isTop = topPhaseOf[selectedValve] !== undefined;
        const tp = topPhaseOf[active[0] ?? ""];
        const bp = botPhaseOf[active[1] ?? ""];
        const uPha =
          topPhaseOf[selectedValve] === "a" || botPhaseOf[selectedValve] === "a"
            ? ua
            : topPhaseOf[selectedValve] === "b" || botPhaseOf[selectedValve] === "b"
              ? ub
              : uc;
        const uConducting = isTop
          ? tp === "a"
            ? ua
            : tp === "b"
              ? ub
              : uc
          : bp === "a"
            ? ua
            : bp === "b"
              ? ub
              : uc;
        uVal = isTop ? uPha - uConducting : uConducting - uPha;
        iVal = 0;
      }
    } else {
      if (isSelectedConducting) {
        uVal = 0;
        iVal = Math.abs(udVolt) / rLoad;
      } else {
        uVal = -Math.abs(ua);
        iVal = 0;
      }
    }

    uSelectedValve.push(uVal);
    iSelectedValve.push(iVal);

    if (phiE && phiF) {
      phiE.push(peakVoltage * Math.max(phaseU.a, phaseU.b, phaseU.c));
      phiF.push(peakVoltage * Math.min(phaseU.a, phaseU.b, phaseU.c));
    }

    let iline = 0;
    if (catalogId === "pha1_half_diode" || catalogId === "pha1_half_thyristor") {
      iline = actSet.has("D1") || actSet.has("V1") ? 1 : 0;
    } else if (catalogId === "ac1p_regulator") {
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
      iline = actSet.has("V1") || actSet.has("D1") ? 1 : 0;
    }
    lineCurrent.push(iline);
  }

  const naturalIntersections: NaturalIntersection[] = is3p
    ? [
        { theta: 30, label: "π/6 (30°)", fromPhase: "C", toPhase: "A" },
        { theta: 150, label: "5π/6 (150°)", fromPhase: "A", toPhase: "B" },
        { theta: 270, label: "3π/2 (270°)", fromPhase: "B", toPhase: "C" },
        { theta: 390, label: "13π/6 (390°)", fromPhase: "C", toPhase: "A" },
        { theta: 510, label: "17π/6 (510°)", fromPhase: "A", toPhase: "B" },
        { theta: 630, label: "7π/2 (630°)", fromPhase: "B", toPhase: "C" },
      ]
    : [];

  const alphaPoints: AlphaPoint[] = [];
  if (controlled && is3p) {
    alphaPoints.push(
      { startDeg: 30, endDeg: 30 + alphaDeg, valve: "T1 (V1)" },
      { startDeg: 150, endDeg: 150 + alphaDeg, valve: "T2 (V2)" },
      { startDeg: 270, endDeg: 270 + alphaDeg, valve: "T3 (V3)" },
      { startDeg: 390, endDeg: 390 + alphaDeg, valve: "T1 (V1)" },
      { startDeg: 510, endDeg: 510 + alphaDeg, valve: "T2 (V2)" },
      { startDeg: 630, endDeg: 630 + alphaDeg, valve: "T3 (V3)" }
    );
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

    if (catalogId === "pha1_half_thyristor") {
      pushGate("V1", alphaDeg, 10);
    } else if (catalogId === "dcdc_buck" || catalogId === "dcdc_boost") {
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

  return {
    thetaDeg,
    valveLabels,
    selectedValve,
    uSelectedValve,
    iSelectedValve,
    uSourceA,
    uSourceB,
    uSourceC,
    conductingPhase,
    naturalIntersections,
    alphaPoints,
    valveCurrents,
    lineCurrent,
    phiE,
    phiF,
    gateLabels,
    gates,
  };
}
