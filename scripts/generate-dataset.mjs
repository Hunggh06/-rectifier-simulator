#!/usr/bin/env node
/**
 * generate-dataset.mjs
 * ---------------------------------------------------------------------------
 * Bộ sinh dữ liệu mẫu (analytic mock) cho web simulator — dùng khi chưa chạy
 * pipeline MATLAB/Simulink. Kết quả ghi ra:
 *    src/data/simulink_verified_dataset.json
 *
 * Nguyên tắc:
 *  - udTheory: dạng sóng GIẢI TÍCH chuẩn giáo trình (Chương 2 - Chỉnh lưu).
 *  - udSimulink: mô phỏng "thực tế" = lý thuyết − sụt áp thân van (0.8 V/van)
 *    − vệt lõm chuyển mạch (commutation notch) + nhiễu đo deterministic.
 *  - Metrics đối chiếu được tính TRỰC TIẾP từ mảng số liệu như Simulink.
 *
 * Chạy: npm run generate:data
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "simulink_verified_dataset.json");

/* ------------------------------------------------------------------ */
/* Tham số mạch                                                        */
/* ------------------------------------------------------------------ */
const F_GRID = 50; // Hz
const U2 = 100; // V — điện áp hiệu dụng nửa thứ cấp 1 pha
const UM2 = Math.SQRT2 * U2; // 141.42 V
const UPH = 100; // V — điện áp hiệu dụng pha 3 pha
const UMPH = Math.SQRT2 * UPH;
const R_LOAD = 10; // Ω
const L_LOAD = 0.08; // H — điện cảm tải RL (80 mH)
const VT_ON = 0.8; // V sụt áp thân van khi dẫn
const STEP_DEG = 1;
const THETA_MAX = 720;

const DEG = Math.PI / 180;
const sinD = (d) => Math.sin(d * DEG);
const cosD = (d) => Math.cos(d * DEG);
const round2 = (v) => Math.round(v * 100) / 100;

/** ua, ub, uc — nguồn 3 pha (phía thứ cấp, biên độ pha UMPH) */
const uaOf = (th) => UMPH * sinD(th);
const ubOf = (th) => UMPH * sinD(th - 120);
const ucOf = (th) => UMPH * sinD(th - 240);

/** Nhiễu pseudo-random deterministic (mulberry32) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const thetaGrid = [];
for (let t = 0; t <= THETA_MAX; t += STEP_DEG) thetaGrid.push(t);

/* ------------------------------------------------------------------ */
/* Tiện ích dạng sóng chung                                            */
/* ------------------------------------------------------------------ */

/**
 * Áp dụng "hiệu ứng Simulink" lên dạng sóng lý thuyết:
 *  - sụt áp VT_ON × số van dẫn
 *  - vệt lõm chuyển mạch tại mỗi góc chuyển mạch (switchingEvents)
 *  - nhiễu trắng nhỏ
 */
function makeSimWaveforms({
  circuitId,
  alphaDeg,
  udTheory,
  uVan1Theory,
  iVan1Theory,
  gatePulses,
  conductingCount, // (thetaDeg) => số van đang dẫn (mạch lực)
  switchingAngles, // mảng góc chuyển mạch để tạo notch
  loadType,
  threePhase,
}) {
  const rnd = mulberry32(hashStr(`${circuitId}|${alphaDeg}|${loadType}`));
  const n = thetaGrid.length;
  const udSim = new Array(n);
  const uVan1Sim = new Array(n);
  const idSim = new Array(n);

  const UdRef = udTheory.reduce((a, b) => a + b, 0) / n;
  const IdRef = Math.max(UdRef, 0) / R_LOAD; // trạng thái xác lập: Id = Ud/R
  const rippleOrder = threePhase ? 6 : 2; // gợn sóng: 6×ω (3P cầu) hoặc 2×ω (1P)

  const notchAt = (th) => {
    let dip = 0;
    for (const sa of switchingAngles) {
      let d = Math.abs(th - sa);
      d = Math.min(d, Math.abs(d - 360));
      dip += 4.5 * Math.exp(-(d * d) / (2 * 1.1 * 1.1)); // vệt lõm ~4.5 V, bề rộng ~2°
    }
    return dip;
  };

  for (let i = 0; i < n; i++) {
    const th = thetaGrid[i];
    const phNorm = ((th % 360) + 360) % 360;
    const nc = conductingCount(phNorm);
    const noise = (rnd() - 0.5) * 0.5; // ±0.25 V
    udSim[i] = udTheory[i] - VT_ON * nc - notchAt(th % 720) + noise;

    const vanOn = Math.abs(iVan1Theory[i]) > 1e-6;
    uVan1Sim[i] = vanOn ? -VT_ON + (rnd() - 0.5) * 0.06 : uVan1Theory[i] + (rnd() - 0.5) * 0.3;

    if (loadType === "R") {
      idSim[i] = Math.max(udSim[i], 0) / R_LOAD;
    } else {
      // L đủ lớn: dòng gần phẳng, gợn nhỏ theo bậc gợn mạch + nhiễu
      idSim[i] =
        IdRef *
        (1 +
          (IdRef > 0.5 ? 0.02 * sinD(th * rippleOrder) : 0) +
          (rnd() - 0.5) * 0.012);
    }
  }
  return { udSim, uVan1Sim, idSim };
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / a.length);

/** Góc chuyển mạch mặc định nếu caller không liệt kê */
function collectSwitchAngles(events) {
  return events.map((e) => e.theta);
}

/* ================================================================== */
/* Các họ xây dựng dạng sóng lý thuyết                                 */
/* ================================================================== */

/** Trả về { ud, uVan1, iVan1, gate, conductingCount, events } cho tải R hoặc RL */
function buildTap1P({ alphaDeg, controlled, loadType }) {
  const a = alphaDeg;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];

  const period = (fn) => {
    for (let i = 0; i < n; i++) {
      const th = thetaGrid[i];
      const ph = ((th % 360) + 360) % 360;
      ud[i] = fn(ph);
    }
  };

  if (!controlled) {
    // Diode: D1 dẫn [0,180], D2 dẫn [180,360] — ud = Um2|sin|
    period((ph) => UM2 * Math.abs(sinD(ph)));
    for (let i = 0; i < n; i++) {
      const ph = ((thetaGrid[i] % 360) + 360) % 360;
      uVan1[i] = UM2 * sinD(ph) - ud[i]; // D1: 0 khi dẫn; 2·u21 khi D2 dẫn
      iVan1[i] = ph < 180 ? ud[i] : 0;
    }
    events.push(
      {
        theta: 0,
        title: "D1 bắt đầu dẫn",
        description:
          "u21 sang phân cực thuận, D1 mở thông tự nhiên. Dòng tải chuyển qua D1, u22 đảo dấu và đặt lên D1 một điện áp ngược.",
        activeValves: ["D1"],
        circuitState: "D1 dẫn · D2 phân cực ngược · ud = u21",
      },
      {
        theta: 90,
        title: "Cực đại điện áp chỉnh lưu",
        description:
          "ud chạm đỉnh Um2 = √2·U2. Với tải R, dòng tải đạt cực đại cùng pha; với tải RL, dòng tiếp tục tích tụ nhờ năng lượng từ trường cuộn cảm.",
        activeValves: ["D1"],
        circuitState: "D1 dẫn · đỉnh sóng ud",
      },
      {
        theta: 180,
        title: "Chuyển mạch tự nhiên D1 → D2",
        description:
          "u21 đổi dấu: D1 bị phân cực ngược và ngưng dẫn tức thời, D2 mở thông. Điểm này là giao hoán tự nhiên của sơ đồ tia hai nửa.",
        activeValves: ["D2"],
        circuitState: "D2 dẫn · D1 phân cực ngược (−2Um2)",
      },
      {
        theta: 270,
        title: "Đỉnh nửa chu kỳ âm của nguồn",
        description:
          "u22 đạt cực đại thuận. Điện áp ngược trên D1 đạt giá trị lớn nhất U_ng,max = 2√2·U2 — thông số chọn van quan trọng nhất của sơ đồ tia.",
        activeValves: ["D2"],
        circuitState: "D2 dẫn · uD1 = −2Um2",
      },
      {
        theta: 360,
        title: "Chu kỳ lặp lại",
        description:
          "Quá trình lặp giống chu kỳ đầu: D1 lấy lại vai trò dẫn điện. Dạng sóng ud có tần số gợn 2×f_lưới (100 Hz).",
        activeValves: ["D1"],
        circuitState: "Lặp chu kỳ · D1 dẫn",
      }
    );
    return {
      ud,
      uVan1,
      iVan1,
      gate,
      events,
      conductingCount: (ph) => 1,
      switchingAngles: [0, 180, 360, 540],
      ungMaxTheory: 2 * UM2,
    };
  }

  // Thyristor
  const rlContinuous = loadType === "RL";
  /** khoảng [s,e) có wrap qua 360 */
  const inWin = (x, s, e) =>
    e <= 360 ? x >= s && x < e : x >= s || x < e - 360;

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const u21 = UM2 * sinD(ph);

    // V1: R dẫn [a,180) — RL liên tục dẫn [a,180+a)
    const v1on = rlContinuous ? inWin(ph, a, 180 + a) : ph >= a && ph < 180;
    // V2: phần còn lại của bán chu kỳ âm sau khi được kích tại 180+a
    const v2on = rlContinuous
      ? inWin(ph, 180 + a, 360 + a)
      : ph >= 180 + a && ph < 360;

    ud[i] = v1on ? u21 : v2on ? -u21 : 0;
    uVan1[i] = u21 - ud[i]; // 0 khi V1 dẫn; u21 khi khóa thuận; 2·u21 khi V2 dẫn

    // xung kích bề rộng 10° ở cả hai nửa chu kỳ
    const gp = inWin(ph, a, a + 10) || inWin(ph, 180 + a, 190 + a);
    gate[i] = gp ? 1 : 0;
  }

  // iVan1 cho RL: tỉ lệ với dòng tải hằng số — chuẩn hóa về Id
  if (rlContinuous) {
    const UdTh = (2 * UM2 * cosD(a)) / Math.PI;
    const IdRef = UdTh / R_LOAD;
    for (let i = 0; i < n; i++) {
      const ph = ((thetaGrid[i] % 360) + 360) % 360;
      iVan1[i] = ph >= a && ph < 180 + a ? IdRef : 0;
    }
  }

  events.push(
    {
      theta: a,
      title: `Kích V1 tại α = ${a}°`,
      description: rlContinuous
        ? "Xung gate đưa tới V1: dòng tải (đang tuần hoàn qua V2) chuyển sang V1. Với tải RL dòng liên tục nên chuyển mạch xảy ra đúng lúc có xung kích."
        : "Xung gate đưa tới V1 khi u21 đang phân cực thuận: V1 mở thông, dòng tải bắt đầu xây dựng từ 0 (dòng gián đoạn do tải thuần trở).",
      activeValves: ["V1"],
      circuitState: `V1 dẫn · V2 ${rlContinuous ? "vừa giao dòng" : "phân cực thuận chờ xung"}`,
    },
    {
      theta: 180,
      title: "Điểm giao hoán tự nhiên (θ = 180°)",
      description: rlContinuous
        ? "u21 đi qua 0 nhưng V1 vẫn dẫn nhờ năng lượng cuộn cảm L duy trì dòng — ud bắt đầu đi vào vùng âm, mạch trả năng lượng về nguồn."
        : "u21 về 0: dòng tải R giảm về 0, V1 tự ngắt. Từ đây đến 180°+α toàn mạch ngừng dẫn (ud = 0) vì chưa có xung kích.",
      activeValves: rlContinuous ? ["V1"] : [],
      circuitState: rlContinuous ? "V1 còn dẫn (dòng cảm)" : "Ngừng dẫn · chờ xung V2",
    },
    {
      theta: 180 + a,
      title: `Kích V2 tại 180° + α`,
      description: rlContinuous
        ? "V2 nhận xung kích: dòng tải chuyển từ V1 sang V2, ud = u22. Chu trình lặp đối xứng nửa âm."
        : "V2 mở thông trong nửa chu kỳ âm của u22: dòng xây dựng lại từ 0 rồi tắt khi u22 về 0 tại 360°.",
      activeValves: ["V2"],
      circuitState: "V2 dẫn · V1 chịu phân cực ngược",
    },
    {
      theta: 270,
      title: "U_ng,max trên van bị khóa",
      description:
        "Trong lúc V2 dẫn, V1 chịu trọn hiệu hai nửa dây quấn: u_V1 = u21 − u22, cực đại 2√2·U2 tại góc này. Đây là căn cứ chọn cấp điện áp van.",
      activeValves: ["V2"],
      circuitState: "V2 dẫn · u_V1 = −2√2·U2",
    },
    {
      theta: 360 + a,
      title: "Lặp chu kỳ — kích lại V1",
      description: "Hệ điều khiển phát lại xung cho V1, quá trình lặp đều mỗi 360°. Chu kỳ gợn sóng ud là 180° (2×f_lưới).",
      activeValves: ["V1"],
      circuitState: "Chu kỳ lặp · V1 dẫn",
    }
  );
  if (!rlContinuous && a > 0) {
    events.splice(1, 0, {
      theta: Math.min(180, a + 10),
      title: "Khoảng chết dòng (tải R)",
      description:
        "Sau khi u21 về 0 (và trước khi V2 được kích), không van nào dẫn: ud = 0, id = 0. Đây là chế độ dòng gián đoạn đặc trưng của tải thuần trở khi α > 0.",
      activeValves: [],
      circuitState: "Toàn mạch khóa · ud = 0",
    });
  }

  const countFn = rlContinuous
    ? (ph) => 1
    : (ph) => ((ph >= a && ph < 180) || (ph >= 180 + a && ph < 360) ? 1 : 0);

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events,
    conductingCount: countFn,
    switchingAngles: [a, 180 + a, 360 + a, 540 + a],
    ungMaxTheory: 2 * UM2,
  };
}

/** Cầu 1 pha: diode / thyristor đối xứng / bán điều khiển */
function buildBridge1P({ mode, alphaDeg, loadType }) {
  // mode: 'diode' | 'thyristor' | 'semi'
  const a = alphaDeg;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const rl = loadType === "RL";

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const u2 = UM2 * sinD(ph);

    let v1on = false;
    if (mode === "diode") {
      v1on = ph < 180; // (D1,D3)
    } else if (mode === "thyristor") {
      // RL liên tục: cặp sau giữ dòng đủ 180°; tải R: van ngừng dòng khi u2 đổi dấu
      v1on = rl ? ph >= a && ph < 180 + a : ph >= a && ph < 180;
    } else {
      v1on = ph >= a && ph < 180 + a; // V1 dẫn dài hơn: [a, 180+a] nhờ tựdoan
    }

    let udVal;
    if (mode === "diode") {
      udVal = Math.abs(u2);
    } else if (mode === "thyristor") {
      // RL liên tục: cặp sau giữ dòng cả đoạn wrap [0,a); tải R có khoảng chết
      if (v1on) udVal = u2;
      else if (ph >= 180 + a) udVal = -u2;
      else if (rl && ph < a) udVal = -u2;
      else udVal = 0;
    } else {
      // semi: [a,180] u2 ; [180,180+a] freewheel = 0 ; [180+a,360] −u2 ; [360,360+a] fw 0
      if (ph >= a && ph < 180) udVal = u2;
      else if (ph >= 180 && ph < 180 + a) udVal = 0;
      else if (ph >= 180 + a && ph < 360) udVal = -u2;
      else udVal = 0;
    }
    ud[i] = udVal;

    // Van 1 (D1 / V1 — chân A phía trên):
    if (mode === "diode") {
      uVan1[i] = v1on ? 0 : u2; // khóa: thấy ±u2, tối thiểu −Um2
      iVan1[i] = v1on ? udVal / R_LOAD : 0;
    } else if (mode === "thyristor") {
      uVan1[i] = v1on ? 0 : u2;
      if (rl) iVan1[i] = v1on ? 1 : 0; // chuẩn hóa dưới
      else iVan1[i] = v1on ? udVal / R_LOAD : 0;
      const gp = ph >= a && ph < a + 10;
      const gp2 = ph >= 180 + a && ph < 190 + a;
      gate[i] = gp || gp2 ? 1 : 0;
    } else {
      // V1 dẫn [a, 180+a] gồm cả đoạn freewheel với D4
      uVan1[i] = v1on ? 0 : u2;
      iVan1[i] = v1on ? 1 : 0;
      gate[i] = ph >= a && ph < a + 10 ? 1 : 0;
    }
  }

  // chuẩn hóa iVan1 = Id cho RL (thyristor & semi)
  if (rl && mode !== "diode") {
    let UdTh;
    if (mode === "thyristor") UdTh = (2 * UM2 * cosD(a)) / Math.PI;
    else UdTh = (UM2 * (1 + cosD(a))) / Math.PI;
    const IdRef = UdTh / R_LOAD;
    for (let i = 0; i < n; i++) {
      const ph = ((thetaGrid[i] % 360) + 360) % 360;
      const v1on = ph >= a && ph < 180 + a;
      iVan1[i] = v1on ? IdRef : 0;
    }
  }

  const nameV1 = mode === "diode" ? "D1" : "V1";
  const namePair = mode === "diode" ? "D1, D2" : mode === "thyristor" ? "V1, V2" : "V1, D2";

  events.push(
    {
      theta: mode === "diode" ? 0 : a,
      title: mode === "diode" ? "(D1, D2) dẫn tự nhiên" : `Kích cặp (V1, V2) tại α = ${a}°`,
      description:
        mode === "diode"
          ? "Nửa chu kỳ dương: D1 và D2 mở thông, dòng đi A → D1 → tải → D2 → B. Hai van khóa còn lại chia nhau chịu u2."
          : "Xung kích đồng thời lên V1 và V2: dòng tải chuyển sang nhánh chéo mới, ud = u_AB = u2. Cầu đối xứng cho phép ud âm nhờ van giữ dòng.",
      activeValves: mode === "diode" ? ["D1", "D2"] : mode === "thyristor" ? ["V1", "V2"] : ["V1", "D2"],
      circuitState: `${namePair} dẫn · ud = u2`,
    },
    {
      theta: 90,
      title: "Đỉnh ud nửa dương",
      description: "ud = Um2 = √2·U2. So với sơ đồ tia, mỗi van ở đây chỉ chịu U_ng,max = √2·U2 — bằng một nửa, đó là ưu điểm nổi bật của sơ đồ cầu.",
      activeValves: mode === "diode" ? ["D1", "D2"] : ["V1", "V2"],
      circuitState: "Đỉnh sóng · U_ng,max = √2·U2",
    }
  );

  if (mode === "semi") {
    events.push({
      theta: 180,
      title: "Freewheeling tự nhiên (V1 + D4)",
      description:
        "u2 đổi dấu: D2 khóa, D4 mở thông. Dòng tải tuần hoàn trong vòng kín V1 → tải → D4 (bypass nguồn), ud ≈ 0. Cuộn cảm xả năng lượng thay vì trả về nguồn — bản chất của cầu bán điều khiển.",
      activeValves: ["V1", "D4"],
      circuitState: "Freewheeling · ud = 0 · L xả năng lượng",
    });
  }

  events.push(
    {
      theta: mode === "diode" ? 180 : 180 + a,
      title:
        mode === "thyristor"
          ? "Kích cặp (V3, V4)"
          : mode === "diode"
            ? "Chuyển mạch sang (D3, D4)"
            : `Kích V3 tại 180° + α`,
      description:
        mode === "thyristor"
          ? "Cặp van đối diện nhận xung: dòng chuyển từ (V1,V2) sang (V3,V4), ud = −u2 vẫn dương nhờ chiều dòng qua tải không đổi."
          : mode === "diode"
            ? "Nửa chu kỳ âm: D3 và D4 dẫn, dòng tải vẫn cùng chiều qua tải. Chuyển mạch tự nhiên tại điểm không của u2."
            : "V3 mở thông nối pha B lên rail+: dòng đi B → V3 → tải → D4 → A, ud = −u2 = +|u2|. Dòng thứ cấp MBA đổi dấu (dạng vuông đối xứng với tải RL).",
      activeValves: mode === "diode" ? ["D3", "D4"] : mode === "thyristor" ? ["V3", "V4"] : ["V3", "D4"],
      circuitState:
        mode === "thyristor"
          ? "(V3, V4) dẫn · ud = −u2 > 0"
          : "(van nửa âm) dẫn · ud = |u2|",
    },
    {
      theta: mode === "diode" ? 270 : 270,
      title: "Van khóa chịu điện áp ngược cực đại",
      description:
        "Van 1 đang khóa thấy u_V1 = u2 với cực trị −√2·U2. Khác sơ đồ tia (2√2·U2), cầu chỉ yêu cầu van chịu một nửa — đánh đổi bằng gấp đôi số van.",
      activeValves: mode === "diode" ? ["D3", "D4"] : mode === "thyristor" ? ["V3", "V4"] : ["V3", "D4"],
      circuitState: "u_D1 = −√2·U2 (ngược)",
    },
    {
      theta: 360 + (mode === "diode" ? 0 : a),
      title: "Lặp chu kỳ",
      description: "Chu trình lặp mỗi 360°; tần số gợn ud = 2×f_lưới = 100 Hz.",
      activeValves: mode === "diode" ? ["D1", "D2"] : ["V1", "V2"],
      circuitState: "Lặp chu kỳ",
    }
  );

  const condCount =
    mode === "semi"
      ? (ph) =>
          (ph >= a && ph < 180) || (ph >= 180 + a && ph < 360)
            ? 2
            : ph >= 180 && ph < 180 + a
              ? 2
              : 2
      : () => 2;

  const switchAngles =
    mode === "diode"
      ? [0, 180, 360, 540]
      : mode === "thyristor"
        ? [a, 180 + a, 360 + a, 540 + a]
        : [a, 180, 180 + a, 360, 360 + a, 540];

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events,
    conductingCount: condCount,
    switchingAngles: switchAngles,
    ungMaxTheory: UM2,
  };
}

/** 3 pha tia (M3): diode & thyristor */
function buildTap3P({ alphaDeg, controlled, loadType }) {
  const a = alphaDeg;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const rl = loadType === "RL";

  // Điểm kích tự nhiên của VAN PHASE A là 30° (cuối đoạn của phase C)
  // Thứ tự dẫn: C → A (30°) → B (150°) → C (270°)
  const natStart = { a: 30, b: 150, c: 270 }; // điểm van tương ứng bắt đầu "lượt" tự nhiên

  const phases = [
    { key: "a", label: "D1", u: uaOf },
    { key: "b", label: "D2", u: ubOf },
    { key: "c", label: "D3", u: ucOf },
  ];
  if (controlled) {
    phases.forEach((p, idx) => (p.label = `V${idx + 1}`));
  }

  /** Xác định van đang dẫn tại góc pha ph (0..360) */
  function conductingValve(ph) {
    if (!controlled) {
      // argmax ba pha
      const arr = [uaOf(ph), ubOf(ph), ucOf(ph)];
      let k = 0;
      for (let j = 1; j < 3; j++) if (arr[j] > arr[k]) k = j;
      return phases[k];
    }
    // Thyristor: van bắt đầu tại natStart+α, dẫn trong "span" —
    // RL luôn đủ 120°; tải R kết thúc sớm khi pha về 0 (span = 150° − α)
    const span = rl ? 120 : Math.min(120, 150 - a);
    for (let k = 0; k < 3; k++) {
      const ns = natStart[phases[k].key];
      const start = ns + a;
      const d = (((ph - start) % 360) + 360) % 360;
      if (d < span) return phases[k];
    }
    return null;
  }

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const v = conductingValve(ph);
    if (v) {
      ud[i] = v.u(ph);
      uVan1[i] = uaOf(ph) - ud[i] + (phases[0] === v ? 0 : 0);
      uVan1[i] = v.key === "a" ? 0 : uaOf(ph) - ud[i];
      iVan1[i] = v.key === "a" ? 1 : 0;
    } else {
      ud[i] = 0;
      uVan1[i] = uaOf(ph);
      iVan1[i] = 0;
    }
    if (controlled) {
      // xung kích cho V1 tại 30+α (bề rộng 10°)
      const f1 = ((30 + a) % 360 + 360) % 360;
      gate[i] = ph >= f1 && ph < f1 + 10 ? 1 : 0;
    }
  }

  // chuẩn hóa iVan1 theo Id thực tế
  const UdApprox = mean(ud);
  const IdRef = Math.max(UdApprox, 0.001) / R_LOAD;
  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const v = conductingValve(ph);
    iVan1[i] = v && v.key === "a" ? IdRef : 0;
  }

  // Events
  const lbl = (k) => phases.find((p) => p.key === k).label;
  const segTitle = (k, th) => ({
    theta: th,
    title: `${lbl(k)} dẫn (${controlled ? "sau khi kích" : "chuyển mạch tự nhiên"})`,
    description: controlled
      ? `Tại θ = ${th}° (điểm tự nhiên + α), xung kích đưa tới ${lbl(k)}: dòng tải chuyển từ van trước sang ${lbl(k)}, ud bám theo điện áp pha ${k.toUpperCase()}.`
      : `Điện áp pha ${k.toUpperCase()} vượt các pha còn lại: ${lbl(k)} mở thông tự nhiên, ud = u_${k}.`,
    activeValves: [lbl(k)],
    circuitState: `${lbl(k)} dẫn · ud = u_${k}`,
  });
  events.push(segTitle("c", 330), segTitle("a", 30 + a), segTitle("b", 150 + a), segTitle("c", 270 + a));

  if (controlled && a > 30 && !rl) {
    events.splice(2, 0, {
      theta: 180,
      title: "Khoảng chết dòng (α > 30°, tải R)",
      description:
        "Với α vượt quá 30°, van kế tiếp chưa được kích trong khi pha hiện tại đã hết bán chu kỳ dương: ud rơi về 0 tạo bậc thang gián đoạn — đặc trưng của chế độ α > 30°.",
      activeValves: [],
      circuitState: "Không van dẫn · ud = 0",
    });
  }
  events.push({
    theta: 90,
    title: "Gợn sóng 3 nửa chu kỳ",
    description:
      "ud gồm các chóp lặp mỗi 120°; độ nhấp nhô tương đối = 1 − cos30° ≈ 13,4%. Van đang khóa chịu U_ng,max = √6·U_ph (điện áp dây cực đại).",
    activeValves: [lbl("a")],
    circuitState: "Đỉnh giữa đoạn dẫn",
  });

  const condCnt = (ph) => (conductingValve(((ph % 360) + 360) % 360) ? 1 : 0);

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events: events.sort((x, y) => x.theta - y.theta).slice(0, 8),
    conductingCount: condCnt,
    switchingAngles: controlled
      ? [30 + a, 150 + a, 270 + a, 390 + a, 510 + a, 630 + a]
      : [30, 150, 270, 390, 510, 630],
    ungMaxTheory: Math.sqrt(6) * UPH,
  };
}

/** 3 pha cầu: diode / thyristor đối xứng / sai thứ tự / bán điều khiển */
function buildBridge3P({ mode, alphaDeg, loadType }) {
  // mode: 'diode' | 'thyristor' | 'misfire' | 'semi'
  const a = alphaDeg;
  const rl = loadType === "RL";
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];

  const TOP = { a: "V1", b: "V3", c: "V5" };
  const BOT = { a: "V4", b: "V6", c: "V2" };
  const phaseOfTop = { V1: "a", V3: "b", V5: "c" };
  const phaseOfBot = { V4: "a", V6: "b", V2: "c" };

  // Thứ tự kích chuẩn: V1@30, V2@90, V3@150, V4@210, V5@270, V6@330 (+α)
  const fireOrder = ["V1", "V2", "V3", "V4", "V5", "V6"];
  const fireTime = {};
  fireOrder.forEach((v, idx) => (fireTime[v] = 30 + 60 * idx));
  let effectiveOrder = [...fireOrder];
  if (mode === "misfire") {
    // Hoán vị sai: V5 ↔ V6 — hệ xung đấu nhầm hai ngõ ra
    effectiveOrder = ["V1", "V2", "V3", "V4", "V6", "V5"];
  }

  function pairAt(ph) {
    // trả về {top:'a'|'b'|'c'|null, bot:..., valid:boolean}
    if (mode === "diode") {
      const arr = [
        ["a", uaOf(ph)],
        ["b", ubOf(ph)],
        ["c", ucOf(ph)],
      ];
      let top = arr[0],
        bot = arr[0];
      for (const p of arr) {
        if (p[1] > top[1]) top = p;
        if (p[1] < bot[1]) bot = p;
      }
      return { top: top[0], bot: bot[0], valid: true };
    }
    if (mode === "semi") {
      // Rail trên: SCR theo thứ tự kích lệch α; rail dưới: diode tự nhiên (argmin)
      const arr = [
        ["a", uaOf(ph)],
        ["b", ubOf(ph)],
        ["c", ucOf(ph)],
      ];
      let bot = arr[0];
      for (const p of arr) if (p[1] < bot[1]) bot = p;
      // SCR gần nhất đã kích: V1@30+a, V3@150+a, V5@270+a
      const scrTimes = [
        { ph: "a", t: 30 + a },
        { ph: "b", t: 150 + a },
        { ph: "c", t: 270 + a },
      ];
      let top = scrTimes[0];
      let bestDelta = Infinity;
      for (const s of scrTimes) {
        let d = ((ph - s.t) % 360 + 360) % 360;
        if (d < bestDelta) {
          bestDelta = d;
          top = s;
        }
      }
      const udRaw = top.ph !== bot.ph ? 1 : 0;
      return { top: top.ph, bot: bot.ph, valid: udRaw === 1, freewheel: false };
    }
    // thyristor & misfire: máy trạng thái theo thứ tự kích
    // xác định lần kích gần nhất trước ph
    let lastIdx = -1;
    for (let k = 0; k < 6; k++) {
      const ft = fireTime[effectiveOrder[k]] + a;
      let d = ((ph - ft) % 360 + 360) % 360;
      if (d < 360 && lastIdx === -1) {
        lastIdx = k;
      }
    }
    // tìm k sao cho ft <= ph < ft_next
    let cur = null;
    for (let k = 0; k < 6; k++) {
      const ft = (((fireTime[effectiveOrder[k]] + a) % 360) + 360) % 360;
      const nt = (((fireTime[effectiveOrder[(k + 1) % 6]] + a) % 360) + 360) % 360;
      const inWin = ft <= nt ? ph >= ft && ph < nt : ph >= ft || ph < nt;
      if (inWin) {
        cur = k;
        break;
      }
    }
    if (cur === null) return { top: null, bot: null, valid: false };
    const curV = effectiveOrder[cur];
    const prevV = effectiveOrder[(cur - 1 + 6) % 6];
    const topPh = phaseOfTop[curV] ? curV : phaseOfTop[prevV] ? prevV : null;
    const botV = phaseOfBot[curV] ? curV : phaseOfBot[prevV] ? prevV : null;
    if (!topPh || !botV) {
      return { top: null, bot: null, valid: false }; // hai van cùng rail → freewheel ud=0
    }
    return {
      top: phaseOfTop[topPh],
      bot: phaseOfBot[botV],
      valid: true,
      firedValve: curV,
      pair: [prevV, curV],
    };
  }

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const st = pairAt(ph);
    let udVal;
    if (st.valid) {
      const uTop = st.top === "a" ? uaOf(ph) : st.top === "b" ? ubOf(ph) : ucOf(ph);
      const uBot = st.bot === "a" ? uaOf(ph) : st.bot === "b" ? ubOf(ph) : ucOf(ph);
      udVal = uTop - uBot;
      // Bán điều khiển có diode tự do: ud không thể âm
      if (mode === "semi" && udVal < 0) udVal = 0;
      // Tải R: dòng đứt khi điện áp dây đảo dấu — ud không thể âm
      if (!rl && mode !== "semi" && udVal < 0) udVal = 0;
      ud[i] = udVal;
      // Van 1 (rail trên, pha A): cathode nối rail+ → u_V1 = ua − u(pha rail trên)
      uVan1[i] = st.top === "a" ? 0 : uaOf(ph) - uTop;
      iVan1[i] = 1;
    } else {
      ud[i] = 0; // freewheel qua hai van cùng rail (misfire)
      uVan1[i] = uaOf(ph);
      iVan1[i] = 0;
    }
    if (mode !== "diode") {
      // xung kép cho V1: tại 30+α và lần kích kế tiếp 90+α
      const f1 = ((30 + a) % 360 + 360) % 360;
      const f2 = ((90 + a) % 360 + 360) % 360;
      gate[i] =
        (ph >= f1 && ph < f1 + 5) || (ph >= f2 && ph < f2 + 5) ? 1 : 0;
    }
  }

  // chuẩn hóa iVan1
  const UdApprox = Math.max(mean(ud), 0.001);
  const IdRef = UdApprox / R_LOAD;
  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const st = pairAt(ph);
    iVan1[i] = st.valid && st.top === "a" ? IdRef : 0;
  }

  const pairName = (tp, bp) =>
    `${TOP[tp]}${BOT[bp] ? "+" + BOT[bp] : ""}`.replace("V1+", "V1+");

  events.push({
    theta: 30 + a,
    title: `Kích cặp (${TOP.a}, ${BOT.c}) — kích kép đúng thứ tự pha`,
    description:
      mode === "misfire"
        ? "Hệ xung đã HOÁN VỊ hai ngõ ra V5/V6: tại các vị trí này mạch nhận sai van, tạo những khoảng hai van cùng rail dẫn → ud sập về 0, dạng sóng méo nặng."
        : `Xung kép đưa tới ${TOP.a} (rail trên, pha A) và giữ van trước đó (${BOT.c}) dẫn thêm 60°: dòng đi A → tải → C, ud = u_AC — đoạn cao nhất của envelop 6 xung.`,
    activeValves: [TOP.a, BOT.c],
    circuitState: `(${TOP.a}, ${BOT.c}) dẫn · ud = u_AC`,
  });

  for (let k = 1; k <= 5; k++) {
    const curV = fireOrder[k];
    const prevV = fireOrder[k - 1];
    const tp = phaseOfTop[curV] ?? phaseOfTop[prevV];
    const bp = phaseOfBot[curV] ?? phaseOfBot[prevV];
    const th = fireTime[curV] + a;
    const uName = `${tp.toUpperCase()}${bp.toUpperCase()}`;
    events.push({
      theta: th,
      title: `Kích ${curV} — chuyển sang cặp (${curV === phaseOfTop[curV] ? curV : prevV}, ${curV === phaseOfBot[curV] ? curV : prevV})`,
      description: `Tại θ = ${th}°, ${curV} nhận xung kép (xung riêng + xung duy trì của van trước): ud chuyển sang đoạn u_${uName}. Thứ tự kích V1→V2→…→V6 cách đều 60° bảo đảm dòng bên thứ cấp MBA liền mạch.`,
      activeValves: [curV === phaseOfTop[curV] ? curV : prevV, curV === phaseOfBot[curV] ? curV : prevV],
      circuitState: `ud = u_${uName}`,
    });
  }

  events.push({
    theta: 90,
    title: "Độ nhấp nhô 13,4%",
    description:
      "Envelop ud gồm 6 chóp mỗi chu kỳ (tần số gợn 6×f = 300 Hz); biên độ nhấp nhô ΔU/U_max = 1 − cos30° = 13,4%. Van khóa chịu tối đa U_ng,max = √6·U_ph.",
    activeValves: [TOP.b, BOT.c],
    circuitState: "Đỉnh giữa đoạn · gợn 300 Hz",
  });

  if (mode === "misfire") {
    events.push({
      theta: 270 + a,
      title: "MÉO DẠNG do sai thứ tự kích",
      description:
        "Vì V5/V6 nhận nhầm xung của nhau, tại vùng này hai van rail dưới cùng dẫn → tải được nối tắt qua chúng, ud = 0 trong 60° dù nguồn đang có điện áp. Công suất suy giảm, dòngMBA xuất hiện thành phần một chiều — hậu quả thực tế khi lắp dây hệ kích.",
      activeValves: ["V4", "V6"],
      circuitState: "Hai van cùng rail dẫn · ud = 0 (méo dạng)",
    });
  }
  if (mode === "semi") {
    events.push({
      theta: 30 + a,
      title: "Rail trên điều khiển – rail dưới tự nhiên",
      description:
        "Chỉ 3 SCR phía trên nhận xung lệch α; 3 diode phía dưới giao hoán tự nhiên tại các điểm 90°+60k. ud là 'nửa điều khiển', công thức trung gian giữa cầu diode và cầu đối xứng.",
      activeValves: ["V1", "D2"],
      circuitState: "(V1, D2) dẫn · bán điều khiển",
    });
  }

  const condCnt = (ph) => {
    const st = pairAt((((ph % 360) + 360) % 360));
    return st.valid ? 2 : 2; // freewheel cũng qua 2 van
  };

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events: events.sort((x, y) => ((x.theta % 720) + 720) % 720 - ((y.theta % 720) + 720) % 720).slice(0, 9),
    conductingCount: condCnt,
    switchingAngles:
      mode === "diode"
        ? [30, 90, 150, 210, 270, 330, 390, 450, 510, 570, 630, 690]
        : fireOrder.map((v) => fireTime[v] + a).concat(fireOrder.map((v) => fireTime[v] + a + 360)),
    ungMaxTheory: Math.sqrt(6) * UPH,
  };
}

/* ================================================================== */
/* Danh mục 12 mạch                                                    */
/* ================================================================== */
const CATALOG = [
  {
    catalogId: "pha1_tap_diode",
    circuitName: "CL 1 pha tia 2 nửa — Diode",
    family: "1P",
    topology: "tap1p-diode",
    controlled: false,
    valveLabels: ["D1", "D2"],
    formulaTex: "U_d = \\frac{2\\sqrt{2}}{\\pi}U_2 \\approx 0{,}9\\,U_2",
    ud0FactorVsU2: 0.9,
    descriptionVN:
      "Sơ đồ tia hai nửa chu kỳ không điều khiển: 2 diode chung điểm tải, U_ng,max = 2√2·U2, công suất tính toán MBA lớn (S_ba ≈ 1,34–1,48·P_d).",
  },
  {
    catalogId: "pha1_tap_thyristor",
    circuitName: "CL 1 pha tia 2 nửa — Thyristor",
    family: "1P",
    topology: "tap1p-thyristor",
    controlled: true,
    valveLabels: ["V1", "V2"],
    formulaTex: "U_{d\\alpha} = U_{d0}\\frac{1+\\cos\\alpha}{2} \\; (R), \\quad U_{d0}\\cos\\alpha \\; (RL)",
    ud0FactorVsU2: 0.9,
    descriptionVN:
      "Phiên bản điều khiển hoàn toàn của sơ đồ tia: điều chỉnh α trong 0–180°, tải RL dòng liên tục với ud có vùng âm khi α > 0.",
  },
  {
    catalogId: "pha1_bridge_diode",
    circuitName: "CL 1 pha cầu — Diode",
    family: "1P",
    topology: "bridge1p-diode",
    controlled: false,
    valveLabels: ["D1", "D3", "D2", "D4"],
    formulaTex: "U_d = \\frac{2\\sqrt{2}}{\\pi}U_2, \\quad U_{ng,max}=\\sqrt{2}\\,U_2",
    ud0FactorVsU2: 0.9,
    descriptionVN:
      "Cầu diode 1 pha: 4 van, không cần điểm giữa dây quấn, U_ng,max chỉ bằng √2·U2 — sơ đồ phổ biến nhất cho bộ nguồn công suất vừa nhỏ.",
  },
  {
    catalogId: "pha1_bridge_thyristor",
    circuitName: "CL 1 pha cầu đối xứng — Thyristor",
    family: "1P",
    topology: "bridge1p-thyristor",
    controlled: true,
    valveLabels: ["V1", "V3", "V2", "V4"],
    formulaTex: "U_{d\\alpha} = \\frac{2\\sqrt{2}}{\\pi}U_2\\cos\\alpha",
    ud0FactorVsU2: 0.9,
    descriptionVN:
      "Cầu 4 SCR đối xứng: kích cặp chéo (V1,V2)/(V3,V4); với tải RL, ud có vùng âm — mạch làm việc ở biên giới chỉnh lưu – nghịch lưu phụ thuộc.",
  },
  {
    catalogId: "pha1_bridge_semicontrolled",
    circuitName: "CL 1 pha cầu bán điều khiển (2 SCR + 2 D)",
    family: "1P",
    topology: "bridge1p-semi",
    controlled: true,
    valveLabels: ["V1", "V3", "D2", "D4"],
    formulaTex: "U_{d\\alpha} = \\frac{\\sqrt{2}U_2}{\\pi}(1+\\cos\\alpha)",
    ud0FactorVsU2: 0.9,
    descriptionVN:
      "Rail trên dùng SCR, rail dưới dùng diode: tồn tại đoạn freewheeling ud = 0 qua (V + D) cùng nhánh, Ud không thể âm — an toàn hơn cho tải động cơ.",
  },
  {
    catalogId: "pha3_tap_diode",
    circuitName: "CL 3 pha tia — Diode (M3)",
    family: "3P",
    topology: "tap3p-diode",
    controlled: false,
    valveLabels: ["D1", "D2", "D3"],
    formulaTex: "U_d = \\frac{3\\sqrt{3}}{2\\pi}\\sqrt{2}\\,U_{ph} \\approx 1{,}17\\,U_{ph}",
    ud0FactorVsU2: 1.17,
    descriptionVN:
      "Sơ đồ tia 3 pha: 3 van chung cathode, mỗi van dẫn 120°, gợn sóng 13,4%, từ thông MBA một chiều (cần biến áp kiểu hình chữ Y mở).",
  },
  {
    catalogId: "pha3_tap_thyristor",
    circuitName: "CL 3 pha tia — Thyristor (M3-K)",
    family: "3P",
    topology: "tap3p-thyristor",
    controlled: true,
    valveLabels: ["V1", "V2", "V3"],
    formulaTex: "U_{d\\alpha}=U_{d0}\\cos\\alpha \\;(\\alpha\\le 30^\\circ)",
    ud0FactorVsU2: 1.17,
    descriptionVN:
      "Tia 3 pha điều khiển: ranh giới quan trọng α = 30° — vượt qua giá trị này với tải R, dạng sóng ud chuyển sang chế độ gián đoạn có bậc thang về 0.",
  },
  {
    catalogId: "pha3_bridge_diode",
    circuitName: "CL 3 pha cầu — Diode (L6)",
    family: "3P",
    topology: "bridge3p-diode",
    controlled: false,
    valveLabels: ["V1", "V3", "V5", "V4", "V6", "V2"],
    formulaTex: "U_d = \\frac{3\\sqrt{6}}{\\pi}U_{ph} \\approx 2{,}34\\,U_{ph}",
    ud0FactorVsU2: 2.34,
    descriptionVN:
      "Cầu 3 pha 6 van: 6 xung/chu kỳ, gợn 300 Hz độ nhấp nhô 13,4%, hệ số tận dụng MBA tốt nhất trong các sơ đồ không điều khiển.",
  },
  {
    catalogId: "pha3_bridge_thyristor",
    circuitName: "CL 3 pha cầu đối xứng — Thyristor (kích kép)",
    family: "3P",
    topology: "bridge3p-thyristor",
    controlled: true,
    valveLabels: ["V1", "V3", "V5", "V4", "V6", "V2"],
    formulaTex: "U_{d\\alpha} = U_{d0}\\cos\\alpha",
    ud0FactorVsU2: 2.34,
    descriptionVN:
      "Cầu 6 SCR với xung kép đúng thứ tự pha V1→V6 (cách 60°, xung rộng 60° hoặc phát kép): nền tảng của truyền động DC lớn và HVDC.",
  },
  {
    catalogId: "pha3_bridge_misfire",
    circuitName: "CL 3 pha cầu Thyristor — KÍCH SAI THỨ TỰ PHA",
    family: "3P",
    topology: "bridge3p-misfire",
    controlled: true,
    valveLabels: ["V1", "V3", "V5", "V4", "V6", "V2"],
    formulaTex: "\\text{Méo dạng: } u_d \\downarrow 0 \\text{ khi 2 van cùng rail dẫn}",
    ud0FactorVsU2: 2.0,
    descriptionVN:
      "Trường học lỗi thực tế: hoán vị nhầm xung V5↔V6 khiến hai van cùng rail dẫn đồng thời, ud bị nối tắt về 0 từng khoảng 60° — minh chứng cho tầm quan trọng của đúng thứ tự kích.",
  },
  {
    catalogId: "pha3_bridge_semicontrolled",
    circuitName: "CL 3 pha cầu bán điều khiển (3 SCR + 3 D)",
    family: "3P",
    topology: "bridge3p-semi",
    controlled: true,
    valveLabels: ["V1", "V3", "V5", "D4", "D6", "D2"],
    formulaTex: "U_{d\\alpha} \\approx U_{d0}\\frac{1+\\cos\\alpha}{2}",
    ud0FactorVsU2: 2.34,
    descriptionVN:
      "Rail trên SCR + rail dưới diode (kèm diode tự do): tiết kiệm van điều khiển, ud không âm, hệ số hài dòng lưới tốt hơn cầu đối xứng cùng α.",
  },

  /* ---------------- Chương 3: Điều áp xoay chiều (AC/AC) ---------------- */
  {
    catalogId: "ac1p_regulator",
    circuitName: "C3 · Điều áp xoay chiều 1 pha (2 SCR ngược song song)",
    family: "C3",
    topology: "ac1p-regulator",
    controlled: true,
    valveLabels: ["T1", "T2"],
    formulaTex: "I=\\frac{U_2}{R}\\sqrt{\\tfrac{1}{2\\pi}\\bigl(\\pi-\\alpha+\\tfrac{\\sin 2\\alpha}{2}\\bigr)}",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "Hai thyristor ngược song song cắt bớt phần đầu bán chu kỳ từ α: u_tải là các đoạn sin, biên độ hiệu dụng điều chỉnh được còn tần số bằng lưới. Tải RL: van dẫn thêm góc λ, α chỉ có ý nghĩa khi α > φ.",
  },
  {
    catalogId: "ac3p_regulator",
    circuitName: "C3 · Điều áp xoay chiều 3 pha (6 SCR, tải sao)",
    family: "C3",
    topology: "ac3p-regulator",
    controlled: true,
    valveLabels: ["V1", "V3", "V5", "V4", "V6", "V2"],
    formulaTex: "u_{ZA}:\\ \\tfrac{u_p-u_n}{2}\\ (2\\text{ van})\\quad u_{ph}\\ (3\\text{ van})",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "Sáu SCR trên ba nhánh tải sao: α ≥ 60° mỗi thời điểm tối đa 2 van dẫn, điện áp pha tải là nửa điện áp dây; α lớn dần xuất hiện khoảng gián đoạn — khởi động mềm, TCR.",
  },

  /* ---------------- Chương 4: DC-DC (Buck / Boost) ---------------------- */
  {
    catalogId: "dcdc_buck",
    circuitName: "C4 · Buck — bộ biến đổi giảm áp",
    family: "C4",
    topology: "dcdc-buck",
    controlled: true,
    valveLabels: ["V", "D0"],
    formulaTex: "U_t = \\frac{t_x}{T}E = D\\,E",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "IGBT V băm nguồn E thành xung u_t; D0 dẫn tiếp dòng khi V khóa; LC lọc → U_t = D·E ≤ E. Trục θ quy ước 360° = một chu kỳ cắt T; α đóng vai trò duty D.",
  },
  {
    catalogId: "dcdc_boost",
    circuitName: "C4 · Boost — bộ biến đổi tăng áp",
    family: "C4",
    topology: "dcdc-boost",
    controlled: true,
    valveLabels: ["V", "D"],
    formulaTex: "U_o = \\frac{E}{1-D}",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "V dẫn: L nạp năng lượng từ E; V khóa: L nhả năng lượng qua D vào C tải → U_o = E/(1−D) ≥ E. Trục θ quy ước 360° = một chu kỳ T; α đóng vai trò duty D.",
  },

  /* ---------------- Chương 5: Nghịch lưu nguồn áp ------------------------ */
  {
    catalogId: "inv1p_full",
    circuitName: "C5 · Nghịch lưu nguồn áp 1 pha (180°)",
    family: "C5",
    topology: "inv1p-full",
    controlled: true,
    valveLabels: ["Tr1", "Tr3", "D1", "D3", "Tr4", "Tr2", "D4", "D2"],
    formulaTex: "U_z(\\text{rms}) = E,\\quad U_{z1} = \\tfrac{4E}{\\pi\\sqrt2}",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "Bốn IGBT mở theo cặp (Tr1Tr2)/(Tr3Tr4) mỗi nửa chu kỳ → u_z vuông ±E. Tải RL: đầu nửa chu kỳ dòng hồi truyền qua diode ngược song song (D1D2/D3D4) trả năng lượng về nguồn.",
  },
  {
    catalogId: "inv3p_180",
    circuitName: "C5 · Nghịch lưu nguồn áp 3 pha (180°, 6 bước)",
    family: "C5",
    topology: "inv3p-180",
    controlled: true,
    valveLabels: ["Tr1", "Tr3", "Tr5", "Tr4", "Tr6", "Tr2"],
    formulaTex: "U_{AB}:\\ 0,\\pm E\\ \\to\\ U_{AB1} = \\tfrac{2\\sqrt3 E}{\\pi\\sqrt2}",
    ud0FactorVsU2: 1.0,
    descriptionVN:
      "Sáu IGBT dẫn 180°, lệch 60° → u_AB vuông 6 bước ±E; u_phaso bậc thang 6 bậc. Dòng RL trễ pha, hồi truyền qua diode ngược — sơ đồ lõi của biến tần công nghiệp.",
  },
];

/* ================================================================== */
/* Chương 3 — Điều áp xoay chiều 1 pha (2 SCR ngược song song)         */
/* ================================================================== */
function buildACReg1P({ alphaDeg, loadType }) {
  const a = alphaDeg;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const rl = loadType === "RL";
  const wTau = 2 * Math.PI * F_GRID * (L_LOAD / R_LOAD); // ωτ (độ)
  const phi = Math.atan(wTau * Math.PI / 180); // góc lệch pha φ (rad)

  // Nghiệm RL: i(θ) = (Um/Z)[sin(θ−φ) − sin(α−φ)e^{−(θ−α)/tanφ}] với θ tính từ điểm kích
  const Z = Math.hypot(R_LOAD, 2 * Math.PI * F_GRID * L_LOAD);
  const Um2 = Math.SQRT2 * U2;
  const currentAt = (degFromFire, fireDeg, sign) => {
    const th = (degFromFire * Math.PI) / 180;
    if (!rl) return (Um2 / R_LOAD) * Math.sin(th) * sign;
    const phiDeg = (phi * 180) / Math.PI;
    const tauDeg = wTau;
    const i =
      (Um2 / Z) *
      (Math.sin(th - phi) - Math.sin(((fireDeg - phiDeg) * Math.PI) / 180) * Math.exp(-degFromFire / tauDeg));
    return i * sign;
  };

  // Xác định khoảng dẫn mỗi bán chu kỳ: bắt đầu α (hoặc 180+α), kết thúc khi i về 0
  const conductionEnd = (fireDeg, sign) => {
    let prev = currentAt(0.5, fireDeg, sign);
    if (prev <= 0) return fireDeg + 0.5;
    for (let d = 1; d <= 360; d += 1) {
      const i = currentAt(d, fireDeg, sign);
      if (i <= 0) return fireDeg + d;
      prev = i;
    }
    return fireDeg + 360;
  };
  const end1 = conductionEnd(a, 1);
  const end2 = conductionEnd(180 + a, -1);

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const u2 = UM2 * sinD(ph);
    let cond = 0; // 0: không van; 1: T1; 2: T2
    if (ph >= a && ph < Math.min(end1, 360)) cond = 1;
    else if (ph >= 180 + a && ph < Math.min(end2, 360)) cond = 2;
    else if (rl && end1 >= 360 && ph < end1 - 360) cond = 1;
    else if (rl && end2 >= 360 && ph < end2 - 360) cond = 2;

    ud[i] = cond ? u2 : 0;
    uVan1[i] = cond === 1 ? 0 : u2; // T1 khóa thấy u2 (thuận chờ hoặc ngược qua T2)
    iVan1[i] = cond === 1 ? currentAt(ph - a, a, 1) : 0;
    gate[i] = (ph >= a && ph < a + 10) || (ph >= 180 + a && ph < 190 + a) ? 1 : 0;
  }

  events.push(
    {
      theta: a,
      title: `Kích T1 tại α = ${a}°`,
      description: rl
        ? `Xung tới T1: dòng tăng theo nghiệm quá độ i(θ) = (Um/Z)[sin(θ−φ) − sin(α−φ)e^{−θ/ωτ}], kéo dài góc dẫn λ = ${Math.round(Math.min(end1, 360 + a) - a)}° > 180° − α do năng lượng cảm.`
        : "T1 mở thông: u_tải = u2 ngay từ α, i = u2/R — đoạn sin bị cắt bỏ phần đầu bán chu kỳ.",
      activeValves: ["T1"],
      circuitState: "T1 dẫn · u_tải = u2",
    },
    {
      theta: 180,
      title: rl ? `T1 tắt tại ${Math.round(end1 % 360)}° (i = 0)` : "u2 đổi dấu — T1 tắt tự nhiên",
      description: rl
        ? "Dòng về 0 khi thành phần sin cân bằng phần mũ: van tự tắt, u_tải = 0 cho tới điểm kích kế tiếp — hiện tượng đặc trưng của điều áp AC tải RL."
        : "Điện áp nguồn đổi dấu, T1 tắt tự nhiên; hai van khóa, u_tải = 0 cho tới α nửa âm.",
      activeValves: [],
      circuitState: "Không van dẫn · u_tải = 0",
    },
    {
      theta: 180 + a,
      title: "Kích T2 — nửa chu kỳ âm",
      description: "T2 mở thông đối xứng T1: u_tải = u2 (âm), i âm. Hai xung G1/G2 lệch đúng 180°.",
      activeValves: ["T2"],
      circuitState: "T2 dẫn · u_tải = −|u2|",
    },
    {
      theta: 90,
      title: "Phạm vi điều chỉnh φ ≤ α ≤ 180°",
      description: rl
        ? `Với tải RL, φ = ${Math.round((phi * 180) / Math.PI)}°: α < φ dòng liên tục, u_tải mất khả năng điều chỉnh — vùng điều khiển hữu ích là α ∈ [φ, 180°].`
        : "α = 0 → u_tải = u2 (đủ áp); α → 180° → u_tải → 0. Điều chỉnh liên tục nhờ cắt góc mở.",
      activeValves: [],
      circuitState: "Ghi chú phạm vi điều chỉnh",
    }
  );

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events: events.sort((x, y) => x.theta - y.theta).slice(0, 8),
    switchingAngles: [a, 180 + a, 360 + a, 540 + a],
    ungMaxTheory: UM2,
  };
}

/* ================================================================== */
/* Chương 3 — Điều áp xoay chiều 3 pha (6 SCR, tải sao, R)             */
/* ================================================================== */
function buildACReg3P({ alphaDeg }) {
  const a = alphaDeg;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];

  const fireDeg = (v) => 30 + 60 * ((Number(v.slice(1)) + 5) % 6) + a; // V1@30, V2@90...
  const gateOn = (lbl, ph) => {
    const ft = ((fireDeg(lbl) % 360) + 360) % 360;
    return ((ph - ft + 360) % 360) <= 180; // van dẫn tối đa 180°
  };
  const TOP = { a: "V1", b: "V3", c: "V5" };
  const BOT = { a: "V4", b: "V6", c: "V2" };

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const ua = UM2 * sinD(ph);
    const ub = UM2 * sinD(ph - 120);
    const uc = UM2 * sinD(ph - 240);
    const U = { a: ua, b: ub, c: uc };

    const tops = Object.values(TOP).filter((l) => gateOn(l, ph));
    const bots = Object.values(BOT).filter((l) => gateOn(l, ph));
    // top = pha có u lớn nhất trong các van trên đã kích; bot = nhỏ nhất trong van dưới
    let tp = null;
    let bp = null;
    let best = -Infinity;
    for (const l of tops) {
      const k = { V1: "a", V3: "b", V5: "c" }[l];
      if (U[k] > best) {
        best = U[k];
        tp = k;
      }
    }
    best = Infinity;
    for (const l of bots) {
      const k = { V4: "a", V6: "b", V2: "c" }[l];
      if (U[k] < best) {
        best = U[k];
        bp = k;
      }
    }

    if (tp && bp && tp !== bp) {
      ud[i] = (U[tp] - U[bp]) / 2; // 2 van dẫn → nửa điện áp dây
    } else if (tp && bp && tp === bp) {
      ud[i] = U[tp];
    } else {
      ud[i] = 0; // gián đoạn
    }
    uVan1[i] = tp === "a" ? 0 : ua - ud[i];
    iVan1[i] = tp === "a" ? ud[i] / R_LOAD : 0;
    gate[i] = ((ph - ((fireDeg("V1") % 360) + 360) % 360 + 360) % 360) < 10 ? 1 : 0;
  }

  events.push(
    {
      theta: ((30 + a) % 360),
      title: `Kích V1 tại 30° + α = ${30 + a}°`,
      description:
        "Van đầu tiên nhận xung: cặp dẫn hình thành theo quy tắc 2 van (nửa điện áp dây chia lên pha tải) hoặc 3 van (điện áp pha đầy đủ) tùy khoảng góc.",
      activeValves: ["V1", "V6"],
      circuitState: "2 van dẫn · u_ZA = (u_a−u_b)/2",
    },
    {
      theta: (90 + a) % 360,
      title: "Chuyển V6 → V2 (chuyển mạch van dưới)",
      description:
        "Xung tới V2: pha C nối rail dưới; u_ZA chuyển sang (u_a−u_c)/2. Các khoảng dẫn xen kẽ 2 van — đặc trưng điều áp 3 pha α ≥ 60°.",
      activeValves: ["V1", "V2"],
      circuitState: "2 van · u_ZA = (u_a−u_c)/2",
    },
    {
      theta: 30,
      title: "Gián đoạn dòng khi α lớn",
      description:
        "Với α đủ lớn, có khoảng không cặp van nào thuận → u_ZA = 0. Phạm vi hữu ích α ∈ [60°, 150°]; ứng dụng soft-starter, TCR.",
      activeValves: [],
      circuitState: "Gián đoạn · u_ZA = 0",
    }
  );

  return {
    ud,
    uVan1,
    iVan1,
    gate,
    events: events.sort((x, y) => ((x.theta % 360) + 360) % 360 - ((y.theta % 360) + 360) % 360).slice(0, 6),
    switchingAngles: [30 + a, 90 + a, 150 + a, 210 + a, 270 + a, 330 + a],
    ungMaxTheory: Math.sqrt(6) * UM2,
  };
}

/* ================================================================== */
/* Chương 4 — Buck / Boost (trục 360° = 1 chu kỳ T, lặp 2 lần)          */
/* ================================================================== */
function buildBuck({ duty }) {
  const D = duty / 100;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const E = 100;
  const Ut = D * E;
  const L = 0.1;
  const R = R_LOAD;
  const Tdeg = 360;
  const ILmin = Ut / R - ((E - Ut) * D * (Tdeg / 360 / 50)) / (2 * L);
  const ripple = ((E - Ut) * D * 0.02) / L;
  const ILmid = Ut / R;

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % Tdeg) + Tdeg) % Tdeg;
    const on = ph < D * Tdeg;
    ud[i] = on ? E : 0; // u_t
    uVan1[i] = on ? 0 : E;
    const tdeg = on ? ph : ph - D * Tdeg;
    const slope = on ? (E - Ut) / (D * Tdeg) : -Ut / ((1 - D) * Tdeg);
    iVan1[i] = on ? Math.max(ILmid + slope * (tdeg - (D * Tdeg) / 2), 0) : 0;
    gate[i] = on ? 1 : 0;
  }
  void ILmin;
  void ripple;

  events.push(
    {
      theta: 0,
      title: `V dẫn — băm nguồn (D = ${duty}%)`,
      description: `IGBT V nối tải vào nguồn E: u_t = E, dòng L tăng tuyến tính với (E−U_t)/L. Diode D0 bị phân áp khóa.`,
      activeValves: ["V"],
      circuitState: "V dẫn · u_t = E",
    },
    {
      theta: D * 360,
      title: "V khóa — D0 dẫn tiếp dòng",
      description: "L tự cảm giữ dòng qua D0: u_t = 0, dòng L giảm tuyến tính U_t/L. Giá trị trung bình U_t = D·E.",
      activeValves: ["D0"],
      circuitState: "D0 dẫn · u_t = 0",
    },
    {
      theta: 180,
      title: `U_t = D·E = ${Math.round(Ut)} V`,
      description: "C lọc gợn → điện áp tải DC phẳng. Buck: U_t ≤ E; điều chỉnh bằng duty D (PWM tần số cao).",
      activeValves: [],
      circuitState: `U_t = ${Ut} V`,
    }
  );

  return { ud, uVan1, iVan1, gate, events: events.slice(0, 6), switchingAngles: [0, D * 360], ungMaxTheory: E };
}

function buildBoost({ duty }) {
  const D = duty / 100;
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const E = 100;
  const Uo = E / (1 - D);

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const on = ph < D * 360;
    ud[i] = on ? E : -((Uo - E) / Uo) * E; // u_L: +E khi ON, −(Uo−E) khi OFF
    uVan1[i] = on ? 0 : Uo;
    const tdeg = on ? ph : ph - D * 360;
    const slope = on ? E / (D * 360) : -(Uo - E) / ((1 - D) * 360);
    iVan1[i] = E / ((1 - D) * (1 - D) * R_LOAD) + slope * (tdeg - 180 / 2);
    gate[i] = on ? 1 : 0;
  }

  events.push(
    {
      theta: 0,
      title: `V dẫn — L nạp năng lượng (D = ${duty}%)`,
      description: `u_L = E, i_L tăng tuyến tính; D phân áp khóa, C nuôi tải. Thời gian này quyết định năng lượng tích trữ.`,
      activeValves: ["V"],
      circuitState: "V dẫn · u_L = E",
    },
    {
      theta: D * 360,
      title: "V khóa — L nhả năng lượng qua D",
      description: `u_L đảo dấu = E − U_o < 0; dòng L cộng với E qua D nạp C và nuôi tải → U_o = E/(1−D) = ${Math.round(Uo)} V.`,
      activeValves: ["D"],
      circuitState: `D dẫn · U_o = ${Math.round(Uo)} V`,
    },
    {
      theta: 180,
      title: "Cân bằng năng lượng L",
      description: "Xác lập: năng lượng nạp = nhả → U_o = E/(1−D). D càng gần 1, U_o càng lớn (giới hạn bởi tổn hao thực tế).",
      activeValves: [],
      circuitState: `U_o = ${Math.round(Uo)} V`,
    }
  );

  return { ud, uVan1, iVan1, gate, events: events.slice(0, 6), switchingAngles: [0, D * 360], ungMaxTheory: Uo };
}

/* ================================================================== */
/* Chương 5 — Nghịch lưu nguồn áp 1 pha (180°) & 3 pha (180°)          */
/* ================================================================== */
function buildInv1P({ loadType }) {
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const rl = loadType === "RL";
  const E = 100;
  const wTau = 2 * Math.PI * F_GRID * (L_LOAD / R_LOAD);
  const t0 = wTau * Math.LN2; // góc i = 0 (đầu nửa chu kỳ, diode dẫn)
  const R = R_LOAD;

  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const pos = ph < 180;
    ud[i] = pos ? E : -E; // u_z
    gate[i] = pos ? 1 : 0; // Tr1 (van 1) nửa dương
    let iZ;
    if (!rl) {
      iZ = pos ? E / R : -E / R;
    } else {
      const d = pos ? ph : ph - 180;
      const sign = pos ? 1 : -1;
      iZ = sign * ((E / R) * (1 - 2 * Math.exp(-d / wTau)));
    }
    // Van 1 nhánh trái-trên: Tr1 gate nửa dương; D1 dẫn khi i_z < 0 trong nửa dương
    const dOn = rl && pos && iZ < 0;
    iVan1[i] = pos ? (dOn ? -iZ : iZ) : 0; // dòng qua Tr1 (+) hoặc D1 (đảo dấu để hiển thị độ lớn)
    if (!pos && rl) iVan1[i] = 0;
    uVan1[i] = pos ? 0 : E; // Tr1/D1 dẫn → 0; nửa kia Tr1 thấy +E
    void dOn;
  }

  events.push(
    {
      theta: 0,
      title: "Tr1, Tr2 nhận xung — u_z = +E",
      description: rl
        ? "Cặp Tr1Tr2 mở; nhưng dòng tải RL chưa đảo kịp → D1,D2 dẫn ngược, trả năng lượng cảm về nguồn (u_z vẫn +E). i_z đi từ −I lên 0 rồi đảo qua Tr1Tr2."
        : "Cặp Tr1Tr2 mở: u_z = +E, i_z = E/R vuông cùng pha.",
      activeValves: rl ? ["D1", "D2"] : ["Tr1", "Tr2"],
      circuitState: rl ? "D1,D2 hồi truyền · u_z = +E" : "Tr1,Tr2 dẫn · u_z = +E",
    },
    {
      theta: Math.round(t0),
      title: "Dòng giao cho Tr1, Tr2 (i = 0)",
      description: "i_z đổi dấu: diode ngừng, dòng chuyển hẳn sang IGBT — khoảng hồi truyền kết thúc.",
      activeValves: ["Tr1", "Tr2"],
      circuitState: "Tr1,Tr2 dẫn dòng tải",
    },
    {
      theta: 180,
      title: "Tr3, Tr4 nhận xung — u_z = −E",
      description: "Cặp kia mở đối xứng: u_z = −E; RL → D3,D4 hồi truyền đầu nửa âm rồi dòng qua Tr3,Tr4.",
      activeValves: rl ? ["D3", "D4"] : ["Tr3", "Tr4"],
      circuitState: rl ? "D3,D4 hồi truyền · u_z = −E" : "Tr3,Tr4 dẫn · u_z = −E",
    }
  );

  return { ud, uVan1, iVan1, gate, events: events.slice(0, 6), switchingAngles: [0, 180, 360, 540], ungMaxTheory: E };
}

function buildInv3P({ loadType }) {
  const n = thetaGrid.length;
  const ud = new Array(n);
  const uVan1 = new Array(n);
  const iVan1 = new Array(n);
  const gate = new Array(n).fill(0);
  const events = [];
  const rl = loadType === "RL";
  const E = 100;
  const wTau = 2 * Math.PI * F_GRID * (L_LOAD / R_LOAD);

  // Tr1 [0,180) rail + pha A; Tr4 [180,360). u_A = ±E/2 so với điểm giữa
  for (let i = 0; i < n; i++) {
    const ph = ((thetaGrid[i] % 360) + 360) % 360;
    const uA = ph < 180 ? E / 2 : -E / 2;
    const uB = ph >= 60 && ph < 240 ? E / 2 : -E / 2; // Tr3 [60,240)
    const uC = ph >= 120 && ph < 300 ? E / 2 : -E / 2; // Tr5 [120,300)
    ud[i] = uA - uB; // u_AB
    uVan1[i] = uA > 0 ? 0 : E; // Tr1: dẫn → 0; khóa thấy E
    gate[i] = ph < 180 ? 1 : 0;
    // i_A: RL — mũ quá độ quanh ±E/(2R); R — vuông
    let iA;
    if (!rl) {
      iA = ph < 180 ? E / (2 * R_LOAD) : -E / (2 * R_LOAD);
    } else {
      const d = ph < 180 ? ph : ph - 180;
      const sign = ph < 180 ? 1 : -1;
      iA = sign * ((E / (2 * R_LOAD)) * (1 - 2 * Math.exp(-d / wTau)));
    }
    iVan1[i] = ph < 180 ? iA : 0;
  }

  events.push(
    {
      theta: 0,
      title: "Tr1, Tr6, Tr5 dẫn (180°)",
      description: "u_AB = E (Tr1–Tr6); u_BC, u_CA theo bảng 6 bước. Mỗi van dẫn 180°, lệch 60°.",
      activeValves: ["Tr1", "Tr6", "Tr5"],
      circuitState: "u_AB = E",
    },
    {
      theta: 60,
      title: "Chuyển Tr5 → Tr2: u_AB = E/2? — 6 bước",
      description: "Tr2 nhận xung thay Tr5 (rail dưới pha C → A? theo vòng 180°): u_AB = u_A − u_B = E/2 − (−E/2)… các bước bậc thang ±E, ±E/2, 0.",
      activeValves: ["Tr1", "Tr2", "Tr5"],
      circuitState: "u_AB = E/2",
    },
    {
      theta: 180,
      title: "Tr1 → Tr4: u_AB đảo dấu",
      description: rl ? "D4 hồi truyền đoạn đầu nửa âm (i_A trễ)." : "u_AB = −E đối xứng.",
      activeValves: ["Tr4", "Tr6", "Tr2"],
      circuitState: "u_AB = −E",
    }
  );

  return { ud, uVan1, iVan1, gate, events: events.slice(0, 6), switchingAngles: [0, 60, 120, 180, 240, 300], ungMaxTheory: E };
}

/* ================================================================== */
/* Lập kế hoạch entries                                                */
/* ================================================================== */
function planEntries() {
  const plan = [];
  const push = (catalogId, loadType, alphas) => {
    for (const al of alphas) plan.push({ catalogId, loadType, alphaDeg: al });
  };

  push("pha1_tap_diode", "R", [0]);
  push("pha1_tap_diode", "RL", [0]);
  push("pha1_tap_thyristor", "R", [0, 30, 60, 90, 120]);
  push("pha1_tap_thyristor", "RL", [0, 30, 60, 90, 120]);
  push("pha1_bridge_diode", "R", [0]);
  push("pha1_bridge_diode", "RL", [0]);
  push("pha1_bridge_thyristor", "RL", [0, 30, 60, 90, 120]);
  push("pha1_bridge_thyristor", "R", [0, 30, 60, 90, 120]);
  push("pha1_bridge_semicontrolled", "RL", [0, 30, 60, 90, 120]);
  push("pha1_bridge_semicontrolled", "R", [0, 30, 60, 90, 120]);
  push("pha3_tap_diode", "R", [0]);
  push("pha3_tap_diode", "RL", [0]);
  push("pha3_tap_thyristor", "R", [0, 30, 45, 60, 90, 120]);
  push("pha3_tap_thyristor", "RL", [0, 30, 60]);
  push("pha3_bridge_diode", "R", [0]);
  push("pha3_bridge_diode", "RL", [0]);
  push("pha3_bridge_thyristor", "RL", [0, 30, 60, 90]);
  push("pha3_bridge_thyristor", "R", [0, 30, 60]);
  push("pha3_bridge_misfire", "RL", [60]);
  push("pha3_bridge_semicontrolled", "RL", [0, 30, 60, 90]);
  push("pha3_bridge_semicontrolled", "R", [0, 30, 60, 90]);

  // ---- Chương 3: điều áp AC ----
  push("ac1p_regulator", "R", [30, 60, 90, 120]);
  push("ac1p_regulator", "RL", [90, 120]); // α > φ ≈ 68°
  push("ac3p_regulator", "R", [60, 90, 120]);

  // ---- Chương 4: DC-DC (alphaDeg = duty %) ----
  push("dcdc_buck", "R", [25, 50, 75]);
  push("dcdc_boost", "R", [25, 50, 75]);

  // ---- Chương 5: nghịch lưu nguồn áp ----
  push("inv1p_full", "R", [0]);
  push("inv1p_full", "RL", [0]);
  push("inv3p_180", "RL", [0]);
  return plan;
}

/* ================================================================== */
/* Tổng hợp                                                            */
/* ================================================================== */
function buildEntry({ catalogId, loadType, alphaDeg }) {
  const cat = CATALOG.find((c) => c.catalogId === catalogId);
  let built;
  let isThreePhase = false;

  switch (catalogId) {
    case "pha1_tap_diode":
      built = buildTap1P({ alphaDeg, controlled: false, loadType });
      break;
    case "pha1_tap_thyristor":
      built = buildTap1P({ alphaDeg, controlled: true, loadType });
      break;
    case "pha1_bridge_diode":
      built = buildBridge1P({ mode: "diode", alphaDeg, loadType });
      break;
    case "pha1_bridge_thyristor":
      built = buildBridge1P({ mode: "thyristor", alphaDeg, loadType });
      break;
    case "pha1_bridge_semicontrolled":
      built = buildBridge1P({ mode: "semi", alphaDeg, loadType });
      break;
    case "pha3_tap_diode":
    case "pha3_tap_thyristor":
      isThreePhase = true;
      built = buildTap3P({
        alphaDeg,
        controlled: cat.controlled,
        loadType,
      });
      break;
    case "pha3_bridge_diode":
      isThreePhase = true;
      built = buildBridge3P({ mode: "diode", alphaDeg, loadType });
      break;
    case "pha3_bridge_thyristor":
      isThreePhase = true;
      built = buildBridge3P({ mode: "thyristor", alphaDeg, loadType });
      break;
    case "pha3_bridge_misfire":
      isThreePhase = true;
      built = buildBridge3P({ mode: "misfire", alphaDeg, loadType });
      break;
    case "pha3_bridge_semicontrolled":
      isThreePhase = true;
      built = buildBridge3P({ mode: "semi", alphaDeg, loadType });
      break;
    case "ac1p_regulator":
      built = buildACReg1P({ alphaDeg, loadType });
      break;
    case "ac3p_regulator":
      isThreePhase = true;
      built = buildACReg3P({ alphaDeg });
      break;
    case "dcdc_buck":
      built = buildBuck({ duty: alphaDeg });
      break;
    case "dcdc_boost":
      built = buildBoost({ duty: alphaDeg });
      break;
    case "inv1p_full":
      built = buildInv1P({ loadType });
      break;
    case "inv3p_180":
      isThreePhase = true;
      built = buildInv3P({ loadType });
      break;
    default:
      throw new Error(`Unknown catalogId: ${catalogId}`);
  }
  built.conductingCount ??= () => 1;

  /* --- uSource --- */
  const uSource = thetaGrid.map((th) =>
    isThreePhase ? round2(uaOf(th)) : round2(UM2 * sinD(th))
  );

  /* --- udTheory: clamp ≥ 0 cho tải R gián đoạn đã xử lý trong builder --- */
  const udTheory = built.ud.map(round2);
  const uVan1 = built.uVan1.map(round2);
  const iVan1 = built.iVan1.map(round2);
  const gatePulses = built.gate;

  /* --- lớp "Simulink" --- */
  const { udSim, uVan1Sim, idSim } = makeSimWaveforms({
    circuitId: catalogId,
    alphaDeg,
    udTheory: built.ud,
    uVan1Theory: built.uVan1,
    iVan1Theory: built.iVan1,
    gatePulses: built.gate,
    conductingCount: built.conductingCount,
    switchingAngles: built.switchingAngles,
    loadType,
    threePhase: isThreePhase,
  });

  /* --- metrics --- */
  const UdTh = mean(built.ud);
  const IdTh = Math.max(UdTh, 0) / R_LOAD;
  const UngMaxTh = built.ungMaxTheory;
  const SbaFactors = {
    pha1_tap_diode_R: 1.48,
    pha1_tap_diode_RL: 1.34,
    pha1_tap_thyristor_R: 1.48,
    pha1_tap_thyristor_RL: 1.34,
    pha1_bridge_diode_R: 1.23,
    pha1_bridge_diode_RL: 1.11,
    pha1_bridge_thyristor_RL: 1.11,
    pha1_bridge_semicontrolled_RL: 1.11,
  };
  const key = `${catalogId}_${loadType}`;
  const sbaFactor = SbaFactors[key] ?? (isThreePhase ? 1.05 : 1.23);
  const SbaTh = sbaFactor * Math.abs(UdTh * IdTh);

  const UdSim = mean(udSim);
  const IdSimAvg = mean(idSim);
  const IdSimRms = rms(idSim);
  const UngMaxSim = -Math.min(...uVan1Sim);
  // AC/Inverter: đại lượng đánh giá là giá trị hiệu dụng, không phải trung bình (=0)
  const isAcLike = catalogId.startsWith("ac") || catalogId.startsWith("inv");
  const UrmsTh = rms(built.ud);
  const UrmsSim = rms(udSim);
  // Mẫu số có sàn tối thiểu 2% Ud0 — tránh nổ % khi Ud lý thuyết ≈ 0 (α = 90°)
  const denomFloor = 0.05 * cat.ud0FactorVsU2 * U2;
  const errDenom = Math.max(Math.abs(isAcLike ? UrmsTh : UdTh), denomFloor);
  const errRefSim = isAcLike ? UrmsSim : UdSim;
  const errPct = (Math.abs(errRefSim - (isAcLike ? UrmsTh : UdTh)) / errDenom) * 100;

  const milestones = built.events
    .map((e) => ({
      theta: Math.round(((e.theta % 720) + 720) % 720),
      title: e.title,
      description: e.description,
      activeValves: e.activeValves,
      circuitState: e.circuitState,
    }))
    .sort((x, y) => x.theta - y.theta);

  // Dòng qua van 1: tải R → bám ud/R (nửa sin / đoạn dây điện áp);
  // tải RL (L lớn) → định mức phẳng Id. Mọi builder đều đi qua pass này.
  const IdFlat = IdSimAvg > 0 ? IdSimAvg : Math.max(UdTh, 0) / R_LOAD;
  const iVan1Shaped = iVan1.map((v, i) =>
    Math.abs(v) > 1e-6 ? (loadType === "RL" ? IdFlat : udSim[i] / R_LOAD) : 0
  );

  return {
    circuitId: `${catalogId}_${loadType.toLowerCase()}_a${String(alphaDeg).padStart(3, "0")}`,
    circuitName: `${cat.circuitName} — α=${alphaDeg}°, tải ${loadType}`,
    catalogId,
    alphaDeg,
    loadType,
    metrics: {
      theory: {
        Ud: round2(UdTh),
        Urms: round2(UrmsTh),
        UngMax: round2(UngMaxTh),
        Iavg: round2(IdTh),
        Sba: round2(SbaTh),
      },
      simulink: {
        Ud: round2(UdSim),
        Urms: round2(UrmsSim),
        UngMax: round2(UngMaxSim),
        Iavg: round2(IdSimAvg),
        Irms: round2(IdSimRms),
        errorPercent: Math.round(errPct * 100) / 100,
      },
    },
    waveforms: {
      thetaDeg: thetaGrid,
      uSource,
      udTheory,
      udSimulink: udSim.map(round2),
      idSimulink: idSim.map(round2),
      uVan1: uVan1Sim.map(round2),
      iVan1: iVan1Shaped.map(round2),
      gatePulses,
    },
    milestones,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
function main() {
  const plan = planEntries();
  console.log(`Đang tổng hợp ${plan.length} bản ghi mô phỏng cho ${CATALOG.length} mạch...`);

  const circuits = plan.map((p, idx) => {
    const entry = buildEntry(p);
    process.stdout.write(
      `\r[${idx + 1}/${plan.length}] ${entry.circuitId} — err=${entry.metrics.simulink.errorPercent}%   `
    );
    return entry;
  });
  console.log("\n");

  const dataset = {
    meta: {
      generatedAtISO: new Date().toISOString(),
      generator: "analytic-mock",
      fGridHz: F_GRID,
      noteVN:
        "Dữ liệu mẫu sinh giải tích (scripts/generate-dataset.mjs): udSimulink = lý thuyết − sụt áp thân van − vệt lõm chuyển mạch + nhiễu. Chạy matlab/export_simulink_data.m để thay bằng dữ liệu Simulink thật (simulink_verified_dataset.simulink.json).",
    },
    catalog: CATALOG,
    circuits,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(dataset), "utf8");
  const kb = (JSON.stringify(dataset).length / 1024).toFixed(0);
  console.log(`✔ Đã ghi ${OUT_PATH} (${kb} KB, ${circuits.length} circuits)`);

  // Bảng kiểm nhanh
  console.log("\nKiểm tra nhanh Ud lý thuyết:");
  for (const cid of [
    "pha1_tap_diode",
    "pha1_bridge_diode",
    "pha3_tap_diode",
    "pha3_bridge_diode",
  ]) {
    const e = circuits.find((c) => c.catalogId === cid && c.loadType === "R");
    console.log(
      `  ${cid.padEnd(20)} Ud=${e.metrics.theory.Ud} V (sim ${e.metrics.simulink.Ud} V, err ${e.metrics.simulink.errorPercent}%)`
    );
  }
}

main();
