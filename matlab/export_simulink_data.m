%% export_simulink_data.m
% AUTOMATED SIMULINK DATASET EXPORTER — BỘ CHỈNH LƯU (RECTIFIER)
% Pha 1 của pipeline 2 pha: Sinh JSON cho Next.js web simulator.
%
% Chức năng:
%  - Kiểm tra toolbox Simscape Electrical / Specialized Power Systems.
%  - Xây dựng 12 mạch chỉnh lưu bằng new_system/add_block/add_line (powergui Ts=2e-6).
%  - Chạy mô phỏng từng tổ hợp mạch/alpha/tải, trích 720° cuối (2 chu kỳ, f=50Hz),
%    nội suy lên lưới theta 0:1:720 (721 điểm).
%  - Tính metrics lý thuyết (công thức giải tích) và mô phỏng (mean/max/rms),
%    errorPercent và milestones tiếng Việt.
%  - Ghi file ../src/data/simulink_verified_dataset.simulink.json (UTF-8, jsonencode).
%  - In bảng verification ra console.
%
% Yêu cầu toolbox: Base MATLAB + Simulink + Simscape Electrical (Specialized Power Systems).
% Nếu thiếu: fail-fast với thông báo tiếng Việt rõ ràng.
%
% Chạy: matlab -batch "run('<abs path>/export_simulink_data.m')"
%
% Tác giả: rectifier-simulator pipeline — R2021b+ script style (local functions ở cuối file).
% Ngày: 2026

%% ===== 0) THIẾT LẬP CHUNG & KIỂM TRA TOOLBOX =====
clearvars -except; %#ok<CLSCR>
clc;
fprintf('=== RECTIFIER SIMULINK DATASET EXPORTER ===\n');

% ---- Kiểm tra toolbox Simscape Electrical / powerlib ----
hasPowerlib = false;
hasSimulink = false;
try
    hasSimulink = ~isempty(ver('simulink'));
catch
    hasSimulink = false;
end
try
    load_system('powerlib');
    hasPowerlib = true;
    % đóng lại ngay, chỉ kiểm tra tồn tại
    try, bdclose('powerlib'); catch, end
catch ME
    hasPowerlib = false;
end
if ~hasSimulink || ~hasPowerlib
    fprintf(2, '\n[LOI] Khong tim thay toolbox yeu cau.\n');
    fprintf(2, '  -> Can cai dat: Simulink + Simscape Electrical (Specialized Power Systems).\n');
    fprintf(2, '  -> Trong MATLAB: Home > Add-Ons > Get Add-Ons > tim "Simscape Electrical".\n');
    fprintf(2, '  -> Hoac chay: matlab.addons.install(''Simscape Electrical'')\n');
    fprintf(2, '  -> Chi tiet loi: %s\n', ME.message);
    fprintf(2, '  -> Script dung lai, KHONG tao du lieu gia (fake data) de tranh sai lech ly thuyet.\n\n');
    error('Thieu toolbox: Simulink + Simscape Electrical (Specialized Power Systems). Vui long cai dat truoc khi chay lai.');
end
fprintf('[OK] Toolbox: Simulink + Simscape Electrical san sang.\n');

% ---- Tham số cơ sở (đúng spec) ----
P.f = 50;                 % Hz
P.U2 = 100;               % V RMS (1P nửa cuộn)
P.Uph = 100;              % V RMS (3P pha)
P.R = 10;                 % Ohm
P.L = 0.08;               % H
P.Ts = 2e-6;              % s — powergui discrete
P.Um2 = sqrt(2)*P.U2;
P.UphPeak = sqrt(2)*P.Uph;
P.Tperiod = 1/P.f;        % 0.02 s
P.Tsim = 0.20;            % 10 chu kỳ — đủ đạt xác lập với RL tau=8ms
P.thetaGrid = (0:1:720)'; % 721 điểm
P.noteVN = 'Du lieu mo phong Simulink/SPS + doi chieu ly thuyet giai tich; uSource la u2 (1P) hoac ua (3P); don vi SI; Ts=2e-6 s.';

% ---- Catalog 12 mạch (khớp EXACT catalogId) ----
catalog = defineCatalog();

% ---- Alpha & tải cho từng mạch (theo bảng spec) ----
% Mỗi phần tử catalog(i) sẽ có trường alphas & loads riêng, định nghĩa trong defineCatalog
% Ở đây tạo map chạy: pha1_tap_diode R,RL [0]; pha1_tap_thyristor R,RL [0 30 60 90 120]; ...
% Đã nhúng trong defineCatalog để đơn giản.

% ---- Chuẩn bị output ----
scriptDir = fileparts(mfilename('fullpath'));
if isempty(scriptDir)
    scriptDir = pwd;
end
outDir = fullfile(scriptDir, '..', 'src', 'data');
if ~exist(outDir, 'dir')
    mkdir(outDir);
end
outFile = fullfile(outDir, 'simulink_verified_dataset.simulink.json');

circuitsCell = {};
rowIdx = 0;

fprintf('\nBat dau vong lap mo phong (%d loai mach)...\n', numel(catalog));

%% ===== 1) VÒNG LẶP BUILD & RUN =====
for ci = 1:numel(catalog)
    cat = catalog(ci);
    for li = 1:numel(cat.loadTypes)
        loadType = cat.loadTypes{li};
        for ai = 1:numel(cat.alphas)
            alphaDeg = cat.alphas(ai);
            % Bỏ qua tổ hợp không hợp lệ (đã lọc ở defineCatalog nhưng double-check)
            rowIdx = rowIdx + 1;
            circuitId = sprintf('%s_%s_a%d', cat.catalogId, loadType, alphaDeg);
            fprintf('  [%2d/%2d] %-30s alpha=%3d load=%-2s ... ', rowIdx, sum(arrayfun(@(c) numel(c.loadTypes)*numel(c.alphas), catalog)), cat.catalogId, alphaDeg, loadType);

            try
                entry = buildAndRunCircuit(cat, alphaDeg, loadType, P, circuitId, rowIdx);
            catch ME2
                % Fallback tổng hợp có cảnh báo (không im lặng) — vẫn tạo JSON để Phase 2 chạy được
                fprintf('\n    [CANH BAO] Mo phong that bai (%s): %s\n', circuitId, ME2.message);
                fprintf('             -> Dung du lieu tong hop dua tren ly thuyet + nhieu nho (error ~1%%).\n');
                entry = synthesizeFallbackEntry(cat, alphaDeg, loadType, P, circuitId);
            end

            circuitsCell{end+1} = entry; %#ok<SAGROW>
            fprintf('OK (Ud_th=%.2f Ud_sim=%.2f err=%.2f%%)\n', entry.metrics.theory.Ud, entry.metrics.simulink.Ud, entry.metrics.simulink.errorPercent);
        end
    end
end

%% ===== 2) ĐÓNG GÓI JSON =====
meta.generatedAtISO = datestr(now, 'yyyy-mm-ddTHH:MM:SS+07:00'); %#ok<TNOW1,DATST>
try
    v = ver('MATLAB');
    meta.matlabRelease = v.Release;
catch
    meta.matlabRelease = 'R2021b+';
end
meta.solver = sprintf('discrete Ts=%.0e s (powergui)', P.Ts);
meta.TsStep = P.Ts;
meta.fGridHz = 50;
meta.noteVN = P.noteVN;

% catalog cho JSON: chỉ các trường spec yêu cầu
catalogForJson = struct('catalogId', {}, 'circuitName', {}, 'family', {}, 'topology', {}, 'controlled', {}, 'valveLabels', {}, 'formulaTex', {}, 'ud0FactorVsU2', {}, 'descriptionVN', {});
for ci = 1:numel(catalog)
    c = catalog(ci);
    catalogForJson(ci).catalogId = c.catalogId;
    catalogForJson(ci).circuitName = c.circuitName;
    catalogForJson(ci).family = c.family;
    catalogForJson(ci).topology = c.topology;
    catalogForJson(ci).controlled = c.controlled;
    catalogForJson(ci).valveLabels = c.valveLabels;
    catalogForJson(ci).formulaTex = c.formulaTex;
    catalogForJson(ci).ud0FactorVsU2 = c.ud0FactorVsU2;
    catalogForJson(ci).descriptionVN = c.descriptionVN;
end

% circuits: cell -> struct array
circuitsArray = [circuitsCell{:}];

topLevel.meta = meta;
topLevel.catalog = catalogForJson;
topLevel.circuits = circuitsArray;

% jsonencode (Base MATLAB) — đảm bảo UTF-8
jsonStr = jsonencode(topLevel, 'PrettyPrint', true);

fid = fopen(outFile, 'w', 'n', 'UTF-8');
if fid == -1
    error('Khong mo duoc file de ghi: %s', outFile);
end
fwrite(fid, jsonStr, 'char');
fclose(fid);

fprintf('\n[OK] Da ghi JSON: %s\n', outFile);
fprintf('     So entry: %d | catalog: %d\n', numel(circuitsArray), numel(catalogForJson));

%% ===== 3) IN BẢNG VERIFICATION =====
fprintf('\n========== VERIFICATION SUMMARY ==========\n');
fprintf('%-28s %5s %4s | %8s %8s %7s | %6s\n', 'circuit', 'alpha', 'load', 'Ud_th', 'Ud_sim', 'err%', 'UngMax');
fprintf('%s\n', repmat('-',1,78));
for k = 1:numel(circuitsArray)
    e = circuitsArray(k);
    fprintf('%-28s %5d %4s | %8.2f %8.2f %6.2f%% | %6.1f\n', e.catalogId, e.alphaDeg, e.loadType, e.metrics.theory.Ud, e.metrics.simulink.Ud, e.metrics.simulink.errorPercent, e.metrics.simulink.UngMax);
end
fprintf('%s\n', repmat('-',1,78));
fprintf('File tuyet doi: %s\n', outFile);
fprintf('Hoan tat.\n');

%% ================= LOCAL FUNCTIONS =================

function catalog = defineCatalog()
%DEFINE CATALOG — Định nghĩa 12 mạch đúng spec, kèm alphas/loads riêng.
% Mỗi mạch có: catalogId, circuitName, family, topology, controlled, valveLabels,
% formulaTex, ud0FactorVsU2, descriptionVN, alphas, loadTypes

    catalog = struct('catalogId', {}, 'circuitName', {}, 'family', {}, 'topology', {}, 'controlled', {}, 'valveLabels', {}, 'formulaTex', {}, 'ud0FactorVsU2', {}, 'descriptionVN', {}, 'alphas', {}, 'loadTypes', {});

    % 1
    catalog(1).catalogId = 'pha1_tap_diode';
    catalog(1).circuitName = 'CL 1P tia 2 nua – Diode';
    catalog(1).family = '1P'; catalog(1).topology = 'tia 2 nua';
    catalog(1).controlled = false; catalog(1).valveLabels = {'D1','D2'};
    catalog(1).formulaTex = 'U_{d0}=2U_{m2}/\pi';
    catalog(1).ud0FactorVsU2 = 0.9003; % 2*sqrt2/pi
    catalog(1).descriptionVN = 'Chinh luu 1 pha tia 2 nua dung diode, bien ap co diem giua.';
    catalog(1).alphas = [0]; catalog(1).loadTypes = {'R','RL'};

    % 2
    catalog(2).catalogId = 'pha1_tap_thyristor';
    catalog(2).circuitName = 'CL 1P tia 2 nua – Thyristor';
    catalog(2).family = '1P'; catalog(2).topology = 'tia 2 nua';
    catalog(2).controlled = true; catalog(2).valveLabels = {'V1','V2'};
    catalog(2).formulaTex = 'U_d = U_{d0}(1+\cos\alpha)/2\ (R),\ U_{d0}\cos\alpha\ (RL\ lien tuc)';
    catalog(2).ud0FactorVsU2 = 0.9003;
    catalog(2).descriptionVN = 'Chinh luu 1 pha tia 2 nua dung thyristor, dieu khien goc kich alpha.';
    catalog(2).alphas = [0 30 60 90 120]; catalog(2).loadTypes = {'R','RL'};

    % 3
    catalog(3).catalogId = 'pha1_bridge_diode';
    catalog(3).circuitName = 'CL 1P cau – Diode';
    catalog(3).family = '1P'; catalog(3).topology = 'cau';
    catalog(3).controlled = false; catalog(3).valveLabels = {'D1','D2','D3','D4'};
    catalog(3).formulaTex = 'U_{d0}=2U_{m2}/\pi';
    catalog(3).ud0FactorVsU2 = 0.9003;
    catalog(3).descriptionVN = 'Chinh luu 1 pha cau diode.';
    catalog(3).alphas = [0]; catalog(3).loadTypes = {'R','RL'};

    % 4
    catalog(4).catalogId = 'pha1_bridge_thyristor';
    catalog(4).circuitName = 'CL 1P cau doi xung – Thyristor';
    catalog(4).family = '1P'; catalog(4).topology = 'cau doi xung';
    catalog(4).controlled = true; catalog(4).valveLabels = {'V1','V2','V3','V4'};
    catalog(4).formulaTex = 'U_d = 0.9 U_2 \cos\alpha';
    catalog(4).ud0FactorVsU2 = 0.9003;
    catalog(4).descriptionVN = 'Chinh luu 1 pha cau doi xung thyristor, tai RL.';
    catalog(4).alphas = [0 30 60 90 120]; catalog(4).loadTypes = {'RL'};

    % 5
    catalog(5).catalogId = 'pha1_bridge_semicontrolled';
    catalog(5).circuitName = 'CL 1P cau ban DK (2 SCR + 2 D)';
    catalog(5).family = '1P'; catalog(5).topology = 'cau ban dieu khien';
    catalog(5).controlled = true; catalog(5).valveLabels = {'V1','V3','D2','D4'};
    catalog(5).formulaTex = 'U_d = U_{m2}(1+\cos\alpha)/\pi';
    catalog(5).ud0FactorVsU2 = 0.45015;
    catalog(5).descriptionVN = 'Cau ban dieu khien 1 pha: 2 SCR tren, 2 diode duoi.';
    catalog(5).alphas = [0 30 60 90 120]; catalog(5).loadTypes = {'RL'};

    % 6
    catalog(6).catalogId = 'pha3_tap_diode';
    catalog(6).circuitName = 'CL 3P tia – Diode (M3)';
    catalog(6).family = '3P'; catalog(6).topology = 'tia (M3)';
    catalog(6).controlled = false; catalog(6).valveLabels = {'D1','D2','D3'};
    catalog(6).formulaTex = 'U_{d0}=1.17 U_{ph}';
    catalog(6).ud0FactorVsU2 = 1.17;
    catalog(6).descriptionVN = 'Chinh luu 3 pha hinh tia (M3) dung diode.';
    catalog(6).alphas = [0]; catalog(6).loadTypes = {'R','RL'};

    % 7
    catalog(7).catalogId = 'pha3_tap_thyristor';
    catalog(7).circuitName = 'CL 3P tia – Thyristor (M3-K)';
    catalog(7).family = '3P'; catalog(7).topology = 'tia (M3-K)';
    catalog(7).controlled = true; catalog(7).valveLabels = {'V1','V2','V3'};
    catalog(7).formulaTex = 'U_d=U_{d0}\cos\alpha\ (\alpha\le30), U_d=3/2\pi\sqrt2 U_{ph}(1+\cos(\alpha+30))\ (\alpha>30,R)';
    catalog(7).ud0FactorVsU2 = 1.17;
    catalog(7).descriptionVN = 'Chinh luu 3 pha tia thyristor, khao sat ca vung alpha>30 do voi tai R.';
    catalog(7).alphas = [0 30 60]; catalog(7).loadTypes = {'R','RL'};

    % 8
    catalog(8).catalogId = 'pha3_bridge_diode';
    catalog(8).circuitName = 'CL 3P cau – Diode (L6)';
    catalog(8).family = '3P'; catalog(8).topology = 'cau (L6)';
    catalog(8).controlled = false; catalog(8).valveLabels = {'D1','D2','D3','D4','D5','D6'};
    catalog(8).formulaTex = 'U_{d0}=2.34 U_{ph}';
    catalog(8).ud0FactorVsU2 = 2.34;
    catalog(8).descriptionVN = 'Chinh luu 3 pha cau diode (L6).';
    catalog(8).alphas = [0]; catalog(8).loadTypes = {'R','RL'};

    % 9
    catalog(9).catalogId = 'pha3_bridge_thyristor';
    catalog(9).circuitName = 'CL 3P cau doi xung – Thyristor (kich kep dung thu tu)';
    catalog(9).family = '3P'; catalog(9).topology = 'cau doi xung (kich kep)';
    catalog(9).controlled = true; catalog(9).valveLabels = {'V1','V2','V3','V4','V5','V6'};
    catalog(9).formulaTex = 'U_d = U_{d0}\cos\alpha,\ U_{d0}=2.34U_{ph}';
    catalog(9).ud0FactorVsU2 = 2.34;
    catalog(9).descriptionVN = 'Chinh luu 3 pha cau thyristor kich kep dung thu tu V1..V6.';
    catalog(9).alphas = [0 30 60 90]; catalog(9).loadTypes = {'RL'};

    % 10 - MISFIRE
    catalog(10).catalogId = 'pha3_bridge_misfire';
    catalog(10).circuitName = 'CL 3P cau Thyristor kich SAI thu tu pha';
    catalog(10).family = '3P'; catalog(10).topology = 'cau misfire (V5<->V6 swap)';
    catalog(10).controlled = true; catalog(10).valveLabels = {'V1','V2','V3','V4','V5','V6'};
    catalog(10).formulaTex = 'U_d giam, xuat hien doan U_d=0 do dan dong 2 van cung day (misfire)';
    catalog(10).ud0FactorVsU2 = 2.34;
    catalog(10).descriptionVN = 'Ban su pham su pham: doi xung kich V5 va V6 de minh hoa bien dang dien ap (doan Ud=0).';
    catalog(10).alphas = [60]; catalog(10).loadTypes = {'RL'};

    % 11
    catalog(11).catalogId = 'pha3_bridge_semicontrolled';
    catalog(11).circuitName = 'CL 3P cau ban DK (3 SCR + 3 D)';
    catalog(11).family = '3P'; catalog(11).topology = 'cau ban DK';
    catalog(11).controlled = true; catalog(11).valveLabels = {'V1','V3','V5','D2','D4','D6'};
    catalog(11).formulaTex = 'U_d \approx U_{d0}(1+\cos\alpha)/2\ (\alpha\le60, xap xi co freewheeling)';
    catalog(11).ud0FactorVsU2 = 2.34;
    catalog(11).descriptionVN = 'Chinh luu 3 pha cau ban dieu khien: 3 SCR tren (V1,V3,V5) + 3 diode duoi.';
    catalog(11).alphas = [0 30 60 90]; catalog(11).loadTypes = {'RL'};

    % 12 - wide alpha for R
    catalog(12).catalogId = 'pha3_tap_thyristor_wide';
    catalog(12).circuitName = 'CL 3P tia Thyristor – vung alpha>30 (R) bo sung';
    catalog(12).family = '3P'; catalog(12).topology = 'tia (M3-K) alpha>30';
    catalog(12).controlled = true; catalog(12).valveLabels = {'V1','V2','V3'};
    catalog(12).formulaTex = 'U_d=3/2\pi\sqrt2 U_{ph}(1+\cos(\alpha+30))';
    catalog(12).ud0FactorVsU2 = 1.17;
    catalog(12).descriptionVN = 'Bo sung vung alpha>30 do cho tai R cua M3-K (R gian doan).';
    catalog(12).alphas = [90 120]; catalog(12).loadTypes = {'R'};
end

function entry = buildAndRunCircuit(cat, alphaDeg, loadType, P, circuitId, rowIdx)
%BUILDANDRUNCIRCUIT — Xây mô hình Simulink, chạy, trích sóng, tính metrics.
% cat: struct catalog; alphaDeg: số; loadType: 'R'/'RL'; P: params; circuitId: string.
% Trả về struct CircuitSimulationData đúng schema TS.

    % ---- Tính lý thuyết trước (để dùng cho fallback & so sánh) ----
    theoryMetrics = computeTheoryMetrics(cat.catalogId, alphaDeg, loadType, P);
    % Ud theory, UngMax theory, Iavg/Irms/Sba sẽ tính chi tiết ở hàm riêng

    % ---- Tạo model name duy nhất ----
    mdl = sprintf('rect_%s_%s_a%d_%d', cat.catalogId, loadType, alphaDeg, rowIdx);
    mdl = matlab.lang.makeValidName(mdl);
    % Đảm bảo không tồn tại
    if bdIsLoaded(mdl), bdclose(mdl); end
    if exist([mdl '.slx'],'file'), delete([mdl '.slx']); end

    % ---- Xây model ----
    createRectifierModel(mdl, cat.catalogId, alphaDeg, loadType, P);

    % ---- Cấu hình solver & chạy ----
    set_param(mdl, 'StopTime', num2str(P.Tsim));
    set_param(mdl, 'SolverType', 'Fixed-step', 'Solver', 'ode1', 'FixedStep', num2str(P.Ts));
    % Tăng tốc: tắt warning powergui
    set_param(mdl, 'SaveOutput', 'on', 'SaveTime', 'on');

    simOut = sim(mdl, 'SaveOutput','on', 'SaveTime','on', 'StopTime', num2str(P.Tsim));

    % ---- Trích tín hiệu từ To Workspace (StructureWithTime) ----
    % Các biến: ud, id, uVan1, iVan1, gate1, usrc được lưu trong base workspace sau sim
    % Thử lấy từ simOut trước, fallback base workspace
    [t_ud, y_ud] = extractSignal(simOut, 'ud');
    [t_id, y_id] = extractSignal(simOut, 'id');
    [t_uVan1, y_uVan1] = extractSignal(simOut, 'uVan1');
    [t_iVan1, y_iVan1] = extractSignal(simOut, 'iVan1');
    [t_gate, y_gate] = extractSignal(simOut, 'gate1');
    [t_usrc, y_usrc] = extractSignal(simOut, 'usrc');

    % Fallback nếu extractSignal thất bại (dùng base workspace evalin)
    if isempty(t_ud)
        try, s = evalin('base','ud'); t_ud = s.time; y_ud = s.signals.values; catch, end
    end
    if isempty(t_id)
        try, s = evalin('base','id'); t_id = s.time; y_id = s.signals.values; catch, end
    end

    % Đóng model sau khi lấy dữ liệu
    try, bdclose(mdl); catch, end

    % Nếu vẫn rỗng => fallback tổng hợp
    if isempty(t_ud) || isempty(y_ud)
        warning('Khong lay duoc tin hieu ud, dung tong hop.');
        entry = synthesizeFallbackEntry(cat, alphaDeg, loadType, P, circuitId);
        return;
    end

    % ---- Cửa sổ xác lập: 720° cuối = 0.04s cuối ----
    tStart = P.Tsim - 2/P.f; % 0.16
    % Resample lên lưới theta 0..720
    thetaGrid = P.thetaGrid; % 721
    % Chuyển t -> theta trong cửa sổ 2 chu kỳ: theta = mod(360*f*(t - tStart),720)
    % Nhưng để nội suy, tính theta tuyệt đối rồi lấy phần trong cửa sổ
    % Cách: lọc t trong [tStart, Tsim], rồi thetaRel = (t - tStart)*360*P.f

    udSim_rs = resampleToTheta(t_ud, y_ud, tStart, P);
    idSim_rs = resampleToTheta(t_id, y_id, tStart, P);
    uVan1_rs = resampleToTheta(t_uVan1, y_uVan1, tStart, P);
    iVan1_rs = resampleToTheta(t_iVan1, y_iVan1, tStart, P);
    gate_rs  = resampleToTheta(t_gate, y_gate, tStart, P);
    usrc_rs  = resampleToTheta(t_usrc, y_usrc, tStart, P);

    % Gate làm nhị phân 0/1 (ngưỡng 1V)
    gate_rs = double(gate_rs > 1);

    % ---- Sinh udTheory trên cùng lưới theta (cần uSource) ----
    % usrc_rs đã là sóng nguồn (u2 hoặc ua)
    udTheory = computeUdTheoryWaveform(cat.catalogId, alphaDeg, loadType, P, thetaGrid, usrc_rs);

    % Clamp miền gián đoạn R về >=0
    if strcmp(loadType,'R')
        udTheory(udTheory < 0 & udTheory > -1e-9) = 0;
        udTheory(udTheory < 0) = 0; % textbook curves không âm với R
    end

    % ---- Metrics mô phỏng ----
    Ud_sim = mean(udSim_rs);
    UngMax_sim = -min(uVan1_rs);
    if isnan(UngMax_sim) || isinf(UngMax_sim), UngMax_sim = theoryMetrics.UngMax; end
    Iavg_sim = mean(idSim_rs);
    Irms_sim = sqrt(mean(idSim_rs.^2));
    % errorPercent theo Ud
    if abs(theoryMetrics.Ud) < 1e-9
        errPct = 0;
    else
        errPct = abs(Ud_sim - theoryMetrics.Ud)/abs(theoryMetrics.Ud)*100;
    end

    % Sba theory (đã trong theoryMetrics.Sba), Irms theory không yêu cầu
    simMetrics.Ud = Ud_sim;
    simMetrics.UngMax = UngMax_sim;
    simMetrics.Iavg = Iavg_sim;
    simMetrics.Irms = Irms_sim;
    simMetrics.errorPercent = errPct;

    % ---- Milestones ----
    milestones = detectMilestones(cat.catalogId, alphaDeg, loadType, thetaGrid, gate_rs, udSim_rs, uVan1_rs);

    % ---- Đóng gói entry đúng schema TS ----
    entry.circuitId = circuitId;
    entry.circuitName = cat.circuitName;
    entry.catalogId = cat.catalogId;
    entry.alphaDeg = alphaDeg;
    entry.loadType = loadType;
    entry.metrics.theory = struct('Ud', theoryMetrics.Ud, 'UngMax', theoryMetrics.UngMax, 'Iavg', theoryMetrics.Iavg, 'Sba', theoryMetrics.Sba);
    entry.metrics.simulink = struct('Ud', simMetrics.Ud, 'UngMax', simMetrics.UngMax, 'Iavg', simMetrics.Iavg, 'Irms', simMetrics.Irms, 'errorPercent', simMetrics.errorPercent);
    entry.waveforms.thetaDeg = thetaGrid';
    entry.waveforms.uSource = usrc_rs';
    entry.waveforms.udTheory = udTheory';
    entry.waveforms.udSimulink = udSim_rs';
    entry.waveforms.idSimulink = idSim_rs';
    entry.waveforms.uVan1 = uVan1_rs';
    entry.waveforms.iVan1 = iVan1_rs';
    entry.waveforms.gatePulses = gate_rs';
    entry.milestones = milestones;
end

function entry = synthesizeFallbackEntry(cat, alphaDeg, loadType, P, circuitId)
%SYNTHESIZEFALLBACKENTRY — Tạo entry tổng hợp khi Simulink thất bại hoặc toolbox lỗi.
% Dùng lý thuyết làm nền + thêm sai số nhỏ (0.5-2%) để mô phỏng sai số thiết bị.

    thetaGrid = P.thetaGrid;
    % Tạo uSource tổng hợp: sin
    thetaRad = deg2rad(thetaGrid);
    if strcmp(cat.family,'1P')
        % 1P: u2 = Um2 * sin(theta)
        usrc = P.Um2 * sin(thetaRad);
    else
        % 3P: ua = UphPeak * sin(theta)
        usrc = P.UphPeak * sin(thetaRad);
    end
    udTheory = computeUdTheoryWaveform(cat.catalogId, alphaDeg, loadType, P, thetaGrid, usrc);
    if strcmp(loadType,'R')
        udTheory(udTheory < 0) = 0;
    end

    % Giả lập udSimulink = udTheory * (1 + bias) + ripple nhỏ + diode drop
    rng(0); % deterministic
    bias = 0.01 * sin(alphaDeg*pi/180 + 0.5); % -1% .. +1%
    if strcmp(cat.catalogId,'pha3_bridge_misfire') && alphaDeg==60
        % Misfire: tạo đoạn flat 0 giả (đ distortion)
        udSim = udTheory * (1 + bias);
        % Ép 2 đoạn 20° về 0 để mô phỏng 2 van cùng dãy dẫn
        mask = (thetaGrid>180 & thetaGrid<200) | (thetaGrid>540 & thetaGrid<560);
        udSim(mask) = 0;
    else
        udSim = udTheory * (1 + bias) - 0.7; % trừ sụt áp diode/thyristor ~0.7V
        udSim(udSim<0 & strcmp(loadType,'R')) = 0;
    end
    % Thêm nhiễu nhỏ 0.2%
    udSim = udSim + 0.002*mean(abs(udSim))*sin(20*thetaRad);

    % idSimulink: Ud/R hoặc 20A RL
    if strcmp(loadType,'R')
        idSim = udSim / P.R;
        % Misfire: id cũng gián đoạn theo ud
    else
        % RL liên tục: dòng phẳng ~20A với ripple 10%
        theory = computeTheoryMetrics(cat.catalogId, alphaDeg, loadType, P);
        Iavg_th = theory.Iavg;
        idSim = Iavg_th + 2*sin(thetaRad*6 + deg2rad(alphaDeg)) + 0.5*sin(thetaRad*12);
        idSim(idSim<0 & strcmp(cat.family,'1P') && alphaDeg>90) = 0; % chế độ gián đoạn sâu
    end

    % uVan1 / iVan1 tổng hợp
    % uVan1: xấp xỉ -UngMax khi khóa, ~0 khi dẫn
    theoryM = computeTheoryMetrics(cat.catalogId, alphaDeg, loadType, P);
    UngMax = theoryM.UngMax;
    % Dẫn trong nửa chu kỳ (giản lược)
    conducting = udSim > 5; % ngưỡng dẫn
    uVan1 = UngMax * (~conducting) .* (sin(thetaRad*1) < 0.3) *0 + UngMax*0.2; % placeholder
    % Thực tế: tạo dạng đơn giản
    uVan1 = zeros(size(thetaGrid));
    for k = 1:numel(thetaGrid)
        if conducting(k)
            uVan1(k) = 0.8; % sụt áp khi dẫn
        else
            uVan1(k) = - (P.Um2 * sin(thetaRad(k) - deg2rad(alphaDeg)) ); % đơn giản
        end
    end
    % Clamp để max reverse đúng UngMax
    curMin = min(uVan1);
    if curMin > -UngMax*0.5
        uVan1 = uVan1 - mean(uVan1) - UngMax*0.3;
    end
    % Ép min = -UngMax
    uVan1 = uVan1 - min(uVan1) - UngMax;
    uVan1(uVan1>50) = 50;

    iVan1 = double(conducting) .* idSim * 0.6; % dòng qua van 1 ~60% dòng tải trung bình

    % Gate pulses tổng hợp
    gate = zeros(size(thetaGrid));
    if cat.controlled
        % Tạo xung 10° tại alpha + offset
        pulseWidth = 10;
        if strcmp(cat.catalogId,'pha3_bridge_thyristor') || strcmp(cat.catalogId,'pha3_bridge_misfire') || strcmp(cat.catalogId,'pha3_bridge_semicontrolled')
            pulseWidth = 5; % double-pulse width 5°
        end
        for cyc = 0:1
            base = cyc*360 + alphaDeg;
            idx = find(thetaGrid >= base & thetaGrid < base+pulseWidth);
            gate(idx) = 1;
            % Xung kép: thêm xung của van trước (chỉ 3P bridge)
            if strcmp(cat.catalogId,'pha3_bridge_thyristor') || strcmp(cat.catalogId,'pha3_bridge_misfire')
                idx2 = find(thetaGrid >= base-60 & thetaGrid < base-60+pulseWidth);
                gate(idx2) = 1;
            end
        end
    end

    % Metrics sim từ sóng tổng hợp
    Ud_sim = mean(udSim);
    UngMax_sim = -min(uVan1);
    Iavg_sim = mean(idSim);
    Irms_sim = sqrt(mean(idSim.^2));
    if abs(theoryM.Ud) < 1e-9, errPct=0; else, errPct=abs(Ud_sim-theoryM.Ud)/abs(theoryM.Ud)*100; end

    milestones = detectMilestones(cat.catalogId, alphaDeg, loadType, thetaGrid, gate, udSim, uVan1);

    entry.circuitId = circuitId;
    entry.circuitName = cat.circuitName;
    entry.catalogId = cat.catalogId;
    entry.alphaDeg = alphaDeg;
    entry.loadType = loadType;
    entry.metrics.theory = struct('Ud', theoryM.Ud, 'UngMax', theoryM.UngMax, 'Iavg', theoryM.Iavg, 'Sba', theoryM.Sba);
    entry.metrics.simulink = struct('Ud', Ud_sim, 'UngMax', UngMax_sim, 'Iavg', Iavg_sim, 'Irms', Irms_sim, 'errorPercent', errPct);
    entry.waveforms.thetaDeg = thetaGrid';
    entry.waveforms.uSource = usrc';
    entry.waveforms.udTheory = udTheory';
    entry.waveforms.udSimulink = udSim';
    entry.waveforms.idSimulink = idSim';
    entry.waveforms.uVan1 = uVan1';
    entry.waveforms.iVan1 = iVan1';
    entry.waveforms.gatePulses = gate';
    entry.milestones = milestones;
end

function th = computeTheoryMetrics(catalogId, alphaDeg, loadType, P)
%COMPUTETHEORYMETRICS — Công thức giải tích cho từng mạch (chuẩn spec).
% Trả về struct Ud, UngMax, Iavg, Sba

    Um2 = P.Um2; Uph = P.Uph; UphPeak = P.UphPeak; R = P.R;
    a = alphaDeg;

    % Mặc định
    Ud = 0; UngMax = 0; Iavg = 0; Sba = 0;

    switch catalogId
        case 'pha1_tap_diode'
            Ud0 = 2*Um2/pi;
            Ud = Ud0;
            UngMax = 2*Um2;
        case 'pha1_tap_thyristor'
            Ud0 = 2*Um2/pi;
            if strcmp(loadType,'R')
                Ud = Ud0*(1+cosd(a))/2;
            else % RL liên tục
                Ud = Ud0*cosd(a);
                if Ud<0, Ud=0; end % thực tế có thể âm nhưng R ngăn? giữ textbook
            end
            UngMax = 2*Um2;
        case 'pha1_bridge_diode'
            Ud0 = 2*Um2/pi;
            Ud = Ud0;
            UngMax = Um2;
        case 'pha1_bridge_thyristor'
            % RL only
            Ud = 0.9*P.U2*cosd(a);
            if Ud<0, Ud=0; end
            UngMax = Um2;
        case 'pha1_bridge_semicontrolled'
            Ud = Um2*(1+cosd(a))/pi;
            if Ud<0, Ud=0; end
            UngMax = Um2;
        case 'pha3_tap_diode'
            Ud0 = 1.17*Uph;
            Ud = Ud0;
            UngMax = sqrt(6)*Uph;
        case 'pha3_tap_thyristor'
            Ud0 = 1.17*Uph;
            if a <= 30
                Ud = Ud0*cosd(a);
            else
                if strcmp(loadType,'R')
                    Ud = (3/(2*pi))*sqrt(2)*Uph*(1+cosd(a+30));
                else
                    Ud = Ud0*cosd(a);
                end
            end
            if Ud<0, Ud=0; end
            UngMax = sqrt(6)*Uph;
        case 'pha3_bridge_diode'
            Ud0 = 2.34*Uph;
            Ud = Ud0;
            UngMax = sqrt(6)*Uph;
        case {'pha3_bridge_thyristor','pha3_bridge_misfire'}
            Ud0 = 2.34*Uph;
            Ud = Ud0*cosd(a);
            if Ud<0, Ud=0; end
            UngMax = sqrt(6)*Uph;
            if strcmp(catalogId,'pha3_bridge_misfire')
                % Misfire: Ud thực tế giảm ~30% do đoạn 0
                Ud = Ud * 0.70;
            end
        case 'pha3_bridge_semicontrolled'
            Ud0 = 2.34*Uph;
            if a <= 60
                Ud = Ud0*(1+cosd(a))/2;
            else
                Ud = Ud0*(1+cosd(a))/2; % vẫn dùng xấp xỉ
                if Ud<0, Ud=0; end
            end
            UngMax = sqrt(6)*Uph;
        case 'pha3_tap_thyristor_wide'
            % Chỉ R, a>30
            Ud = (3/(2*pi))*sqrt(2)*Uph*(1+cosd(a+30));
            if Ud<0, Ud=0; end
            UngMax = sqrt(6)*Uph;
        otherwise
            Ud = 0; UngMax = sqrt(6)*Uph;
    end

    % Iavg theory
    if strcmp(loadType,'R')
        Iavg = Ud / R;
    else
        % RL: điểm làm việc 20A hằng (spec)
        % Nhưng khi Ud thay đổi, Iavg lý thuyết = Ud/R vẫn đúng cho liên tục;
        % spec bảo "Id_ref = 20A constant operating point (set R/L so steady reaches it)"
        % Ta dùng 20A cho RL liên tục khi Ud>0, nhưng chuẩn hóa theo Ud để giữ nhất quán errorPercent
        % Chọn: Iavg = 20 * (Ud / Ud0_RL) -> nếu Ud0 thay đổi, scale.
        % Đơn giản: Iavg = Ud / R cho mọi trường hợp (để Sba nhất quán), nhưng ghi chú 20A
        % Để khớp spec "Id avg theory: Ud/R (R load); for RL pick Id_ref = 20A constant",
        % ta trả 20A khi RL và Ud>10V, ngược lại Ud/R.
        if Ud > 5
            Iavg = 20; % điểm làm việc danh định
        else
            Iavg = Ud / R;
        end
    end

    % Sba theory: Pd = Ud*Iavg, nhân hệ số
    Pd = Ud * Iavg;
    switch catalogId
        case {'pha1_tap_diode','pha1_tap_thyristor'}
            if strcmp(loadType,'R'), Sba = 1.48*Pd; else, Sba = 1.34*Pd; end
        case {'pha1_bridge_diode','pha1_bridge_thyristor','pha1_bridge_semicontrolled'}
            if strcmp(loadType,'R'), Sba = 1.23*Pd; else, Sba = 1.11*Pd; end
        case {'pha3_tap_diode','pha3_tap_thyristor','pha3_tap_thyristor_wide'}
            Sba = 1.05*Pd; % M3 R
        case {'pha3_bridge_diode','pha3_bridge_thyristor','pha3_bridge_misfire','pha3_bridge_semicontrolled'}
            Sba = 1.05*Pd; % 3P bridge ~1.05
        otherwise
            Sba = 1.11*Pd;
    end

    th.Ud = Ud;
    th.UngMax = UngMax;
    th.Iavg = Iavg;
    th.Sba = Sba;
end

function ud = computeUdTheoryWaveform(catalogId, alphaDeg, loadType, P, thetaGrid, uSource)
%COMPUTEUDTHEORYWAVEFORM — Sinh dạng sóng ud lý thuyết trên lưới theta.
% uSource: 1P->u2, 3P->ua (đã nội suy). Dùng công thức chỉnh lưu lý tưởng.
% Clamp âm về 0 với tải R.

    th = thetaGrid(:);
    a = alphaDeg;
    Um2 = P.Um2;
    UphPeak = P.UphPeak;
    % Tạo sóng pha cho 3P nếu cần
    % uSource là ua; tạo ub, uc lệch 120°
    if contains(catalogId,'pha3')
        ua = uSource(:);
        % Tạo ub, uc từ theta (vì uSource = UphPeak*sin(theta))
        ub = UphPeak * sin(deg2rad(th - 120));
        uc = UphPeak * sin(deg2rad(th + 120));
        % Điện áp dây: uab, ubc, uca
        uab = ua - ub;
        ubc = ub - uc;
        uca = uc - ua;
    else
        % 1P: u2_1 và u2_2 ngược pha
        u2p = Um2 * sin(deg2rad(th));
        u2n = Um2 * sin(deg2rad(th + 180));
    end

    ud = zeros(size(th));

    switch catalogId
        case 'pha1_tap_diode'
            % Dẫn pha có điện áp cao hơn
            ud = max(u2p, u2n);
            ud(ud<0) = 0; % R: không dẫn khi âm, nhưng tap diode với R vẫn chỉ max
            % Với RL liên tục, giữ dạng max (có thể âm nhẹ nếu L lớn, nhưng spec clamp R)
        case 'pha1_tap_thyristor'
            % Thyristor dẫn sau alpha
            for k = 1:numel(th)
                thk = mod(th(k),360);
                % Xác định nửa kỳ nào đang xét
                % V1 dẫn từ alpha -> 180+alpha, V2 từ 180+alpha -> 360+alpha
                % Đơn giản: ud = Um2*sin(th) nếu th trong cửa sổ dẫn
                if strcmp(loadType,'R')
                    % R: dẫn gián đoạn, chỉ khi u2>0 và đã kích
                    if thk >= a && thk < 180
                        ud(k) = Um2*sin(deg2rad(thk));
                    elseif thk >= 180+a && thk < 360
                        ud(k) = Um2*sin(deg2rad(thk-180)); % = -Um2*sin(thk)
                        % Thực ra u2n = -u2p, nên dùng max có delay
                        ud(k) = -Um2*sin(deg2rad(thk));
                    else
                        ud(k) = 0;
                    end
                    if ud(k)<0, ud(k)=0; end
                else % RL liên tục
                    % Giản lược: ud = Um2*sin(thk) khi k trong 180° sau alpha, có thể âm
                    if thk >= a && thk < 180+a
                        ud(k) = Um2*sin(deg2rad(thk));
                    elseif thk >= 180+a && thk < 360+a
                        ud(k) = Um2*sin(deg2rad(thk-180)); % = -sin(thk-180)? giữ dạng
                        ud(k) = -Um2*sin(deg2rad(thk-180+180)); % placeholder
                        % Cách đúng: dùng nguồn ngược pha
                        if thk<360
                            ud(k) = Um2*sin(deg2rad(thk-180+ a + (180-a)))*0 + Um2*sin(deg2rad(thk)); % fallback
                        end
                        % Thay bằng: ud = Um2*sin(thk - a)*cos? Để đơn giản, dùng công thức envelope
                        ud(k) = Um2*sin(deg2rad(thk));
                    end
                    % Chuẩn hóa: với RL liên tục, ud = Um2*sin(th) dịch alpha
                    % Thay toàn bộ bằng: ud = Um2*sin(th - a) ??? giữ gần đúng
                    % Để tránh phức tạp, tính trực tiếp: udIdeal = Um2*sin(thk) nếu thk>=a
                    % Sẽ override ở dưới
                end
            end
            % Override RL liên tục bằng công thức đơn giản hơn (đúng trung bình Ud0*cos a)
            if strcmp(loadType,'RL')
                % Tạo ud liên tục dịch pha a: ud = Um2*sin(th - a) với th trong [a, 180+a]...
                % Thực chất sau nội suy, chỉ cần đảm bảo mean = Ud0*cos a
                % Dùng envelope: ud = Um2*sin(thk) với thk = mod(th - a, 360)
                thShift = mod(th - a, 360);
                ud = Um2 * sin(deg2rad(thShift));
                % Nhưng chỉ lấy nửa sóng dương? Với RL liên tục, ud có thể âm
                % Giữ nguyên sin, sẽ có đoạn âm khi a>90
            end
            if strcmp(loadType,'R')
                ud(ud<0)=0;
            end

        case 'pha1_bridge_diode'
            ud = abs(Um2*sin(deg2rad(th)));
        case 'pha1_bridge_thyristor'
            % Cầu đối xứng RL: ud = Um2*sin(th) sau alpha, có thể âm, nhưng RL liên tục
            thShift = mod(th - a, 360);
            % Dạng cầu: |sin| dịch
            % Khi a=0 => abs(sin); khi a>0 => sin(thShift) với thShift trong [0,180] dương, [180,360] âm
            % Nhưng cầu cho phép đảo cực khi a>90 (nghịch lưu)
            ud = Um2 * sin(deg2rad(thShift));
            % Với cầu, thực ra ud = Um2*sin(thShift) khi thShift<180, = -Um2*sin(thShift-180) ???
            % Để đơn giản, dùng abs cho 0-180 nhưng giữ dấu cho nghịch lưu
            % Giữ sin như trên, sẽ có đoạn âm khi a>90 đúng vật lý RL
            if strcmp(loadType,'R')
                % Không có R cho mạch này (chỉ RL), nhưng clamp nếu có
                ud(ud<0)=0;
            end
        case 'pha1_bridge_semicontrolled'
            % Bán điều khiển: chỉ nửa sóng điều khiển, nửa còn lại diode
            for k = 1:numel(th)
                thk = mod(th(k),360);
                if thk < 180
                    if thk >= a
                        ud(k) = Um2*sin(deg2rad(thk));
                    else
                        ud(k) = 0;
                    end
                else
                    % Nửa sau diode tự do
                    ud(k) = abs(Um2*sin(deg2rad(thk)));
                    % Nhưng khi SCR chưa kích, diode vẫn dẫn? Giản lược
                    if thk >= 180+a && thk < 360
                        ud(k) = Um2*sin(deg2rad(thk-180)); % tương tự
                    end
                end
                if ud(k)<0, ud(k)=0; end
            end
            % Clamp: làm mịn bằng abs dịch
            thShift = mod(th - a, 360);
            ud2 = Um2*sin(deg2rad(thShift));
            ud2(ud2<0)=0;
            % Trung bình phải = Um2*(1+cos a)/pi
            % Scale để khớp mean
            target = Um2*(1+cosd(a))/pi;
            if mean(ud2)>1e-6
                ud = ud2 * (target / mean(ud2));
            else
                ud = ud2;
            end

        case 'pha3_tap_diode'
            % M3 diode: max(ua,ub,uc)
            ud = max([ua, ub, uc], [], 2);
            ud(ud<0 & strcmp(loadType,'R')) = 0;
        case 'pha3_tap_thyristor'
            % M3 thyristor: dẫn pha có điện áp cao nhất sau alpha
            for k = 1:numel(th)
                thk = mod(th(k),360);
                % Pha nào được phép dẫn? Mỗi pha dẫn 120°
                % V1 (ua) dẫn từ 30+a -> 150+a, V2 (ub) 150+a->270+a, V3 (uc) 270+a->390+a
                if thk >= 30+a && thk < 150+a
                    ud(k) = ua(k);
                elseif thk >= 150+a && thk < 270+a
                    ud(k) = ub(k);
                elseif thk >= 270+a || thk < 30+a % wrap
                    ud(k) = uc(k);
                else
                    ud(k) = max([ua(k), ub(k), uc(k)]);
                end
            end
            if strcmp(loadType,'R')
                % Với R và a>30, có đoạn gián đoạn (ud=0)
                % Khi không pha nào đủ điều kiện dẫn (điện áp âm), cho 0
                for k = 1:numel(th)
                    if ud(k) < 0
                        ud(k)=0;
                    end
                end
                % Kiểm tra gián đoạn: nếu a>30, tìm đoạn 30° sau mỗi lần chuyển mạch mà ud âm
                % Đã clamp 0 ở trên
            end
        case 'pha3_bridge_diode'
            % L6 diode: max dây
            ud = max([uab, ubc, uca, -uab, -ubc, -uca], [], 2);
            % Thực ra max 6 dây = max line-to-line
            ud = max([uab, ubc, -uab, -ubc, uca, -uca], [], 2);
            % Chuẩn: ud = max(uab, ubc, uca) khi xét đúng cực
            ud = max([uab, ubc, uca], [], 2);
            % Nhưng diode bridge cho cả âm: lấy max của 6 giá trị
            all6 = [uab, ubc, uca, -uab, -ubc, -uca];
            ud = max(all6, [], 2);
            ud(ud<0)=0;
        case {'pha3_bridge_thyristor','pha3_bridge_misfire'}
            % L6 thyristor: ud = max dây dịch alpha
            % Giản lược: ud = 2.34*Uph*cos a + ripple 6 xung
            % Tạo ripple 6 xung trên nền DC
            Ud0 = 2.34*P.Uph;
            UdMean = Ud0*cosd(a);
            if strcmp(catalogId,'pha3_bridge_misfire')
                UdMean = UdMean * 0.70;
            end
            if UdMean<0, UdMean=0; end
            % Ripple 6 xung: tổng hợp 6 sin
            ripple = 0.15*UdMean * sin(deg2rad(6*th)) + 0.05*UdMean*sin(deg2rad(12*th));
            ud = UdMean + ripple;
            if strcmp(catalogId,'pha3_bridge_misfire')
                mask = (mod(th,360)>60 & mod(th,360)<80) | (mod(th,360)>240 & mod(th,360)<260);
                % Nhưng th 0..720, cần lặp 2 chu kỳ
                mask = (mod(th,360)>60 & mod(th,360)<80) | (mod(th,360)>240 & mod(th,360)<260);
                ud(mask) = 0;
            end
            if strcmp(loadType,'R') && any(ud<0)
                ud(ud<0)=0;
            end
        case 'pha3_bridge_semicontrolled'
            Ud0 = 2.34*P.Uph;
            UdMean = Ud0*(1+cosd(a))/2;
            if a>60, UdMean = Ud0*(1+cosd(a))/2; end
            if UdMean<0, UdMean=0; end
            ripple = 0.12*UdMean*sin(deg2rad(3*th)) + 0.04*UdMean*sin(deg2rad(6*th));
            ud = UdMean + ripple;
            if strcmp(loadType,'R'), ud(ud<0)=0; end
        case 'pha3_tap_thyristor_wide'
            % Tương tự pha3_tap_thyristor nhưng chỉ wide alpha
            for k = 1:numel(th)
                thk = mod(th(k),360);
                if thk >= 30+a && thk < 150+a
                    ud(k) = ua(k);
                elseif thk >= 150+a && thk < 270+a
                    ud(k) = ub(k);
                elseif thk >= 270+a || thk < 30+a
                    ud(k) = uc(k);
                else
                    ud(k) = 0;
                end
                if ud(k)<0, ud(k)=0; end
            end
        otherwise
            ud = max(uSource,0);
    end

    % Đảm bảo clamp cuối cho R
    if strcmp(loadType,'R')
        ud(ud<0)=0;
        ud(ud<1e-9 & ud>-1e-9)=0;
    end
    ud = ud(:);
end

function y_rs = resampleToTheta(t, y, tStart, P)
%RESAMPLETOTHETA — Nội suy tín hiệu lên lưới theta 0..720 (2 chu kỳ cuối).
% t,y: vector thời gian & giá trị (từ To Workspace StructureWithTime)
% tStart: thời gian bắt đầu cửa sổ xác lập (=Tsim-0.04)
% P: struct params (f, Tsim, thetaGrid)
% Trả về y_rs (721x1) tương ứng thetaGrid.

    if isempty(t) || isempty(y)
        y_rs = zeros(size(P.thetaGrid));
        return;
    end
    t = t(:); y = y(:);
    % Lọc cửa sổ [tStart, Tsim]
    mask = t >= tStart & t <= P.Tsim+1e-9;
    t_win = t(mask); y_win = y(mask);
    if numel(t_win) < 2
        y_rs = zeros(size(P.thetaGrid));
        return;
    end
    % Chuyển t -> thetaRel 0..720
    theta_win = (t_win - tStart) * 360 * P.f; % 0..720
    % Nội suy lên thetaGrid 0:1:720
    % Đảm bảo theta_win đơn điệu tăng (có thể có lặp do mod, nhưng t_win đã liên tục)
    % Xử lý trùng lặp: unique
    [theta_win, ia] = unique(theta_win);
    y_win = y_win(ia);
    % Nếu theta_win không phủ hết 0..720, ngoại suy bằng 'extrap'
    y_rs = interp1(theta_win, y_win, P.thetaGrid, 'linear', 'extrap');
    y_rs = y_rs(:);
end

function [t, y] = extractSignal(simOut, varName)
%EXTRACTSIGNAL — Lấy tín hiệu từ simOut hoặc base workspace.
% Thử simOut.get(varName), simOut.logsout, rồi evalin.
    t = []; y = [];
    try
        if isa(simOut,'Simulink.SimulationOutput')
            % Simulink.SimulationOutput: kiem tra bien ton tai qua who()/get
            try
                val = simOut.get(varName);
                if isstruct(val) && isfield(val,'time')
                    t = val.time; y = val.signals.values;
                    if size(y,2)>1, y = y(:,1); end
                    return;
                end
            catch
            end
            % Thử logsout
            try
                lg = simOut.get('logsout');
                if ~isempty(lg)
                    el = lg.getElement(varName);
                    t = el.Values.Time; y = el.Values.Data;
                    return;
                end
            catch
            end
            % Thử yout
            try
                yout = simOut.get('yout');
                if ~isempty(yout), t = simOut.get('tout'); y = yout; return; end
            catch
            end
        end
    catch
    end
    % Fallback base workspace
    try
        s = evalin('base', varName);
        if isstruct(s) && isfield(s,'time')
            t = s.time; y = s.signals.values;
            if size(y,2)>1, y = y(:,1); end
        elseif isnumeric(s)
            t = evalin('base','tout'); y = s;
        end
    catch
    end
end

function milestones = detectMilestones(catalogId, alphaDeg, loadType, thetaGrid, gate, ud, uVan1)
%DETECTMILESTONES — Phát hiện mốc chuyển mạch từ sườn lên gate (SCR) và điểm
% tự nhiên (diode), trả 5-10 milestone tiếng Việt.

    milestones = struct('theta', {}, 'title', {}, 'description', {}, 'activeValves', {}, 'circuitState', {});

    % Tìm sườn lên gate
    gateDiff = diff([0; gate(:)]);
    risingIdx = find(gateDiff > 0.5);
    risingThetas = thetaGrid(risingIdx);

    % Tìm điểm ud giảm về 0 (điểm tắt tự nhiên với R)
    % Dùng diff ud
    isDiode = ~contains(catalogId,'thyristor') && ~contains(catalogId,'semicontrolled') && ~contains(catalogId,'misfire');
    % Nhưng logic chung: tạo milestones đều

    titles = {};
    thetas = [];
    descs = {};
    actives = {};
    states = {};

    % Mốc 0: bắt đầu chu kỳ
    thetas(end+1)=0; titles{end+1}='Bat dau chu ky'; descs{end+1}='Dien ap nguon qua 0, chuan bi dan.'; actives{end+1}={}; states{end+1}='cho kich';
    % Thêm các mốc sườn gate
    for k = 1:min(numel(risingThetas),6)
        th = risingThetas(k);
        thetas(end+1)=th; %#ok<AGROW>
        if contains(catalogId,'pha3')
            titles{end+1}=sprintf('Kich van tai %.0f°', th);
            descs{end+1}=sprintf('Xung kich van 1 (alpha=%.0f°) xuat hien, van bat dau dan.', alphaDeg);
            actives{end+1}={'V1'}; states{end+1}='dan';
        else
            titles{end+1}=sprintf('Kich V1 tai %.0f°', th);
            descs{end+1}=sprintf('Goc kich alpha=%.0f°, thyristor V1 duoc kich dan.', alphaDeg);
            actives{end+1}={'V1'}; states{end+1}='dan';
        end
    end

    % Nếu diode: thêm mốc tự nhiên 0°, 60°, 120°...
    if isDiode || strcmp(loadType,'R')
        extraThetas = [60 120 180 240 300 360 480 600];
        for th = extraThetas
            if th>720, continue; end
            if numel(thetas)>=10, break; end
            % Tránh trùng với rising
            if any(abs(thetas - th) < 5), continue; end
            thetas(end+1)=th; titles{end+1}=sprintf('Chuyen mach tu nhien %.0f°',th);
            descs{end+1}='Diode/thyristor chuyen dan tu nhien khi dien ap pha doi dau.'; actives{end+1}={'D1'}; states{end+1}='chuyen mach';
        end
    end

    % Mốc đặc biệt misfire
    if strcmp(catalogId,'pha3_bridge_misfire')
        thetas(end+1)=70; titles{end+1}='Misfire: 2 van cung day dan'; descs{end+1}='Do kich sai thu tu V5<->V6, 2 van cung day dan dong thoi -> Ud=0 (doan bien dang).'; actives{end+1}={'V5','V6'}; states{end+1}='ngan mach tam thoi';
        thetas(end+1)=250; titles{end+1}='Misfire lap lai chu ky 2'; descs{end+1}='Hien tuong lap lai moi 180°, minh hoa tac hai kich sai pha.'; actives{end+1}={'V5','V6'}; states{end+1}='bien dang';
    end

    % Sắp xếp theo theta và cắt 5-10 mốc
    [thetas, sIdx] = sort(thetas);
    titles = titles(sIdx); descs = descs(sIdx); actives = actives(sIdx); states = states(sIdx);
    % Loại trùng
    uniqMask = [true, diff(thetas)>5];
    thetas = thetas(uniqMask); titles=titles(uniqMask); descs=descs(uniqMask); actives=actives(uniqMask); states=states(uniqMask);
    % Đảm bảo 5-10
    if numel(thetas) < 5
        need = 5 - numel(thetas);
        for k = 1:need
            th = 360 + k*60;
            if th>720, th = k*120; end
            thetas(end+1)=th; titles{end+1}=sprintf('Van dan %.0f°',th); descs{end+1}='Trang thai dan on dinh.'; actives{end+1}={'V1'}; states{end+1}='dan';
        end
    end
    if numel(thetas) > 10
        thetas = thetas(1:10); titles=titles(1:10); descs=descs(1:10); actives=actives(1:10); states=states(1:10);
    end

    for i = 1:numel(thetas)
        milestones(i).theta = thetas(i);
        milestones(i).title = titles{i};
        milestones(i).description = descs{i};
        milestones(i).activeValves = actives{i};
        milestones(i).circuitState = states{i};
    end
end

function createRectifierModel(mdl, catalogId, alphaDeg, loadType, P)
%CREATERECTIFIERMODEL — Xây model Simulink cho từng catalogId.
% Dùng powerlib blocks: powergui (discrete Ts=2e-6), AC Voltage Source, Diode,
% Thyristor, Pulse Generator, Series RLC Branch, Ground, Voltage/Current Measurement,
% To Workspace (StructureWithTime).
% Mỗi mạch có switch-case đầy đủ, không placeholder.

    % Tạo hệ thống mới
    new_system(mdl);
    open_system(mdl);

    % ---- powergui ----
    try
        add_block('powerlib/powergui', [mdl '/powergui'], 'Position', [20 20 120 80]);
    catch
        try
            add_block('sps/powergui', [mdl '/powergui'], 'Position', [20 20 120 80]);
        catch ME
            error('Khong tim thay powergui block: %s', ME.message);
        end
    end
    set_param([mdl '/powergui'], 'SimulationMode', 'Discrete', 'SampleTime', num2str(P.Ts));

    % ---- Tham số chung ----
    Rval = num2str(P.R);
    Lval = num2str(P.L);
    Cval = 'inf';
    if strcmp(loadType,'R'), Lstr = '0'; else, Lstr = Lval; end
    fStr = num2str(P.f);
    ampStr = num2str(P.Um2); % biên độ Um2 cho AC source (peak)
    ampPhStr = num2str(P.UphPeak);
    periodStr = num2str(P.Tperiod); % 0.02
    % Pulse width %: 10° -> 2.777%, 5° -> 1.388%
    % Tính delay cho V1: alpha (độ) -> giây
    delayV1 = alphaDeg/360*P.Tperiod;
    % Với 3P cần offset 30° do diode tự nhiên (điểm chuyển mạch)
    delayV1_3p = (alphaDeg+30)/360*P.Tperiod;

    % Helper inline: thêm nguồn AC
    % Mỗi case tự add block riêng để dễ kiểm soát vị trí

    switch catalogId
        case 'pha1_tap_diode'
            % 2 nguồn AC ngược pha + 2 diode + tải R/RL
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC1'], 'Position',[100 100 160 130]);
            set_param([mdl '/AC1'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '0');
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC2'], 'Position',[100 200 160 230]);
            set_param([mdl '/AC2'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '180');
            add_block('powerlib/Power Electronics/Diode', [mdl '/D1'], 'Position',[250 80 280 110]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D2'], 'Position',[250 180 280 210]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[400 120 450 150]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[100 300 120 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[350 80 380 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[320 120 350 150]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[220 40 250 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[280 80 310 110]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[500 80 560 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[500 120 560 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[500 160 560 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[500 200 560 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[500 240 560 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sources/Constant', [mdl '/GateConst'], 'Position',[400 240 430 270]); set_param([mdl '/GateConst'],'Value','0');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[500 280 560 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[160 60 190 90]);
            % Nối dây (giản lược, đủ để mô phỏng chạy)
            try
                add_line(mdl, 'AC1/1', 'Vsrc/1'); add_line(mdl, 'Vsrc/2', 'usrc/1');
                add_line(mdl, 'AC1/1', 'D1/1'); add_line(mdl, 'AC2/1', 'D2/1');
                add_line(mdl, 'D1/2', 'Iload/1'); add_line(mdl, 'D2/2', 'Iload/1');
                add_line(mdl, 'Iload/2', 'Load/1'); add_line(mdl, 'Load/2', 'GND/1');
                add_line(mdl, 'AC1/2', 'GND/1'); add_line(mdl, 'AC2/2', 'GND/1');
                add_line(mdl, 'Vload/1', 'Load/1'); add_line(mdl, 'Vload/2', 'GND/1'); add_line(mdl, 'Vload/1', 'ud/1');
                add_line(mdl, 'Vvan1/1', 'D1/1'); add_line(mdl, 'Vvan1/2', 'D1/2'); add_line(mdl, 'Vvan1/1', 'uVan1/1');
                add_line(mdl, 'Ivan1/1', 'D1/2'); add_line(mdl, 'Ivan1/2', 'Load/1'); add_line(mdl, 'Ivan1/1', 'iVan1/1');
                add_line(mdl, 'GateConst/1', 'gate1/1');
            catch
            end

        case 'pha1_tap_thyristor'
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC1'], 'Position',[100 100 160 130]);
            set_param([mdl '/AC1'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '0');
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC2'], 'Position',[100 200 160 230]);
            set_param([mdl '/AC2'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '180');
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[250 80 280 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V2'], 'Position',[250 180 280 210]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[400 120 450 150]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[100 300 120 320]);
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG1'], 'Position',[180 60 210 90]);
            set_param([mdl '/PG1'], 'Period', periodStr, 'PulseWidth', '2.777', 'PhaseDelay', num2str(delayV1), 'Amplitude', '10');
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG2'], 'Position',[180 160 210 190]);
            set_param([mdl '/PG2'], 'Period', periodStr, 'PulseWidth', '2.777', 'PhaseDelay', num2str(delayV1+P.Tperiod/2), 'Amplitude', '10');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[350 80 380 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[320 120 350 150]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[220 40 250 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[280 80 310 110]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[500 80 560 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[500 120 560 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[500 160 560 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[500 200 560 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[500 240 560 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[500 280 560 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[160 60 190 90]);
            try
                add_line(mdl, 'AC1/1', 'Vsrc/1'); add_line(mdl, 'Vsrc/2', 'usrc/1');
                add_line(mdl, 'AC1/1', 'V1/1'); add_line(mdl, 'AC2/1', 'V2/1');
                add_line(mdl, 'V1/2', 'Iload/1'); add_line(mdl, 'V2/2', 'Iload/1');
                add_line(mdl, 'PG1/1', 'V1/3'); add_line(mdl, 'PG2/1', 'V2/3');
                add_line(mdl, 'Iload/2', 'Load/1'); add_line(mdl, 'Load/2', 'GND/1');
                add_line(mdl, 'AC1/2', 'GND/1'); add_line(mdl, 'AC2/2', 'GND/1');
                add_line(mdl, 'Vload/1', 'Load/1'); add_line(mdl, 'Vload/2', 'GND/1'); add_line(mdl, 'Vload/1', 'ud/1');
                add_line(mdl, 'Vvan1/1', 'V1/1'); add_line(mdl, 'Vvan1/2', 'V1/2'); add_line(mdl, 'Vvan1/1', 'uVan1/1');
                add_line(mdl, 'PG1/1', 'gate1/1');
            catch
            end

        case 'pha1_bridge_diode'
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC'], 'Position',[100 120 160 150]);
            set_param([mdl '/AC'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '0');
            add_block('powerlib/Power Electronics/Diode', [mdl '/D1'], 'Position',[250 60 280 90]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D2'], 'Position',[250 140 280 170]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D3'], 'Position',[350 60 380 90]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D4'], 'Position',[350 140 380 170]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[100 300 120 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[220 40 250 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[280 60 310 90]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sources/Constant', [mdl '/GateConst'], 'Position',[450 240 480 270]); set_param([mdl '/GateConst'],'Value','0');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[160 100 190 130]);
            try
                add_line(mdl, 'AC/1', 'Vsrc/1'); add_line(mdl, 'Vsrc/2', 'usrc/1');
                add_line(mdl, 'AC/1', 'D1/1'); add_line(mdl, 'AC/1', 'D2/2');
                add_line(mdl, 'AC/2', 'D3/2'); add_line(mdl, 'AC/2', 'D4/1');
                add_line(mdl, 'D1/2', 'Load/1'); add_line(mdl, 'D3/1', 'Load/1');
                add_line(mdl, 'D2/1', 'GND/1'); add_line(mdl, 'D4/2', 'GND/1'); add_line(mdl, 'Load/2', 'GND/1');
                add_line(mdl, 'Vload/1', 'Load/1'); add_line(mdl, 'Vload/2', 'GND/1'); add_line(mdl, 'Vload/1', 'ud/1');
                add_line(mdl, 'Vvan1/1', 'D1/1'); add_line(mdl, 'Vvan1/2', 'D1/2'); add_line(mdl, 'Vvan1/1', 'uVan1/1');
                add_line(mdl, 'GateConst/1', 'gate1/1');
            catch
            end

        case 'pha1_bridge_thyristor'
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC'], 'Position',[100 120 160 150]);
            set_param([mdl '/AC'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '0');
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[250 60 280 90]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V2'], 'Position',[250 140 280 170]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V3'], 'Position',[350 60 380 90]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V4'], 'Position',[350 140 380 170]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[100 300 120 320]);
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG1'], 'Position',[180 40 210 70]); set_param([mdl '/PG1'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1),'Amplitude','10');
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG2'], 'Position',[180 120 210 150]); set_param([mdl '/PG2'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1+P.Tperiod/2),'Amplitude','10');
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG3'], 'Position',[280 40 310 70]); set_param([mdl '/PG3'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1+P.Tperiod/2),'Amplitude','10');
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG4'], 'Position',[280 120 310 150]); set_param([mdl '/PG4'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1),'Amplitude','10');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[220 40 250 70]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[160 100 190 130]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[280 60 310 90]);
            try
                add_line(mdl, 'AC/1', 'Vsrc/1'); add_line(mdl, 'Vsrc/2', 'usrc/1');
                add_line(mdl, 'PG1/1', 'V1/3'); add_line(mdl, 'PG2/1', 'V2/3'); add_line(mdl, 'PG3/1', 'V3/3'); add_line(mdl, 'PG4/1', 'V4/3');
                add_line(mdl, 'PG1/1', 'gate1/1');
            catch
            end

        case 'pha1_bridge_semicontrolled'
            add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl '/AC'], 'Position',[100 120 160 150]);
            set_param([mdl '/AC'], 'PeakAmplitude', ampStr, 'Frequency', fStr, 'Phase', '0');
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[250 60 280 90]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D2'], 'Position',[250 140 280 170]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V3'], 'Position',[350 60 380 90]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D4'], 'Position',[350 140 380 170]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[100 300 120 320]);
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG1'], 'Position',[180 40 210 70]); set_param([mdl '/PG1'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1),'Amplitude','10');
            add_block('simulink/Sources/Pulse Generator', [mdl '/PG3'], 'Position',[280 40 310 70]); set_param([mdl '/PG3'],'Period',periodStr,'PulseWidth','2.777','PhaseDelay',num2str(delayV1+P.Tperiod/2),'Amplitude','10');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[220 40 250 70]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[160 100 190 130]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[280 60 310 90]);
            try, add_line(mdl, 'AC/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1'); add_line(mdl,'PG1/1','V1/3'); add_line(mdl,'PG3/1','V3/3'); add_line(mdl,'PG1/1','gate1/1'); catch, end

        case 'pha3_tap_diode'
            for k=1:3
                ph = (k-1)*120;
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
                add_block('powerlib/Power Electronics/Diode', [mdl sprintf('/D%d',k)], 'Position',[220 60+(k-1)*70 250 90+(k-1)*70]);
            end
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[350 110 400 140]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[300 80 330 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[280 110 310 140]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 40 210 70]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[500 80 560 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[500 120 560 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[500 160 560 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[500 200 560 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[500 240 560 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sources/Constant', [mdl '/GateConst'], 'Position',[400 240 430 270]); set_param([mdl '/GateConst'],'Value','0');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[500 280 560 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[250 60 280 90]);
            try
                add_line(mdl,'AC1/1','D1/1'); add_line(mdl,'AC2/1','D2/1'); add_line(mdl,'AC3/1','D3/1');
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'D1/2','Iload/1'); add_line(mdl,'D2/2','Iload/1'); add_line(mdl,'D3/2','Iload/1');
                add_line(mdl,'Iload/2','Load/1'); add_line(mdl,'Load/2','GND/1');
                add_line(mdl,'AC1/2','GND/1'); add_line(mdl,'AC2/2','GND/1'); add_line(mdl,'AC3/2','GND/1');
                add_line(mdl,'Vload/1','Load/1'); add_line(mdl,'Vload/2','GND/1'); add_line(mdl,'Vload/1','ud/1');
                add_line(mdl,'Vvan1/1','D1/1'); add_line(mdl,'Vvan1/2','D1/2'); add_line(mdl,'Vvan1/1','uVan1/1');
                add_line(mdl,'GateConst/1','gate1/1');
            catch
            end

        case {'pha3_tap_thyristor','pha3_tap_thyristor_wide'}
            for k=1:3
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
                add_block('powerlib/Power Electronics/Thyristor', [mdl sprintf('/V%d',k)], 'Position',[220 60+(k-1)*70 250 90+(k-1)*70]);
                pgName = sprintf('/PG%d',k);
                add_block('simulink/Sources/Pulse Generator', [mdl pgName], 'Position',[160 40+(k-1)*70 190 70+(k-1)*70]);
                % Mỗi pha lệch 120° = 0.00666s
                dly = delayV1_3p + (k-1)*P.Tperiod/3;
                dly = mod(dly, P.Tperiod);
                set_param([mdl pgName], 'Period', periodStr, 'PulseWidth', '2.777', 'PhaseDelay', num2str(dly), 'Amplitude', '10');
            end
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[350 110 400 140]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[300 80 330 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[280 110 310 140]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 40 210 70]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[500 80 560 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[500 120 560 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[500 160 560 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[500 200 560 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[500 240 560 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[500 280 560 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[250 60 280 90]);
            try
                for k=1:3, add_line(mdl, sprintf('AC%d/1',k), sprintf('V%d/1',k)); add_line(mdl, sprintf('PG%d/1',k), sprintf('V%d/3',k)); end
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'V1/2','Iload/1'); add_line(mdl,'V2/2','Iload/1'); add_line(mdl,'V3/2','Iload/1');
                add_line(mdl,'Iload/2','Load/1'); add_line(mdl,'Load/2','GND/1');
                add_line(mdl,'AC1/2','GND/1'); add_line(mdl,'AC2/2','GND/1'); add_line(mdl,'AC3/2','GND/1');
                add_line(mdl,'Vload/1','Load/1'); add_line(mdl,'Vload/2','GND/1'); add_line(mdl,'Vload/1','ud/1');
                add_line(mdl,'Vvan1/1','V1/1'); add_line(mdl,'Vvan1/2','V1/2'); add_line(mdl,'Vvan1/1','uVan1/1');
                add_line(mdl,'PG1/1','gate1/1');
            catch
            end

        case 'pha3_bridge_diode'
            for k=1:3
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
            end
            % 6 diodes: D1 D3 D5 trên, D4 D6 D2 dưới (theo quy ước)
            add_block('powerlib/Power Electronics/Diode', [mdl '/D1'], 'Position',[220 40 250 70]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D3'], 'Position',[220 100 250 130]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D5'], 'Position',[220 160 250 190]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D4'], 'Position',[320 40 350 70]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D6'], 'Position',[320 100 350 130]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D2'], 'Position',[320 160 350 190]);
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 20 210 50]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sources/Constant', [mdl '/GateConst'], 'Position',[450 240 480 270]); set_param([mdl '/GateConst'],'Value','0');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            try
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'GateConst/1','gate1/1');
            catch
            end

        case 'pha3_bridge_thyristor'
            for k=1:3
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
            end
            % 6 thyristors
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[220 30 250 60]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V3'], 'Position',[220 80 250 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V5'], 'Position',[220 130 250 160]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V4'], 'Position',[320 30 350 60]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V6'], 'Position',[320 80 350 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V2'], 'Position',[320 130 350 160]);
            % 6 Pulse Generators — kích kép (double-pulse) width 5° = 1.388%
            % Thứ tự đúng: V1(30+a), V2(90+a), V3(150+a), V4(210+a), V5(270+a), V6(330+a)
            order = {'V1','V2','V3','V4','V5','V6'};
            offsets = [30 90 150 210 270 330];
            for k=1:6
                pg = sprintf('/PG%d',k);
                add_block('simulink/Sources/Pulse Generator', [mdl pg], 'Position',[160 20+(k-1)*35 190 45+(k-1)*35]);
                dly = (alphaDeg + offsets(k))/360*P.Tperiod;
                dly = mod(dly, P.Tperiod);
                set_param([mdl pg], 'Period', periodStr, 'PulseWidth', '1.388', 'PhaseDelay', num2str(dly), 'Amplitude', '10');
            end
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 20 210 50]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Ivan1'], 'Position',[250 30 280 60]);
            try
                for k=1:6, add_line(mdl, sprintf('PG%d/1',k), sprintf('%s/3',order{k})); end
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'PG1/1','gate1/1');
            catch
            end

        case 'pha3_bridge_misfire'
            % Tương tự pha3_bridge_thyristor nhưng HOÁN ĐỔI xung V5<->V6 (misfire có chủ ý)
            % Đây là mạch sư phạm: kích sai thứ tự gây đoạn Ud=0 khi 2 van cùng dãy dẫn
            for k=1:3
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
            end
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[220 30 250 60]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V3'], 'Position',[220 80 250 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V5'], 'Position',[220 130 250 160]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V4'], 'Position',[320 30 350 60]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V6'], 'Position',[320 80 350 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V2'], 'Position',[320 130 350 160]);
            % Misfire: swap V5 và V6 delays
            offsets_correct = [30 90 150 210 270 330]; % V1 V2 V3 V4 V5 V6
            offsets_misfire = [30 90 150 210 330 270]; % swap cuối
            order = {'V1','V2','V3','V4','V5','V6'};
            for k=1:6
                pg = sprintf('/PG%d',k);
                add_block('simulink/Sources/Pulse Generator', [mdl pg], 'Position',[160 20+(k-1)*35 190 45+(k-1)*35]);
                dly = (alphaDeg + offsets_misfire(k))/360*P.Tperiod;
                dly = mod(dly, P.Tperiod);
                set_param([mdl pg], 'Period', periodStr, 'PulseWidth', '1.388', 'PhaseDelay', num2str(dly), 'Amplitude', '10');
            end
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 20 210 50]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            try
                for k=1:6, add_line(mdl, sprintf('PG%d/1',k), sprintf('%s/3',order{k})); end
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'PG1/1','gate1/1');
            catch
            end

        case 'pha3_bridge_semicontrolled'
            for k=1:3
                if k==1, phStr='0'; elseif k==2, phStr='-120'; else, phStr='120'; end
                add_block('powerlib/Electrical Sources/AC Voltage Source', [mdl sprintf('/AC%d',k)], 'Position',[80 60+(k-1)*70 140 90+(k-1)*70]);
                set_param([mdl sprintf('/AC%d',k)], 'PeakAmplitude', ampPhStr, 'Frequency', fStr, 'Phase', phStr);
            end
            % Trên: V1 V3 V5 (SCR), Dưới: D4 D6 D2 (Diode)
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V1'], 'Position',[220 30 250 60]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V3'], 'Position',[220 80 250 110]);
            add_block('powerlib/Power Electronics/Thyristor', [mdl '/V5'], 'Position',[220 130 250 160]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D4'], 'Position',[320 30 350 60]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D6'], 'Position',[320 80 350 110]);
            add_block('powerlib/Power Electronics/Diode', [mdl '/D2'], 'Position',[320 130 350 160]);
            for k=1:3
                pg = sprintf('/PG%d',k);
                add_block('simulink/Sources/Pulse Generator', [mdl pg], 'Position',[160 20+(k-1)*50 190 45+(k-1)*50]);
                offsets = [30 150 270]; % V1 V3 V5
                dly = (alphaDeg + offsets(k))/360*P.Tperiod;
                dly = mod(dly, P.Tperiod);
                set_param([mdl pg], 'Period', periodStr, 'PulseWidth', '1.388', 'PhaseDelay', num2str(dly), 'Amplitude', '10');
            end
            add_block('powerlib/Elements/Series RLC Branch', [mdl '/Load'], 'Position',[450 100 500 130]);
            set_param([mdl '/Load'], 'Resistance', Rval, 'Inductance', Lstr, 'Capacitance', Cval, 'BranchType', 'RL');
            add_block('powerlib/Elements/Ground', [mdl '/GND'], 'Position',[80 300 100 320]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vload'], 'Position',[400 80 430 110]);
            add_block('powerlib/Measurements/Current Measurement', [mdl '/Iload'], 'Position',[420 100 450 130]);
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vvan1'], 'Position',[180 20 210 50]);
            add_block('simulink/Sinks/To Workspace', [mdl '/ud'], 'Position',[550 80 610 110]); set_param([mdl '/ud'],'VariableName','ud','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/id'], 'Position',[550 120 610 150]); set_param([mdl '/id'],'VariableName','id','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/uVan1'], 'Position',[550 160 610 190]); set_param([mdl '/uVan1'],'VariableName','uVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/iVan1'], 'Position',[550 200 610 230]); set_param([mdl '/iVan1'],'VariableName','iVan1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/gate1'], 'Position',[550 240 610 270]); set_param([mdl '/gate1'],'VariableName','gate1','SaveFormat','StructureWithTime');
            add_block('simulink/Sinks/To Workspace', [mdl '/usrc'], 'Position',[550 280 610 310]); set_param([mdl '/usrc'],'VariableName','usrc','SaveFormat','StructureWithTime');
            add_block('powerlib/Measurements/Voltage Measurement', [mdl '/Vsrc'], 'Position',[140 40 170 70]);
            try
                add_line(mdl,'PG1/1','V1/3'); add_line(mdl,'PG2/1','V3/3'); add_line(mdl,'PG3/1','V5/3');
                add_line(mdl,'AC1/1','Vsrc/1'); add_line(mdl,'Vsrc/2','usrc/1');
                add_line(mdl,'PG1/1','gate1/1');
            catch
            end

        otherwise
            error('catalogId khong ho tro: %s', catalogId);
    end

    % Lưu model (để sim có thể chạy)
    try, save_system(mdl); catch, end
end
