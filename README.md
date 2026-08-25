# Simulator Chỉnh lưu — Simulink Verified Pipeline

Bộ mô phỏng & đối chiếu dữ liệu cho **Chương 2: Chỉnh lưu** (Điện tử công suất) gồm hai giai đoạn:

1. **MATLAB/Simulink pipeline** (`matlab/export_simulink_data.m`) — tự động build & chạy mô phỏng **11 mạch chỉnh lưu** (1P/3P, tia/cầu, Diode/Thyristor/bán điều khiển/kích sai), quét α ∈ {0°,30°,60°,90°,120°}, trích dạng sóng xác lập `u_d, i_d, u_van, i_van, gate`, đối chiếu sai số với công thức giải tích và xuất `src/data/simulink_verified_dataset.simulink.json`.
2. **Web simulator (Next.js 14)** — nạp dataset đã kiểm chứng: sơ đồ mạch SVG động (van đổi màu theo trạng thái dẫn, hạt dòng chạy), máy hiện sóng Canvas 6 kênh chồng **Lý thuyết (nét đứt) ↔ Simulink (nét liền)**, vạch quét θ đồng bộ, **tự dừng giải thích tại các mốc chuyển mạch**, bảng đối chiếu sai số.

![Dashboard 1 pha tia Diode](docs/screenshots/dash-1pha-tia-diode.png)
![Cầu 3 pha Thyristor α=60°](docs/screenshots/dash-3p-cau-thyristor-a60.png)
![Kích sai thứ tự pha — méo dạng ud](docs/screenshots/dash-misfire-a60.png)
![Cầu bán điều khiển α=90° — freewheeling](docs/screenshots/dash-1p-ban-dk-a90.png)

## Chạy web simulator

```bash
npm install
npm run generate:data   # (tùy chọn) sinh lại dataset mock giải tích
npm run dev             # http://localhost:3000
```

Deep-link: `?catalog=pha3_bridge_thyristor&load=RL&alpha=60`

## Chạy pipeline Simulink thật

```bash
cd matlab
matlab -batch "run('export_simulink_data.m')"
# Yêu cầu: Simulink + Simscape Electrical (Specialized Power Systems)
# Kết quả: src/data/simulink_verified_dataset.simulink.json
```

Copy kết quả vào `public/data/simulink_verified_dataset.simulink.json` — web **tự ưu tiên** nạp dữ liệu Simulink, fallback về mock giải tích nếu chưa có.

## Cấu trúc

```
matlab/export_simulink_data.m        # Pipeline Simulink → JSON (11 mạch × α × tải)
scripts/generate-dataset.mjs         # Mock giải tích (chạy không cần MATLAB)
src/data/simulink_verified_dataset.json
src/types/simulator.ts               # Schema dùng chung TS ↔ JSON
src/store/useSimulatorStore.ts       # Zustand: chọn mạch/α/tải, quét θ, milestone
src/components/schematic/            # SVG 11 topology, trạng thái van động
src/components/oscilloscope/         # Canvas 6 kênh, scrubber θ
src/components/pedagogical/          # Card giải thích mốc chuyển mạch
src/components/comparison/           # Bảng Lý thuyết ↔ Simulink + % sai số
src/app/page.tsx                     # Dashboard dark-mode kỹ thuật
```

## Quy ước dữ liệu

- `udTheory`: giải tích chuẩn giáo trình; `udSimulink`: đo mô phỏng (chứa sụt áp thân van ~0,8 V/van, vệt lõm chuyển mạch, nhiễu) — sai số % được tính và hiển thị minh bạch.
- Lưới θ: 0→720°, bước 1° (2 chu kỳ lưới 50 Hz).
- Tham số: U₂ = U_ph = 100 V, f = 50 Hz, R = 10 Ω, L = 80 mH.
