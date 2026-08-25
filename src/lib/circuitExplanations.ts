export interface CircuitFormulaSet {
  uOut: string;
  uRevMax: string;
  iValveAvg: string;
  iValveRms: string;
  sBa: string;
  ripple: string;
  special?: {
    label: string;
    tex: string;
  };
}

export interface CircuitStage {
  id: string;
  startDeg: number;
  endDeg: number;
  intervalTex: string;
  valves: string;
  title: string;
  uOutTex: string;
  uValveTex: string;
  iLoadTex: string;
  physicsExplanation: string;
}

export interface CircuitExplanationData {
  formulas: CircuitFormulaSet;
  getStages: (alphaDeg: number, loadType: "R" | "RL") => CircuitStage[];
}

const mod360 = (x: number) => ((x % 360) + 360) % 360;

export const CIRCUIT_EXPLANATIONS: Record<string, CircuitExplanationData> = {
  /* ======================================================================== */
  /* CHƯƠNG 2: CHỈNH LƯU 1 PHA                                                */
  /* ======================================================================== */
  pha1_tap_diode: {
    formulas: {
      uOut: "U_d = \\frac{2\\sqrt{2}}{\\pi} U_2 \\approx 0{,}9\\,U_2 = 89{,}9\\text{ V}",
      uRevMax: "U_{ng,max} = 2\\sqrt{2}\\,U_2 \\approx 282{,}8\\text{ V} = 2\\,U_{m2}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{2} = \\frac{U_d}{2R}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{2}} = \\frac{\\sqrt{2}}{\\pi}\\frac{U_2}{R}",
      sBa: "S_{ba} = \\frac{S_1 + S_2}{2} = 1{,}48\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 2f = 100\\text{ Hz},\\quad K_{nb} = \\frac{2}{3} \\approx 66{,}7\\%",
      special: {
        label: "Điểm giữa biến áp",
        tex: "u_{21} = -u_{22} = \\sqrt{2}U_2\\sin\\theta",
      },
    },
    getStages: (_a, loadType) => [
      {
        id: "tap1p_d_pos",
        startDeg: 0,
        endDeg: 180,
        intervalTex: "\\theta \\in [0^\\circ, 180^\\circ)",
        valves: "D_1",
        title: "Nửa chu kỳ dương — D1 phân cực thuận dẫn điện",
        uOutTex: "u_d(\\theta) = u_{21}(\\theta) = \\sqrt{2}U_2\\sin\\theta > 0",
        uValveTex: "u_{D1} = 0\\text{ V},\\quad u_{D2} = -2u_{21} = -2\\sqrt{2}U_2\\sin\\theta < 0",
        iLoadTex: loadType === "RL" ? "i_d(\\theta) \\approx I_d = \\text{const},\\quad i_{21} = i_d,\\; i_{22} = 0" : "i_d(\\theta) = \\frac{\\sqrt{2}U_2}{R}\\sin\\theta,\\quad i_{21} = i_d,\\; i_{22} = 0",
        physicsExplanation:
          "Điện áp nửa cuộn trên u21 > 0 làm Anode D1 dương hơn Cathode. D1 mở thông nối trực tiếp u21 ra tải. D2 chịu toàn bộ điện áp ngược bằng tổng 2 nửa cuộn u21 + u22 = 2u21, đạt cực đại 2√2 U2 tại 90°.",
      },
      {
        id: "tap1p_d_neg",
        startDeg: 180,
        endDeg: 360,
        intervalTex: "\\theta \\in [180^\\circ, 360^\\circ)",
        valves: "D_2",
        title: "Nửa chu kỳ âm — D2 phân cực thuận dẫn điện",
        uOutTex: "u_d(\\theta) = u_{22}(\\theta) = -\\sqrt{2}U_2\\sin\\theta > 0",
        uValveTex: "u_{D2} = 0\\text{ V},\\quad u_{D1} = -2u_{22} = 2\\sqrt{2}U_2\\sin\\theta < 0",
        iLoadTex: loadType === "RL" ? "i_d(\\theta) \\approx I_d = \\text{const},\\quad i_{22} = i_d,\\; i_{21} = 0" : "i_d(\\theta) = -\\frac{\\sqrt{2}U_2}{R}\\sin\\theta,\\quad i_{22} = i_d,\\; i_{21} = 0",
        physicsExplanation:
          "Điện áp u21 đổi dấu sang âm, u22 dương trở lại. D1 bị khóa ngắt tự nhiên tại điểm qua 0, D2 mở thông dẫn dòng từ nửa cuộn dưới qua tải về điểm trung tính. Dòng điện qua tải luôn chạy theo 1 chiều duy nhất.",
      },
    ],
  },

  pha1_tap_thyristor: {
    formulas: {
      uOut: "U_{d\\alpha} = \\frac{2\\sqrt{2}}{\\pi} U_2\\cos\\alpha = U_{d0}\\cos\\alpha",
      uRevMax: "U_{ng,max} = 2\\sqrt{2}\\,U_2 = 2\\,U_{m2} = 282{,}8\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{2}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{2}}",
      sBa: "S_{ba} = 1{,}48\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 2f = 100\\text{ Hz}",
      special: {
        label: "Phạm vi góc điều khiển",
        tex: "0 \\le \\alpha \\le \\pi\\text{ (chế độ liên tục/gián đoạn)}",
      },
    },
    getStages: (alpha, loadType) => {
      const a = alpha;
      const rl = loadType === "RL";
      const end1 = rl ? 180 + a : 180;
      return [
        {
          id: "tap1p_th_wait1",
          startDeg: 0,
          endDeg: a,
          intervalTex: `\\theta \\in [0^\\circ, ${a}^\\circ)`,
          valves: rl ? "V_2\\text{ (giữ dòng)}" : "\\text{Không van nào dẫn}",
          title: "Chờ phát xung kích V1 — Khoảng chặn thuận",
          uOutTex: rl ? "u_d(\\theta) = u_{22}(\\theta) = -\\sqrt{2}U_2\\sin\\theta < 0" : "u_d(\\theta) = 0\\text{ V}",
          uValveTex: rl ? "u_{V1} = u_{21} - u_{22} = 2\\sqrt{2}U_2\\sin\\theta > 0" : "u_{V1} = u_{21}(\\theta) > 0,\\; u_{V2} = u_{22}(\\theta) < 0",
          iLoadTex: rl ? "i_d \\approx I_d,\\; i_{22} = i_d" : "i_d(\\theta) = 0\\text{ A},\\; i_{21} = i_{22} = 0",
          physicsExplanation:
            rl
              ? "Với tải R-L có điện cảm lớn, năng lượng từ trường trong cuộn cảm ép van V2 tiếp tục dẫn dù u22 đã âm, kéo điện áp ra tải u_d âm cho tới khi V1 được kích mở."
              : "u21 đã dương nhưng chưa có xung điều khiển Ig1 nên V1 vẫn khóa chặn thuận (u_V1 > 0). Dòng tải bằng 0, điện áp tải u_d = 0.",
        },
        {
          id: "tap1p_th_on1",
          startDeg: a,
          endDeg: end1,
          intervalTex: `\\theta \\in [${a}^\\circ, ${end1}^\\circ)`,
          valves: "V_1",
          title: `Kích mở V1 tại α = ${a}° — Dẫn dòng nửa chu kỳ dương`,
          uOutTex: "u_d(\\theta) = u_{21}(\\theta) = \\sqrt{2}U_2\\sin\\theta",
          uValveTex: "u_{V1} = 0\\text{ V},\\quad u_{V2} = -2\\sqrt{2}U_2\\sin\\theta",
          iLoadTex: rl ? "i_d \\approx I_d = \\text{const}" : `i_d(\\theta) = \\frac{\\sqrt{2}U_2}{R}\\sin\\theta`,
          physicsExplanation:
            `Xung kích Ig1 đưa vào cực Gate của V1 tại θ = ${a}°. V1 lập tức mở thông, nối u21 ra tải. Điện áp ngược 2u21 xuất hiện trên V2 làm V2 khóa ngắt hoàn toàn (nếu trước đó còn dẫn).`,
        },
        {
          id: "tap1p_th_wait2",
          startDeg: end1,
          endDeg: 180 + a,
          intervalTex: `\\theta \\in [${end1}^\\circ, ${180 + a}^\\circ)`,
          valves: rl ? "V_1\\text{ (giữ dòng)}" : "\\text{Khoảng chết dòng}",
          title: "Chờ kích V2 — Khoảng gián đoạn / Duy trì cảm",
          uOutTex: rl ? "u_d(\\theta) = u_{21}(\\theta) < 0" : "u_d(\\theta) = 0\\text{ V}",
          uValveTex: "u_{V2} = u_{22}(\\theta) > 0",
          iLoadTex: rl ? "i_d \\approx I_d" : "i_d = 0\\text{ A}",
          physicsExplanation:
            rl
              ? "Điện cảm L xả năng lượng, duy trì dòng qua V1 làm u_d tiếp tục bám theo u21 xuống vùng điện áp âm cho đến khi phát xung kích V2."
              : "u21 về 0 tại 180°, dòng điện tải về 0 nên V1 tự tắt. Mạch rơi vào khoảng chết dòng cho đến khi kích V2 tại 180°+α.",
        },
        {
          id: "tap1p_th_on2",
          startDeg: 180 + a,
          endDeg: rl ? 360 + a : 360,
          intervalTex: `\\theta \\in [${180 + a}^\\circ, ${rl ? 360 + a : 360}^\\circ)`,
          valves: "V_2",
          title: "Kích mở V2 — Dẫn dòng nửa chu kỳ âm",
          uOutTex: "u_d(\\theta) = u_{22}(\\theta) = -\\sqrt{2}U_2\\sin\\theta > 0",
          uValveTex: "u_{V2} = 0\\text{ V},\\quad u_{V1} = -2u_{22}",
          iLoadTex: "i_d > 0,\\quad i_{22} = i_d",
          physicsExplanation:
            "Xung kích Ig2 mở V2 tại 180°+α. u22 nối ra tải, chuyển mạch cưỡng bức kết thúc chu kỳ dẫn của V1 và bắt đầu chu kỳ dẫn đối xứng của V2.",
        },
      ];
    },
  },

  pha1_bridge_diode: {
    formulas: {
      uOut: "U_d = \\frac{2\\sqrt{2}}{\\pi} U_2 \\approx 0{,}9\\,U_2 = 89{,}9\\text{ V}",
      uRevMax: "U_{ng,max} = \\sqrt{2}\\,U_2 = U_{m2} = 141{,}4\\text{ V}\\; (\\text{bằng } 1/2 \\text{ sơ đồ tia})",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{2} = \\frac{U_d}{2R}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{2}}",
      sBa: "S_{ba} = 1{,}23\\,P_d\\; (\\text{hiệu suất sử dụng biến áp cao nhất})",
      ripple: "f_{g\\text{ợ}n} = 2f = 100\\text{ Hz},\\quad K_{nb} = 66{,}7\\%",
      special: {
        label: "Đánh số chéo giáo trình",
        tex: "\\text{Cặp dẫn: } (D_1, D_2) \\leftrightarrow (D_3, D_4)",
      },
    },
    getStages: (_a, loadType) => [
      {
        id: "b1p_d_pos",
        startDeg: 0,
        endDeg: 180,
        intervalTex: "\\theta \\in [0^\\circ, 180^\\circ)",
        valves: "D_1, D_2",
        title: "Nửa chu kỳ dương (u2 > 0) — Cặp chéo D1 và D2 dẫn",
        uOutTex: "u_d(\\theta) = u_2(\\theta) = \\sqrt{2}U_2\\sin\\theta",
        uValveTex: "u_{D1} = u_{D2} = 0\\text{ V},\\quad u_{D3} = u_{D4} = -u_2(\\theta) = -\\sqrt{2}U_2\\sin\\theta",
        iLoadTex: loadType === "RL" ? "i_d \\approx I_d,\\quad i_2(\\theta) = +I_d" : "i_d(\\theta) = \\frac{\\sqrt{2}U_2}{R}\\sin\\theta,\\quad i_2(\\theta) = +i_d(\\theta)",
        physicsExplanation:
          "Cực A dương hơn B: dòng điện đi từ cực A biến áp → D1 → Tải R-L → D2 → cực B biến áp. Hai van D3 và D4 chịu điện áp ngược đúng bằng điện áp nguồn u2, biên độ cực đại √2 U2 (chỉ bằng một nửa so với sơ đồ tia).",
      },
      {
        id: "b1p_d_neg",
        startDeg: 180,
        endDeg: 360,
        intervalTex: "\\theta \\in [180^\\circ, 360^\\circ)",
        valves: "D_3, D_4",
        title: "Nửa chu kỳ âm (u2 < 0) — Cặp chéo D3 và D4 dẫn",
        uOutTex: "u_d(\\theta) = -u_2(\\theta) = |u_2(\\theta)| = \\sqrt{2}U_2|\\sin\\theta|",
        uValveTex: "u_{D3} = u_{D4} = 0\\text{ V},\\quad u_{D1} = u_{D2} = u_2(\\theta) < 0",
        iLoadTex: loadType === "RL" ? "i_d \\approx I_d,\\quad i_2(\\theta) = -I_d\\; (\\text{dòng AC đối xứng})" : "i_d(\\theta) = -\\frac{\\sqrt{2}U_2}{R}\\sin\\theta,\\quad i_2(\\theta) = -i_d(\\theta)",
        physicsExplanation:
          "Cực B dương hơn A: dòng điện đi từ cực B biến áp → D3 → Tải → D4 → cực A biến áp. Dòng thứ cấp máy biến áp i2 đổi chiều tạo nên sóng dòng điện xoay chiều đối xứng không có thành phần một chiều, tối ưu dung lượng biến áp.",
      },
    ],
  },

  pha1_bridge_thyristor: {
    formulas: {
      uOut: "U_{d\\alpha} = \\frac{2\\sqrt{2}}{\\pi} U_2\\cos\\alpha = U_{d0}\\cos\\alpha",
      uRevMax: "U_{ng,max} = \\sqrt{2}\\,U_2 = 141{,}4\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{2}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{2}}",
      sBa: "S_{ba} = 1{,}23\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 2f = 100\\text{ Hz}",
      special: {
        label: "Nghịch lưu phụ thuộc",
        tex: "\\alpha > 90^\\circ,\\; E_d < 0 \\implies U_{d\\alpha} < 0\\text{ (trả năng lượng về lưới)}",
      },
    },
    getStages: (alpha, loadType) => {
      const a = alpha;
      const rl = loadType === "RL";
      return [
        {
          id: "b1p_th_1",
          startDeg: a,
          endDeg: rl ? 180 + a : 180,
          intervalTex: `\\theta \\in [${a}^\\circ, ${rl ? 180 + a : 180}^\\circ)`,
          valves: "V_1, V_2",
          title: `Xung kích cặp (V1, V2) tại α = ${a}°`,
          uOutTex: "u_d(\\theta) = u_2(\\theta) = \\sqrt{2}U_2\\sin\\theta",
          uValveTex: "u_{V1} = u_{V2} = 0\\text{ V},\\quad u_{V3} = u_{V4} = -u_2(\\theta)",
          iLoadTex: rl ? "i_d \\approx I_d,\\quad i_2 = +I_d" : "i_d(\\theta) = \\frac{u_2}{R}",
          physicsExplanation:
            rl
              ? "V1 và V2 cùng mở. Tại 180°, u2 đổi dấu âm nhưng do dòng cảm kháng L duy trì liên tục, V1 và V2 tiếp tục dẫn kéo điện áp u_d âm cho tới khi kích mở cặp đối diện V3, V4."
              : "V1 và V2 dẫn từ α tới 180°. Tại 180°, dòng qua tải về 0 nên V1 và V2 tự ngắt, điện áp u_d về 0 tạo khoảng gián đoạn cho tới khi kích cặp tiếp theo.",
        },
        {
          id: "b1p_th_2",
          startDeg: 180 + a,
          endDeg: rl ? 360 + a : 360,
          intervalTex: `\\theta \\in [${180 + a}^\\circ, ${rl ? 360 + a : 360}^\\circ)`,
          valves: "V_3, V_4",
          title: `Xung kích cặp (V3, V4) tại 180° + α = ${180 + a}°`,
          uOutTex: "u_d(\\theta) = -u_2(\\theta) = -\\sqrt{2}U_2\\sin\\theta",
          uValveTex: "u_{V3} = u_{V4} = 0\\text{ V},\\quad u_{V1} = u_{V2} = u_2(\\theta)",
          iLoadTex: rl ? "i_d \\approx I_d,\\quad i_2 = -I_d" : "i_d(\\theta) = -\\frac{u_2}{R}",
          physicsExplanation:
            "V3 và V4 nhận xung điều khiển, mở thông nối ngược cực tính u2 ra tải. Chuyển mạch cưỡng bức hoàn tất, dòng điện thứ cấp i2 đảo dấu sang âm đối xứng.",
        },
      ];
    },
  },

  pha1_bridge_semicontrolled: {
    formulas: {
      uOut: "U_{d\\alpha} = \\frac{\\sqrt{2}U_2}{\\pi}(1 + \\cos\\alpha) = \\frac{U_{d0}}{2}(1 + \\cos\\alpha)",
      uRevMax: "U_{ng,max} = \\sqrt{2}\\,U_2 = 141{,}4\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{2}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{2}}\\sqrt{1 - \\frac{\\alpha}{\\pi}}",
      sBa: "S_{ba} \\approx 1{,}3\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 2f = 100\\text{ Hz}",
      special: {
        label: "Freewheeling tự nhiên",
        tex: "u_d \\ge 0\\text{ mọi góc } \\alpha\\text{ (không có vùng điện áp âm)}",
      },
    },
    getStages: (alpha, loadType) => {
      const a = alpha;
      const rl = loadType === "RL";
      return [
        {
          id: "semi1p_on1",
          startDeg: a,
          endDeg: 180,
          intervalTex: `\\theta \\in [${a}^\\circ, 180^\\circ)`,
          valves: "V_1, D_2",
          title: "Giai đoạn cấp năng lượng — (V1, D2) dẫn",
          uOutTex: "u_d(\\theta) = u_2(\\theta) = \\sqrt{2}U_2\\sin\\theta > 0",
          uValveTex: "u_{V1} = u_{D2} = 0\\text{ V},\\quad u_{V3} = u_{D4} = -u_2",
          iLoadTex: "i_d > 0,\\quad i_2 = +i_d",
          physicsExplanation:
            "Xung kích đưa tới V1 tại α: dòng từ nguồn u2 qua V1 → tải → D2 về nguồn. Năng lượng truyền từ nguồn AC ra tải một chiều và nạp tích luỹ vào cuộn cảm L.",
        },
        {
          id: "semi1p_fw1",
          startDeg: 180,
          endDeg: 180 + a,
          intervalTex: `\\theta \\in [180^\\circ, ${180 + a}^\\circ)`,
          valves: rl ? "V_1, D_4\\; (\\text{Freewheeling})" : "\\text{Khóa ngắt (tải R)}",
          title: rl ? "Giai đoạn Freewheeling — (V1 + D4) xả năng lượng" : "Khoảng ngắt dòng",
          uOutTex: "u_d(\\theta) = 0\\text{ V}",
          uValveTex: "u_{D4} = 0\\text{ V (dẫn)},\\; u_{D2} = -u_2(\\theta) < 0",
          iLoadTex: rl ? "i_d = I_d\\; (\\text{tuần hoàn kín}),\\; i_2 = 0\\text{ A (nguồn nghỉ)}" : "i_d = 0\\text{ A}",
          physicsExplanation:
            rl
              ? "u2 đảo dấu làm D4 phân cực thuận tự nhiên mở thông, trong khi V1 vẫn chưa tắt. Dòng tải chuyển sang mạch vòng khép kín V1 → Tải → D4 bypass hoàn toàn nguồn u2 (i2 = 0), ud ghim tại 0V. Cuộn cảm xả năng lượng sinh công, triệt tiêu hoàn toàn vùng điện áp âm."
              : "Tải R dòng về 0 tại 180°, V1 tắt tự nhiên. ud = 0 đến khi kích V3.",
        },
        {
          id: "semi1p_on2",
          startDeg: 180 + a,
          endDeg: 360,
          intervalTex: `\\theta \\in [${180 + a}^\\circ, 360^\\circ)`,
          valves: "V_3, D_4",
          title: "Giai đoạn cấp năng lượng nửa âm — (V3, D4) dẫn",
          uOutTex: "u_d(\\theta) = -u_2(\\theta) = \\sqrt{2}U_2|\\sin\\theta|",
          uValveTex: "u_{V3} = u_{D4} = 0\\text{ V}",
          iLoadTex: "i_d > 0,\\quad i_2 = -i_d",
          physicsExplanation:
            "Kích V3 tại 180°+α: dòng chuyển từ pha B qua V3 → tải → D4 về cực A. Nửa chu kỳ âm lặp lại quá trình cấp năng lượng và chuyển mạch freewheeling qua (V3 + D2).",
        },
      ];
    },
  },

  /* ======================================================================== */
  /* CHƯƠNG 2: CHỈNH LƯU 3 PHA                                                */
  /* ======================================================================== */
  pha3_tap_diode: {
    formulas: {
      uOut: "U_d = \\frac{3\\sqrt{6}}{2\\pi} U_{ph} \\approx 1{,}17\\,U_{ph} = 117{,}0\\text{ V}",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = \\sqrt{2}\\,U_d = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{3}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{3}}",
      sBa: "S_{ba} = 1{,}35\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 3f = 150\\text{ Hz},\\quad K_{nb} = \\frac{1}{4} = 25\\%",
      special: {
        label: "Quy tắc chuyển mạch M3",
        tex: "\\text{Giao điểm tự nhiên: } 30^\\circ, 150^\\circ, 270^\\circ\\; (\\text{mỗi van dẫn } 120^\\circ)",
      },
    },
    getStages: (_a, _l) => [
      {
        id: "tap3p_d1",
        startDeg: 30,
        endDeg: 150,
        intervalTex: "\\theta \\in [30^\\circ, 150^\\circ)",
        valves: "D_1",
        title: "Pha A dương nhất — D1 dẫn thông",
        uOutTex: "u_d(\\theta) = u_a(\\theta) = \\sqrt{2}U_{ph}\\sin\\theta",
        uValveTex: "u_{D1} = 0,\\quad u_{D2} = u_b - u_a,\\quad u_{D3} = u_c - u_a",
        iLoadTex: "i_d \\approx I_d,\\quad i_a = I_d,\\; i_b = i_c = 0",
        physicsExplanation:
          "Trong khoảng 30°..150°, điện thế pha ua cao nhất trong 3 pha làm Anode D1 dương nhất so với Cathode chung. D1 dẫn dòng pha A ra tải. Hai diode D2 và D3 chịu điện áp ngược bằng điện áp dây uba và uca, cực đại √6 Uph tại 90°.",
      },
      {
        id: "tap3p_d2",
        startDeg: 150,
        endDeg: 270,
        intervalTex: "\\theta \\in [150^\\circ, 270^\\circ)",
        valves: "D_2",
        title: "Pha B dương nhất — Chuyển mạch sang D2",
        uOutTex: "u_d(\\theta) = u_b(\\theta) = \\sqrt{2}U_{ph}\\sin(\\theta - 120^\\circ)",
        uValveTex: "u_{D2} = 0,\\quad u_{D1} = u_a - u_b,\\quad u_{D3} = u_c - u_b",
        iLoadTex: "i_d \\approx I_d,\\quad i_b = I_d,\\; i_a = i_c = 0",
        physicsExplanation:
          "Tại 150°, ub vượt ua: Cathode chung bị kéo lên theo ub làm D1 phân cực ngược và tắt tự nhiên, D2 mở thông dẫn dòng pha B suốt 120° tiếp theo.",
      },
      {
        id: "tap3p_d3",
        startDeg: 270,
        endDeg: 390,
        intervalTex: "\\theta \\in [270^\\circ, 390^\\circ)",
        valves: "D_3",
        title: "Pha C dương nhất — Chuyển mạch sang D3",
        uOutTex: "u_d(\\theta) = u_c(\\theta) = \\sqrt{2}U_{ph}\\sin(\\theta - 240^\\circ)",
        uValveTex: "u_{D3} = 0,\\quad u_{D1} = u_a - u_c,\\quad u_{D2} = u_b - u_c",
        iLoadTex: "i_d \\approx I_d,\\quad i_c = I_d,\\; i_a = i_b = 0",
        physicsExplanation:
          "Tại 270°, uc trở thành pha có điện thế dương nhất. D3 dẫn dòng pha C khép kín chu kỳ 3 pha, tạo ra điện áp ud gồm 3 chóp sin nhấp nhô tần số 150 Hz.",
      },
    ],
  },

  pha3_tap_thyristor: {
    formulas: {
      uOut: "U_{d\\alpha} = \\frac{3\\sqrt{6}}{2\\pi} U_{ph}\\cos\\alpha = U_{d0}\\cos\\alpha",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{3}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{3}}",
      sBa: "S_{ba} = 1{,}35\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 3f = 150\\text{ Hz}",
      special: {
        label: "Góc giới hạn tải R",
        tex: "\\alpha > 30^\\circ\\text{ (tải R) } \\implies U_{d\\alpha} = \\frac{3\\sqrt{2}U_{ph}}{2\\pi}\\bigl[1 + \\cos(\\alpha+30^\\circ)\\bigr]",
      },
    },
    getStages: (alpha, loadType) => {
      const a = alpha;
      const rl = loadType === "RL";
      const span = rl ? 120 : Math.min(120, 150 - a);
      return [
        {
          id: "tap3p_th1",
          startDeg: 30 + a,
          endDeg: 30 + a + span,
          intervalTex: `\\theta \\in [${30 + a}^\\circ, ${30 + a + span}^\\circ)`,
          valves: "V_1",
          title: `Kích mở V1 tại 30° + α = ${30 + a}°`,
          uOutTex: "u_d(\\theta) = u_a(\\theta) = \\sqrt{2}U_{ph}\\sin\\theta",
          uValveTex: "u_{V1} = 0,\\quad u_{V2} = u_b - u_a,\\quad u_{V3} = u_c - u_a",
          iLoadTex: rl ? "i_d = I_d,\\; i_a = I_d" : "i_d = \\frac{u_a}{R}",
          physicsExplanation:
            `Sau điểm giao tự nhiên 30°, V1 chờ góc chậm α mới nhận xung kích. V1 mở nối ua ra tải. Dẫn trong khoảng ${span}° cho tới khi xung kích tiếp theo đưa tới V2 (hoặc dòng tắt về 0 khi tải R với α > 30°).`,
        },
        {
          id: "tap3p_th2",
          startDeg: 150 + a,
          endDeg: 150 + a + span,
          intervalTex: `\\theta \\in [${150 + a}^\\circ, ${150 + a + span}^\\circ)`,
          valves: "V_2",
          title: `Kích mở V2 tại 150° + α = ${150 + a}°`,
          uOutTex: "u_d(\\theta) = u_b(\\theta) = \\sqrt{2}U_{ph}\\sin(\\theta - 120^\\circ)",
          uValveTex: "u_{V2} = 0,\\quad u_{V1} = u_a - u_b",
          iLoadTex: "i_d > 0,\\; i_b = i_d",
          physicsExplanation:
            "Xung kích Ig2 mở V2. Chuyển mạch cưỡng bức diễn ra: ub áp lên Cathode V1 phân cực ngược V1 tắt, V2 dẫn dòng pha B suốt khoảng tiếp theo.",
        },
        {
          id: "tap3p_th3",
          startDeg: 270 + a,
          endDeg: 270 + a + span,
          intervalTex: `\\theta \\in [${270 + a}^\\circ, ${270 + a + span}^\\circ)`,
          valves: "V_3",
          title: `Kích mở V3 tại 270° + α = ${270 + a}°`,
          uOutTex: "u_d(\\theta) = u_c(\\theta) = \\sqrt{2}U_{ph}\\sin(\\theta - 240^\\circ)",
          uValveTex: "u_{V3} = 0,\\quad u_{V2} = u_b - u_c",
          iLoadTex: "i_d > 0,\\; i_c = i_d",
          physicsExplanation:
            "Xung kích Ig3 mở V3 hoàn tất 3 pha. Điện áp ud điều chỉnh trơn từ cực đại Ud0 (khi α = 0°) xuống 0 (khi α = 90° với tải RL).",
        },
      ];
    },
  },

  pha3_bridge_diode: {
    formulas: {
      uOut: "U_d = \\frac{3\\sqrt{6}}{\\pi} U_{ph} \\approx 2{,}34\\,U_{ph} = 233{,}9\\text{ V}",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = \\sqrt{2}\\,U_d = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{3}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{3}}",
      sBa: "S_{ba} = 1{,}05\\,P_d\\; (\\text{tận dụng tối đa công suất máy biến áp})",
      ripple: "f_{g\\text{ợ}n} = 6f = 300\\text{ Hz},\\quad K_{nb} = 5{,}7\\%\\; (\\text{độ gợn cực nhỏ})",
      special: {
        label: "Đường bao điện áp",
        tex: "u_d(\\theta) = \\varphi_E(\\theta) - \\varphi_F(\\theta) = \\max(u_a, u_b, u_c) - \\min(u_a, u_b, u_c)",
      },
    },
    getStages: (_a, _l) => [
      {
        id: "b3p_d_1",
        startDeg: 30,
        endDeg: 90,
        intervalTex: "\\theta \\in [30^\\circ, 90^\\circ)",
        valves: "D_1, D_6",
        title: "Pha A dương nhất & Pha B âm nhất — (D1, D6) dẫn",
        uOutTex: "u_d(\\theta) = u_a - u_b = u_{AB} = \\sqrt{6}U_{ph}\\sin(\\theta + 30^\\circ)",
        uValveTex: "u_{D1} = u_{D6} = 0,\\quad u_{D3} = u_b - u_a = -u_d",
        iLoadTex: "i_d \\approx I_d,\\quad i_a = +I_d,\\; i_b = -I_d,\\; i_c = 0",
        physicsExplanation:
          "Rail trên D1 (pha A) bám đỉnh dương φE, rail dưới D6 (pha B) bám đáy âm φF. Điện áp ra tải bằng điện áp dây uAB, dòng điện chạy A → tải → B. Gợn sóng 300 Hz gồm 6 đoạn chóp sin ghép lại.",
      },
      {
        id: "b3p_d_2",
        startDeg: 90,
        endDeg: 150,
        intervalTex: "\\theta \\in [90^\\circ, 150^\\circ)",
        valves: "D_1, D_2",
        title: "Pha A dương nhất & Pha C âm nhất — (D1, D2) dẫn",
        uOutTex: "u_d(\\theta) = u_a - u_c = u_{AC}",
        uValveTex: "u_{D1} = u_{D2} = 0",
        iLoadTex: "i_a = +I_d,\\; i_c = -I_d,\\; i_b = 0",
        physicsExplanation:
          "Tại 90°, uc âm hơn ub: D6 tắt tự nhiên, D2 mở thông. Dòng điện chuyển sang A → tải → C. Mỗi van dẫn đúng 120°, mỗi cặp dẫn đúng 60°.",
      },
      {
        id: "b3p_d_3",
        startDeg: 150,
        endDeg: 210,
        intervalTex: "\\theta \\in [150^\\circ, 210^\\circ)",
        valves: "D_3, D_2",
        title: "Pha B dương nhất & Pha C âm nhất — (D3, D2) dẫn",
        uOutTex: "u_d(\\theta) = u_b - u_c = u_{BC}",
        uValveTex: "u_{D3} = u_{D2} = 0",
        iLoadTex: "i_b = +I_d,\\; i_c = -I_d,\\; i_a = 0",
        physicsExplanation:
          "Tại 150°, ub vượt ua: D1 tắt, D3 mở. Cặp (D3, D2) dẫn cho điện áp ra uBC. Dòng điện thứ cấp iA = i_D1 - i_D4 có dạng xung vuông đối xứng 120° dương, 60° nghỉ, 120° âm.",
      },
    ],
  },

  pha3_bridge_thyristor: {
    formulas: {
      uOut: "U_{d\\alpha} = \\frac{3\\sqrt{6}}{\\pi} U_{ph}\\cos\\alpha = U_{d0}\\cos\\alpha",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{3}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{3}}",
      sBa: "S_{ba} = 1{,}05\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 6f = 300\\text{ Hz}",
      special: {
        label: "Hệ thống xung kép",
        tex: "\\text{Mỗi SCR nhận 2 xung: } X_{\\text{chính}} \\text{ và } X_{\\text{nhắc lại sau } 60^\\circ}",
      },
    },
    getStages: (alpha, _l) => {
      const a = alpha;
      return [
        {
          id: "b3p_th_1",
          startDeg: 30 + a,
          endDeg: 90 + a,
          intervalTex: `\\theta \\in [${30 + a}^\\circ, ${90 + a}^\\circ)`,
          valves: "V_1, V_6",
          title: `Kích cặp (V1, V6) tại 30° + α = ${30 + a}°`,
          uOutTex: "u_d(\\theta) = u_{AB}(\\theta) = \\sqrt{6}U_{ph}\\sin(\\theta + 30^\\circ)",
          uValveTex: "u_{V1} = u_{V6} = 0\\text{ V},\\quad u_{V3} = -u_{AB}",
          iLoadTex: "i_d \\approx I_d,\\quad i_a = +I_d,\\; i_b = -I_d",
          physicsExplanation:
            `Xung kép kích đồng thời V1 (rail trên pha A) và phát lại cho V6 (rail dưới pha B). Điện áp dây uAB đặt ra tải. Khoảng dẫn kéo dài 60° cho tới khi kích van kế tiếp V2.`,
        },
        {
          id: "b3p_th_2",
          startDeg: 90 + a,
          endDeg: 150 + a,
          intervalTex: `\\theta \\in [${90 + a}^\\circ, ${150 + a}^\\circ)`,
          valves: "V_1, V_2",
          title: `Kích V2 tại 90° + α = ${90 + a}° — Chuyển sang (V1, V2)`,
          uOutTex: "u_d(\\theta) = u_{AC}(\\theta)",
          uValveTex: "u_{V1} = u_{V2} = 0\\text{ V}",
          iLoadTex: "i_a = +I_d,\\; i_c = -I_d,\\; i_b = 0",
          physicsExplanation:
            "V2 nhận xung chính, V1 nhận xung nhắc lại. Chuyển mạch ở rail dưới từ V6 sang V2, điện áp tải chuyển từ uAB sang uAC.",
        },
        {
          id: "b3p_th_3",
          startDeg: 150 + a,
          endDeg: 210 + a,
          intervalTex: `\\theta \\in [${150 + a}^\\circ, ${210 + a}^\\circ)`,
          valves: "V_3, V_2",
          title: `Kích V3 tại 150° + α = ${150 + a}° — Chuyển sang (V3, V2)`,
          uOutTex: "u_d(\\theta) = u_{BC}(\\theta)",
          uValveTex: "u_{V3} = u_{V2} = 0\\text{ V}",
          iLoadTex: "i_b = +I_d,\\; i_c = -I_d,\\; i_a = 0",
          physicsExplanation:
            "Chuyển mạch ở rail trên từ V1 sang V3, dòng tải chuyển qua pha B và C, u_d bám theo uBC.",
        },
      ];
    },
  },

  pha3_bridge_misfire: {
    formulas: {
      uOut: "U_{d\\alpha} \\ll U_{d0}\\cos\\alpha\\; (\\text{suy giảm công suất nghiêm trọng})",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\text{không đối xứng giữa các van}",
      iValveRms: "I_{v,rms} = \\text{chứa sóng hài bậc thấp}",
      sBa: "S_{ba} \\gg 1{,}05\\,P_d\\; (\\text{tăng tổn hao do méo dòng})",
      ripple: "f_{g\\text{ợ}n} = 50\\text{ Hz}\\; (\\text{mất tính đối xứng 6 xung})",
      special: {
        label: "Lỗi hoán vị xung V5 ↔ V6",
        tex: "\\text{Hai van cùng rail dẫn } \\implies u_d = 0\\text{ từng khoảng } 60^\\circ",
      },
    },
    getStages: (alpha, _l) => [
      {
        id: "misfire_normal",
        startDeg: 30 + alpha,
        endDeg: 150 + alpha,
        intervalTex: `\\theta \\in [${30 + alpha}^\\circ, ${150 + alpha}^\\circ)`,
        valves: "V_1, V_6 / V_1, V_2",
        title: "Đoạn dẫn bình thường trước khi chạm điểm sai xung",
        uOutTex: "u_d = u_{AB} \\to u_{AC}",
        uValveTex: "u_{V1} = 0",
        iLoadTex: "i_d > 0",
        physicsExplanation:
          "Các van V1, V2, V3, V4 nhận xung đúng thứ tự nên mạch vẫn tạo được các đoạn điện áp dây uAB, uAC bình thường.",
      },
      {
        id: "misfire_fault",
        startDeg: 270 + alpha,
        endDeg: 330 + alpha,
        intervalTex: `\\theta \\in [${270 + alpha}^\\circ, ${330 + alpha}^\\circ)`,
        valves: "V_4, V_6\\; (\\text{Cùng rail dưới!})",
        title: "SỰ CỐ: Hai van cùng rail dưới dẫn đồng thời",
        uOutTex: "u_d(\\theta) = 0\\text{ V}\\; (\\text{nối tắt tải})",
        uValveTex: "u_{V4} = u_{V6} = 0",
        iLoadTex: "i_d = I_d\\; (\\text{tuần hoàn qua 2 van dưới})",
        physicsExplanation:
          "Vì hoán vị nhầm V5 và V6: thay vì kích V5 (rail trên), mạch lại kích V6 (rail dưới) khi V4 (cũng rail dưới) đang dẫn. Hai van rail dưới nối tắt hai đầu tải, ud sập về 0V trong suốt 60°, dòng tải không lấy từ nguồn mà chạy vòng qua V4-V6 làm sụt giảm điện áp và méo dòng lưới nghiêm trọng.",
      },
    ],
  },

  pha3_bridge_semicontrolled: {
    formulas: {
      uOut: "U_{d\\alpha} \\approx \\frac{3\\sqrt{6}}{2\\pi} U_{ph}(1 + \\cos\\alpha) = \\frac{U_{d0}}{2}(1 + \\cos\\alpha)",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_d}{3}",
      iValveRms: "I_{v,rms} = \\frac{I_d}{\\sqrt{3}}",
      sBa: "S_{ba} \\approx 1{,}15\\,P_d",
      ripple: "f_{g\\text{ợ}n} = 300\\text{ Hz} \\to 150\\text{ Hz khi } \\alpha > 0",
      special: {
        label: "Cấu trúc bán điều khiển 3 pha",
        tex: "\\text{Rail trên 3 SCR (kích } \\alpha\\text{)} + \\text{Rail dưới 3 Diode (chuyển mạch tự nhiên)}",
      },
    },
    getStages: (alpha, _l) => [
      {
        id: "b3p_semi_1",
        startDeg: 30 + alpha,
        endDeg: 90,
        intervalTex: `\\theta \\in [${30 + alpha}^\\circ, 90^\\circ)`,
        valves: "V_1, D_6",
        title: "V1 điều khiển mở + D6 tự nhiên dẫn",
        uOutTex: "u_d(\\theta) = u_a - u_b = u_{AB}",
        uValveTex: "u_{V1} = u_{D6} = 0",
        iLoadTex: "i_d > 0,\\; i_a = +i_d,\\; i_b = -i_d",
        physicsExplanation:
          "SCR V1 được kích mở tại 30°+α, kết hợp diode D6 (pha B âm nhất) tạo điện áp dây uAB ra tải.",
      },
      {
        id: "b3p_semi_2",
        startDeg: 90,
        endDeg: 150 + alpha,
        intervalTex: `\\theta \\in [90^\\circ, ${150 + alpha}^\\circ)`,
        valves: "V_1, D_2",
        title: "D6 chuyển mạch tự nhiên sang D2",
        uOutTex: "u_d(\\theta) = u_a - u_c = u_{AC}",
        uValveTex: "u_{V1} = u_{D2} = 0",
        iLoadTex: "i_a = +i_d,\\; i_c = -i_d",
        physicsExplanation:
          "Tại 90°, uc âm hơn ub nên D6 tự tắt và D2 tự mở không cần mạch điều khiển. V1 vẫn tiếp tục dẫn cho tới khi kích V3.",
      },
    ],
  },

  /* ======================================================================== */
  /* CHƯƠNG 3: ĐIỀU ÁP XOAY CHIỀU                                             */
  /* ======================================================================== */
  ac1p_regulator: {
    formulas: {
      uOut: "U_{t(\\text{rms})} = U_2 \\sqrt{\\frac{1}{\\pi}\\left(\\pi - \\alpha + \\frac{\\sin 2\\alpha}{2}\\right)}",
      uRevMax: "U_{ng,max} = \\sqrt{2}\\,U_2 = 141{,}4\\text{ V} = U_{m2}",
      iValveAvg: "I_{v,tb} = \\frac{\\sqrt{2}U_2}{\\pi R}(1 + \\cos\\alpha)",
      iValveRms: "I_{v,rms} = \\frac{I_{\\text{rms}}}{\\sqrt{2}}",
      sBa: "S = U_2 I_{\\text{rms}},\\quad P = I_{\\text{rms}}^2 R,\\quad \\cos\\varphi = \\sqrt{\\frac{1}{\\pi}\\left(\\pi - \\alpha + \\frac{\\sin 2\\alpha}{2}\\right)}",
      ripple: "f_{\\text{ra}} = f_{\\text{lưới}} = 50\\text{ Hz}\\; (\\text{tần số không đổi, chỉ biến đổi biên độ hiệu dụng})",
      special: {
        label: "Góc dẫn tải R-L (phương trình xác định λ)",
        tex: "\\sin(\\alpha + \\lambda - \\varphi) - \\sin(\\alpha - \\varphi)e^{-\\lambda/\\tan\\varphi} = 0,\\quad \\varphi = \\arctan\\frac{\\omega L}{R}",
      },
    },
    getStages: (alpha, loadType) => {
      const a = alpha;
      const rl = loadType === "RL";
      return [
        {
          id: "ac1p_pos_wait",
          startDeg: 0,
          endDeg: a,
          intervalTex: `\\theta \\in [0^\\circ, ${a}^\\circ)`,
          valves: rl ? "T_2\\text{ (nếu còn dòng)}" : "\\text{Cả 2 van khóa}",
          title: "Chờ kích T1 — u2 đặt hoàn toàn lên T1",
          uOutTex: "u_{\\text{tải}}(\\theta) = 0\\text{ V}",
          uValveTex: "u_{T1}(\\theta) = u_2(\\theta) = \\sqrt{2}U_2\\sin\\theta > 0",
          iLoadTex: "i(\\theta) = 0\\text{ A}",
          physicsExplanation:
            "u2 dương nhưng chưa có xung kích G1 nên T1 chịu điện áp thuận u2. Điện áp và dòng điện trên tải bằng 0.",
        },
        {
          id: "ac1p_pos_on",
          startDeg: a,
          endDeg: 180,
          intervalTex: `\\theta \\in [${a}^\\circ, 180^\\circ)`,
          valves: "T_1",
          title: `T1 mở thông tại α = ${a}° — Dẫn dòng nửa chu kỳ dương`,
          uOutTex: "u_{\\text{tải}}(\\theta) = u_2(\\theta) = \\sqrt{2}U_2\\sin\\theta",
          uValveTex: "u_{T1} = 0\\text{ V},\\quad u_{T2} = -u_2(\\theta)",
          iLoadTex: rl ? "i(\\theta) = \\frac{U_m}{Z}\\left[\\sin(\\theta-\\varphi) - \\sin(\\alpha-\\varphi)e^{-(\\theta-\\alpha)/\\tan\\varphi}\\right]" : "i(\\theta) = \\frac{\\sqrt{2}U_2}{R}\\sin\\theta",
          physicsExplanation:
            "Xung kích G1 mở T1: tải nối trực tiếp vào nguồn, u_tải bám theo hình sin từ góc α. T2 chịu điện áp ngược đúng bằng u2.",
        },
        {
          id: "ac1p_neg_on",
          startDeg: 180 + a,
          endDeg: 360,
          intervalTex: `\\theta \\in [${180 + a}^\\circ, 360^\\circ)`,
          valves: "T_2",
          title: `T2 mở thông tại 180° + α = ${180 + a}° — Dẫn dòng nửa chu kỳ âm`,
          uOutTex: "u_{\\text{tải}}(\\theta) = u_2(\\theta) < 0",
          uValveTex: "u_{T2} = 0\\text{ V},\\quad u_{T1} = u_2(\\theta)",
          iLoadTex: "i(\\theta) < 0",
          physicsExplanation:
            "Xung G2 kích mở T2 trong nửa chu kỳ âm: u_tải lặp lại dạng sóng sin âm đối xứng, tạo nên dòng điện xoay chiều có giá trị hiệu dụng điều chỉnh được mà tần số không đổi.",
        },
      ];
    },
  },

  ac3p_regulator: {
    formulas: {
      uOut: "U_{t(\\text{rms})} = \\text{hàm theo } \\alpha \\in [0^\\circ, 150^\\circ]",
      uRevMax: "U_{ng,max} = \\sqrt{6}\\,U_{ph} = 244{,}9\\text{ V}",
      iValveAvg: "I_{v,tb} = \\frac{I_{\\text{rms}}}{\\sqrt{2}\\pi}(1 + \\cos\\alpha)",
      iValveRms: "I_{v,rms} = \\frac{I_{\\text{rms}}}{\\sqrt{2}}",
      sBa: "S = 3\\,U_{ph} I_{\\text{rms}}",
      ripple: "f_{\\text{ra}} = 50\\text{ Hz}",
      special: {
        label: "Chế độ dẫn tải sao",
        tex: "\\alpha < 60^\\circ:\\; 3\\text{ van} \\leftrightarrow 2\\text{ van};\\quad 60^\\circ \\le \\alpha \\le 90^\\circ:\\; 2\\text{ van};\\quad \\alpha > 90^\\circ:\\; 2\\text{ van gián đoạn}",
      },
    },
    getStages: (alpha, _l) => [
      {
        id: "ac3p_stage1",
        startDeg: 30 + alpha,
        endDeg: 90 + alpha,
        intervalTex: `\\theta \\in [${30 + alpha}^\\circ, ${90 + alpha}^\\circ)`,
        valves: "V_1, V_6",
        title: "2 van dẫn: V1 (pha A) và V6 (pha B)",
        uOutTex: "u_{ZA}(\\theta) = \\frac{u_a - u_b}{2} = \\frac{u_{AB}}{2}",
        uValveTex: "u_{V1} = 0,\\quad u_{V6} = 0",
        iLoadTex: "i_A = -i_B = \\frac{u_{AB}}{2R},\\quad i_C = 0",
        physicsExplanation:
          "Hai van trên hai pha A và B dẫn: dòng điện đi từ pha A qua ZA, trung tính tải, ZB về pha B. Điện áp trên mỗi pha tải bằng đúng một nửa điện áp dây uAB.",
      },
      {
        id: "ac3p_stage2",
        startDeg: 90 + alpha,
        endDeg: 150 + alpha,
        intervalTex: `\\theta \\in [${90 + alpha}^\\circ, ${150 + alpha}^\\circ)`,
        valves: "V_1, V_2",
        title: "Chuyển mạch sang cặp (V1, V2)",
        uOutTex: "u_{ZA}(\\theta) = \\frac{u_a - u_c}{2} = \\frac{u_{AC}}{2}",
        uValveTex: "u_{V1} = 0,\\quad u_{V2} = 0",
        iLoadTex: "i_A = -i_C = \\frac{u_{AC}}{2R},\\quad i_B = 0",
        physicsExplanation:
          "V2 nhận xung mở: dòng chuyển từ pha A sang pha C qua cặp (V1, V2), điện áp tải pha A chuyển sang uAC/2.",
      },
    ],
  },

  /* ======================================================================== */
  /* CHƯƠNG 4: DC-DC CONVERTER (BUCK / BOOST)                                 */
  /* ======================================================================== */
  dcdc_buck: {
    formulas: {
      uOut: "U_t = \\frac{t_x}{T}E = D\\,E\\; (U_t \\le E)",
      uRevMax: "U_{V,max} = E = 100\\text{ V},\\quad U_{D0,max} = E = 100\\text{ V}",
      iValveAvg: "I_{V,tb} = D\\,I_t = D\\frac{U_t}{R}",
      iValveRms: "I_{V,rms} = \\sqrt{D}\\,I_t",
      sBa: "P = U_t I_t = D^2 \\frac{E^2}{R},\\quad \\eta \\approx 95\\%\\dots 98\\%",
      ripple: "\\Delta I_L = \\frac{(E - U_t)D T}{L} = \\frac{E\\,D(1-D)}{L f_s}",
      special: {
        label: "Độ đập mạch điện áp ra",
        tex: "\\Delta U_t = \\frac{\\Delta I_L}{8 C f_s} = \\frac{E\\,D(1-D)}{8 L C f_s^2}",
      },
    },
    getStages: (duty, _l) => {
      const D = duty / 100;
      const degOn = Math.round(D * 360);
      return [
        {
          id: "buck_on",
          startDeg: 0,
          endDeg: degOn,
          intervalTex: `t \\in [0, D\\cdot T)\\; (\\theta \\in [0^\\circ, ${degOn}^\\circ))`,
          valves: "V\\text{ (IGBT dẫn)}",
          title: "Khoảng nạp năng lượng — Khóa V thông, D0 khóa",
          uOutTex: "u_t(t) = E = 100\\text{ V}",
          uValveTex: "u_V = 0\\text{ V},\\quad u_{D0} = -E = -100\\text{ V}",
          iLoadTex: "i_L(t) = I_{L,min} + \\frac{E - U_t}{L}t\\; (\\text{tăng tuyến tính}),\\quad i_V = i_L,\\; i_{D0} = 0",
          physicsExplanation:
            "IGBT V nhận tín hiệu điều khiển ON nối nguồn E vào mạch LC-tải. Điện áp trên cuộn cảm uL = E - Ut > 0 làm dòng iL tăng tuyến tính, nạp năng lượng từ trường vào L. Diode hoàn năng D0 chịu điện áp ngược -E nên khóa ngắt hoàn toàn.",
        },
        {
          id: "buck_off",
          startDeg: degOn,
          endDeg: 360,
          intervalTex: `t \\in [D\\cdot T, T)\\; (\\theta \\in [${degOn}^\\circ, 360^\\circ))`,
          valves: "D_0\\text{ (Diode hoàn năng dẫn)}",
          title: "Khoảng nhả năng lượng — Khóa V ngắt, D0 dẫn dòng",
          uOutTex: "u_t(t) = 0\\text{ V}",
          uValveTex: "u_V = E = 100\\text{ V},\\quad u_{D0} = 0\\text{ V}",
          iLoadTex: "i_L(t) = I_{L,max} - \\frac{U_t}{L}(t - t_x)\\; (\\text{giảm tuyến tính}),\\quad i_{D0} = i_L,\\; i_V = 0",
          physicsExplanation:
            "V ngắt (OFF). Cuộn cảm L tự cảm sinh sức điện động giữ chiều dòng điện, ép D0 mở thông dẫn tiếp dòng tải (iL khép kín qua D0 và R). Điện áp tức thời u_t sập về 0V. Tụ C phóng điện bù san phẳng điện áp tải Ut = D·E.",
        },
      ];
    },
  },

  dcdc_boost: {
    formulas: {
      uOut: "U_o = \\frac{E}{1 - D}\\; (U_o \\ge E)",
      uRevMax: "U_{V,max} = U_o,\\quad U_{D,max} = U_o",
      iValveAvg: "I_{V,tb} = D\\,I_L = \\frac{D}{1-D}I_o",
      iValveRms: "I_{V,rms} = \\sqrt{D}\\,I_L",
      sBa: "P_o = U_o I_o = \\frac{E^2}{(1-D)^2 R}",
      ripple: "\\Delta I_L = \\frac{E\\,D T}{L} = \\frac{E\\,D}{L f_s}",
      special: {
        label: "Độ đập mạch điện áp ra",
        tex: "\\Delta U_o = \\frac{I_o D T}{C} = \\frac{U_o D}{R C f_s}",
      },
    },
    getStages: (duty, _l) => {
      const D = duty / 100;
      const degOn = Math.round(D * 360);
      return [
        {
          id: "boost_on",
          startDeg: 0,
          endDeg: degOn,
          intervalTex: `t \\in [0, D\\cdot T)\\; (\\theta \\in [0^\\circ, ${degOn}^\\circ))`,
          valves: "V\\text{ (IGBT dẫn)}",
          title: "Khoảng tích lũy năng lượng cuộn cảm — V thông, D khóa",
          uOutTex: "u_L(t) = E = 100\\text{ V}",
          uValveTex: "u_V = 0\\text{ V},\\quad u_D = -U_o < 0",
          iLoadTex: "i_L(t) = I_{L,min} + \\frac{E}{L}t\\; (\\text{tăng tuyến tính}),\\quad i_D = 0,\\; i_C = -I_o",
          physicsExplanation:
            "Khóa V đóng nối tắt cuộn L trực tiếp vào nguồn E: dòng iL tăng tuyến tính tích trữ năng lượng từ trường trong L. Diode D bị điện áp tụ Uo phân cực ngược khóa ngắt; tải được duy trì hoàn toàn bằng năng lượng tích trữ trong tụ C.",
        },
        {
          id: "boost_off",
          startDeg: degOn,
          endDeg: 360,
          intervalTex: `t \\in [D\\cdot T, T)\\; (\\theta \\in [${degOn}^\\circ, 360^\\circ))`,
          valves: "D\\text{ (Diode dẫn)}",
          title: "Khoảng bơm năng lượng ra tải — V khóa, D mở",
          uOutTex: "u_L(t) = E - U_o < 0",
          uValveTex: "u_V = U_o,\\quad u_D = 0\\text{ V}",
          iLoadTex: "i_L(t) = I_{L,max} - \\frac{U_o - E}{L}(t - t_x),\\quad i_D = i_L",
          physicsExplanation:
            "V ngắt. Sức điện động tự cảm của L cộng hưởng cùng nguồn E đẩy điện thế điểm chuyển mạch lên cao hơn Uo, ép D mở thông. Cả nguồn E và cuộn cảm L cùng bơm năng lượng nạp tụ C và nuôi tải, tạo điện áp ra Uo = E/(1-D) lớn hơn điện áp vào E.",
        },
      ];
    },
  },

  /* ======================================================================== */
  /* CHƯƠNG 5: NGHỊCH LƯU NGUỒN ÁP                                            */
  /* ======================================================================== */
  inv1p_full: {
    formulas: {
      uOut: "U_{z(\\text{rms})} = E = 100\\text{ V},\\quad U_{z1} = \\frac{4E}{\\pi\\sqrt{2}} \\approx 0{,}9\\,E = 90\\text{ V}",
      uRevMax: "U_{Tr,max} = E = 100\\text{ V},\\quad U_{D,max} = E = 100\\text{ V}",
      iValveAvg: "I_{Tr,tb} = \\frac{I_z}{2}",
      iValveRms: "I_{Tr,rms} = \\frac{I_z}{\\sqrt{2}}",
      sBa: "S = E\\,I_{z(\\text{rms})}",
      ripple: "f_{\\text{ra}} = 50\\text{ Hz},\\quad \\text{Sóng hài bậc lẻ } (3f, 5f, 7f\\dots)",
      special: {
        label: "Hồi truyền công suất phản kháng",
        tex: "i_z < 0 \\text{ khi } u_z > 0 \\implies D_1, D_2 \\text{ dẫn trả năng lượng về nguồn DC}",
      },
    },
    getStages: (_a, loadType) => {
      const rl = loadType === "RL";
      return [
        {
          id: "inv1p_pos_fw",
          startDeg: 0,
          endDeg: rl ? 100 : 0.1,
          intervalTex: rl ? "\\theta \\in [0^\\circ, 100^\\circ)" : "\\theta = 0^\\circ",
          valves: rl ? "D_1, D_2\\; (\\text{Hồi truyền})" : "Tr_1, Tr_2",
          title: rl ? "Đoạn hồi truyền nửa dương — Diode D1, D2 dẫn ngược" : "Bắt đầu nửa dương",
          uOutTex: "u_z(\\theta) = +E = +100\\text{ V}",
          uValveTex: "u_{Tr1} = u_{Tr2} = 0\\text{ V},\\quad u_{Tr3} = u_{Tr4} = +E",
          iLoadTex: "i_z(\\theta) < 0\\; (\\text{tăng từ } -I_{max} \\text{ lên } 0)",
          physicsExplanation:
            "Tr1 và Tr2 nhận xung mở nhưng dòng tải RL chưa kịp đảo dấu (vẫn âm). Dòng điện buộc phải chạy qua 2 diode ngược song song D1, D2 nạp trả năng lượng cảm kháng về nguồn DC E (công suất P < 0).",
        },
        {
          id: "inv1p_pos_on",
          startDeg: rl ? 100 : 0,
          endDeg: 180,
          intervalTex: rl ? "\\theta \\in [100^\\circ, 180^\\circ)" : "\\theta \\in [0^\\circ, 180^\\circ)",
          valves: "Tr_1, Tr_2",
          title: "Đoạn cấp năng lượng nửa dương — IGBT Tr1, Tr2 dẫn",
          uOutTex: "u_z(\\theta) = +E = +100\\text{ V}",
          uValveTex: "u_{Tr1} = u_{Tr2} = 0\\text{ V}",
          iLoadTex: "i_z(\\theta) > 0\\; (\\text{tăng lên } +I_{max})",
          physicsExplanation:
            "Dòng tải i_z qua điểm 0 và đổi dấu dương: D1, D2 tự tắt, Tr1 và Tr2 chính thức dẫn dòng cấp năng lượng từ nguồn E ra tải xoay chiều.",
        },
        {
          id: "inv1p_neg_fw",
          startDeg: 180,
          endDeg: rl ? 280 : 180.1,
          intervalTex: rl ? "\\theta \\in [180^\\circ, 280^\\circ)" : "\\theta = 180^\\circ",
          valves: rl ? "D_3, D_4\\; (\\text{Hồi truyền})" : "Tr_3, Tr_4",
          title: rl ? "Đoạn hồi truyền nửa âm — Diode D3, D4 dẫn" : "Bắt đầu nửa âm",
          uOutTex: "u_z(\\theta) = -E = -100\\text{ V}",
          uValveTex: "u_{Tr3} = u_{Tr4} = 0\\text{ V}",
          iLoadTex: "i_z(\\theta) > 0\\; (\\text{giảm từ } +I_{max} \\text{ về } 0)",
          physicsExplanation:
            "Tr1, Tr2 bị ngắt, Tr3, Tr4 nhận xung. Do dòng tải còn dương, D3 và D4 mở thông hồi truyền năng lượng về nguồn cho đến khi dòng triệt tiêu.",
        },
        {
          id: "inv1p_neg_on",
          startDeg: rl ? 280 : 180,
          endDeg: 360,
          intervalTex: rl ? "\\theta \\in [280^\\circ, 360^\\circ)" : "\\theta \\in [180^\\circ, 360^\\circ)",
          valves: "Tr_3, Tr_4",
          title: "Đoạn cấp năng lượng nửa âm — IGBT Tr3, Tr4 dẫn",
          uOutTex: "u_z(\\theta) = -E = -100\\text{ V}",
          uValveTex: "u_{Tr3} = u_{Tr4} = 0\\text{ V}",
          iLoadTex: "i_z(\\theta) < 0\\; (\\text{xuống } -I_{max})",
          physicsExplanation:
            "Tr3 và Tr4 dẫn dòng tải theo chiều ngược lại, hoàn thành chu kỳ nghịch lưu tạo điện áp xoay chiều vuông đối xứng ±E.",
        },
      ];
    },
  },

  inv3p_180: {
    formulas: {
      uOut: "U_{AB1} = \\frac{2\\sqrt{3}E}{\\pi\\sqrt{2}} \\approx 0{,}78\\,E,\\quad U_{A1} = \\frac{2E}{\\pi\\sqrt{2}} \\approx 0{,}45\\,E",
      uRevMax: "U_{Tr,max} = E = 100\\text{ V}",
      iValveAvg: "I_{Tr,tb} = \\frac{I_A}{3}",
      iValveRms: "I_{Tr,rms} = \\frac{I_A}{\\sqrt{2}}",
      sBa: "S = \\sqrt{3}\\,U_{AB1} I_{A1}",
      ripple: "f_{\\text{ra}} = 50\\text{ Hz},\\quad \\text{Triệt tiêu sóng hài bội 3 (bậc 3, 9, 15...)}",
      special: {
        label: "Quy luật 6 bước 180°",
        tex: "\\text{Mỗi van dẫn } 180^\\circ,\\text{ lệch pha kích } 60^\\circ \\implies u_{AB} \\in \\{+E, 0, -E\\},\\; u_{AN} \\in \\{\\pm \\tfrac{2}{3}E, \\pm \\tfrac{1}{3}E\\}",
      },
    },
    getStages: (_a, _l) => [
      {
        id: "inv3p_step1",
        startDeg: 0,
        endDeg: 60,
        intervalTex: "\\theta \\in [0^\\circ, 60^\\circ)",
        valves: "Tr_1, Tr_6, Tr_5",
        title: "Bước 1 — Tr1, Tr6, Tr5 dẫn thông",
        uOutTex: "u_{AB} = +E,\\quad u_{BC} = -E,\\quad u_{CA} = 0",
        uValveTex: "u_{AN} = +\\frac{1}{3}E,\\quad u_{BN} = -\\frac{2}{3}E,\\quad u_{CN} = +\\frac{1}{3}E",
        iLoadTex: "i_A + i_B + i_C = 0",
        physicsExplanation:
          "Pha A và C nối lên rail +E/2 (qua Tr1, Tr5), pha B nối xuống rail -E/2 (qua Tr6). Điện áp dây uAB = E, điện áp pha uAN = +1/3 E.",
      },
      {
        id: "inv3p_step2",
        startDeg: 60,
        endDeg: 120,
        intervalTex: "\\theta \\in [60^\\circ, 120^\\circ)",
        valves: "Tr_1, Tr_6, Tr_2",
        title: "Bước 2 — Tr5 tắt, Tr2 mở (Tr1, Tr6, Tr2)",
        uOutTex: "u_{AB} = +E,\\quad u_{BC} = 0,\\quad u_{CA} = -E",
        uValveTex: "u_{AN} = +\\frac{2}{3}E,\\quad u_{BN} = -\\frac{1}{3}E,\\quad u_{CN} = -\\frac{1}{3}E",
        iLoadTex: "i_A = -i_B - i_C",
        physicsExplanation:
          "Tr5 ở pha C ngắt, Tr2 mở nối pha C xuống rail -E/2. Điện áp pha uAN đạt đỉnh +2/3 E.",
      },
      {
        id: "inv3p_step3",
        startDeg: 120,
        endDeg: 180,
        intervalTex: "\\theta \\in [120^\\circ, 180^\\circ)",
        valves: "Tr_1, Tr_3, Tr_2",
        title: "Bước 3 — Tr6 tắt, Tr3 mở (Tr1, Tr3, Tr2)",
        uOutTex: "u_{AB} = 0,\\quad u_{BC} = +E,\\quad u_{CA} = -E",
        uValveTex: "u_{AN} = +\\frac{1}{3}E,\\quad u_{BN} = +\\frac{1}{3}E,\\quad u_{CN} = -\\frac{2}{3}E",
        iLoadTex: "i_C = -i_A - i_B",
        physicsExplanation:
          "Pha B chuyển từ rail âm lên rail dương qua Tr3. uAB về 0, uBC nhảy lên +E.",
      },
    ],
  },
};

export function getCircuitExplanation(catalogId: string | null): CircuitExplanationData | null {
  if (!catalogId) return null;
  return CIRCUIT_EXPLANATIONS[catalogId] ?? null;
}
