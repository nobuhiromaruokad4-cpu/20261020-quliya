/**
 * スープチラー計算シミュレーター サーバーサイド物理計算サービス
 * (東北大学 多元物質科学研究所 伝熱解析モデル準拠)
 *
 * 計算ロジック・Nu/Re式・総括伝熱係数U・熱物性相関式を完全秘匿化
 */

export interface SimulateRequestParams {
  soup_mass?: number; // スープ質量 [kg]
  pot_diameter?: number; // 寸胴鍋内径 [mm]
  water_temp?: number; // 給水(水道水)温度 [℃]
  target_temp?: number; // 目標冷却温度 [℃] (デフォルト: 30)
  flow_rate?: number; // 冷却水流量 [L/min]
  rpm?: number; // 攪拌・回転数 [RPM]
  mode?: 'quliya' | 'coil' | 'sink' | 'rotary' | string; // 計算モード

  // オプションパラメータ (任意)
  start_temp?: number; // 初期スープ温度 [℃] (デフォルト: 95)
  pot_height?: number; // 寸胴鍋深さ [mm] (デフォルト: 390)
  room_temp?: number; // 室温 [℃] (デフォルト: 25)
  room_rh?: number; // 湿度 [%] (デフォルト: 80)
  brix?: number; // Brix濃度 [%] (水相当: 0)
}

export interface SimulationSeriesPoint {
  time_min: number;
  soup_temp: number;
}

export interface SimulateResponseData {
  mode: 'quliya' | 'coil' | 'sink';
  time_to_target_min: number | null;
  total_water_used_L: number;
  series: SimulationSeriesPoint[];
  // マイルストーン（安全なサマリー値のみ）
  time_to_50c_min?: number | null;
  time_to_40c_min?: number | null;
  time_to_30c_min?: number | null;
  final_temp?: number;
}

export interface NormalizedSimulationParams {
  soup_mass: number;
  pot_diameter: number;
  water_temp: number;
  target_temp: number;
  flow_rate: number;
  rpm: number;
  mode: 'quliya' | 'coil' | 'sink';
  start_temp: number;
  pot_height: number;
  room_temp: number;
  room_rh: number;
  brix: number;
}

/**
 * 入力バリデーション及び正規化
 */
export function validateAndNormalizeParams(
  input: Record<string, any>
): { valid: true; params: NormalizedSimulationParams } | { valid: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'リクエストボディが空または無効なJSONです。' };
  }

  // camelCase または snake_case の両方に対応
  const rawSoupMass = input.soup_mass ?? input.soupMass ?? input.Soup_mass ?? 45;
  const rawPotDiam = input.pot_diameter ?? input.potDiameter ?? input.Pot_D_mm ?? 450;
  const rawWaterTemp = input.water_temp ?? input.waterTemp ?? input.TapTemp ?? 18;
  const rawTargetTemp = input.target_temp ?? input.targetTemp ?? input.customTargetTemp ?? 30;
  const rawFlowRate = input.flow_rate ?? input.flowRate ?? input.TapFlow ?? 18;
  const rawRpm = input.rpm ?? input.RPM ?? 70;
  const rawMode = (input.mode ?? input.chillerType ?? 'quliya').toString().toLowerCase();
  const rawStartTemp = input.start_temp ?? input.startTemp ?? input.StartTemp ?? 95;
  const rawPotHeight = input.pot_height ?? input.potHeight ?? input.Pot_H_mm ?? 390;
  const rawRoomTemp = input.room_temp ?? input.roomTemp ?? input.RoomTemp ?? 25;
  const rawRoomRH = input.room_rh ?? input.roomRH ?? input.RoomRH ?? 80;
  const rawBrix = input.brix ?? input.Brix ?? 0;

  // 数値型チェック
  const soup_mass = Number(rawSoupMass);
  const pot_diameter = Number(rawPotDiam);
  const water_temp = Number(rawWaterTemp);
  const target_temp = Number(rawTargetTemp);
  const flow_rate = Number(rawFlowRate);
  const rpm = Number(rawRpm);
  const start_temp = Number(rawStartTemp);
  const pot_height = Number(rawPotHeight);
  const room_temp = Number(rawRoomTemp);
  const room_rh = Number(rawRoomRH);
  const brix = Number(rawBrix);

  if (isNaN(soup_mass) || soup_mass <= 0 || soup_mass > 1000) {
    return { valid: false, error: 'soup_mass(スープ質量)は 1〜1000 [kg] の範囲で指定してください。' };
  }

  if (isNaN(pot_diameter) || pot_diameter < 100 || pot_diameter > 1500) {
    return { valid: false, error: 'pot_diameter(寸胴鍋内径)は 100〜1500 [mm] の範囲で指定してください。' };
  }

  if (isNaN(water_temp) || water_temp < 0 || water_temp > 50) {
    return { valid: false, error: 'water_temp(給水温度)は 0〜50 [℃] の範囲で指定してください。' };
  }

  if (isNaN(target_temp) || target_temp < 5 || target_temp > 95) {
    return { valid: false, error: 'target_temp(目標温度)は 5〜95 [℃] の範囲で指定してください。' };
  }

  if (isNaN(flow_rate) || flow_rate <= 0 || flow_rate > 100) {
    return { valid: false, error: 'flow_rate(冷却水流量)は 1〜100 [L/min] の範囲で指定してください。' };
  }

  if (isNaN(rpm) || rpm < 0 || rpm > 1500) {
    return { valid: false, error: 'rpm(回転数)は 0〜1500 [RPM] の範囲で指定してください。' };
  }

  if (isNaN(start_temp) || start_temp <= target_temp || start_temp > 100) {
    return { valid: false, error: `start_temp(初期温度: ${start_temp}℃)は target_temp(目標温度: ${target_temp}℃) より高く、100℃以下である必要があります。` };
  }

  // 物理的制約: 目標温度 < 水道水温
  if (target_temp < water_temp) {
    return {
      valid: false,
      error: `目標冷却温度 (${target_temp}℃) は給水温度 (${water_temp}℃) 以上に設定してください。水冷方式では給水温度未満まで冷却することは物理的に不可能です。`,
    };
  }

  // モード正規化
  let mode: 'quliya' | 'coil' | 'sink' = 'quliya';
  if (rawMode === 'coil') {
    mode = 'coil';
  } else if (rawMode === 'sink') {
    mode = 'sink';
  } else if (rawMode === 'quliya' || rawMode === 'rotary') {
    mode = 'quliya';
  } else {
    return { valid: false, error: "modeは 'quliya', 'coil', 'sink' のいずれかを指定してください。" };
  }

  return {
    valid: true,
    params: {
      soup_mass,
      pot_diameter,
      water_temp,
      target_temp,
      flow_rate,
      rpm,
      mode,
      start_temp,
      pot_height: isNaN(pot_height) ? 390 : pot_height,
      room_temp: isNaN(room_temp) ? 25 : room_temp,
      room_rh: isNaN(room_rh) ? 80 : room_rh,
      brix: isNaN(brix) ? 0 : brix,
    },
  };
}

/**
 * 内部物性推算
 */
function getViscosity(Tc: number, Brix: number): number {
  const Tk = Tc + 273.15;
  const muWater = 2.414e-5 * Math.pow(10, 247.8 / (Tk - 140));
  return muWater * Math.pow(10, 0.05 * Brix);
}

function getDensity(Tc: number, Brix: number): number {
  return 1000.0 - Math.pow(Tc - 4.0, 2) / 180.0 + 5.0 * Brix;
}

function getCp(Brix: number): number {
  return (4.186 - 0.03 * Brix) * 1000.0;
}

/**
 * サーバーサイド熱収支シミュレーション計算
 *
 * 【要件遵守】
 * 1. タイムステップ Δt = 60秒 (1分刻み) で数値解析
 * 2. 熱収支式: Q_total = Q_water + Q_evap + Q_loss
 *    - コイル式・シンク式は回転数=0(攪拌なし)、冷却水流量(flow_rate)の影響のみを受ける
 * 3. スープ温度 ΔT = (Q_total * Δt) / (m * Cp)
 * 4. 目標温度到達時間および総水道使用量算出
 * 5. レスポンスは中間物理量(U, Re, Q)を含めず最小限のみ返却
 */
export function runServerSimulation(p: NormalizedSimulationParams): SimulateResponseData {
  const mode = p.mode;

  // コイル式・シンク式は回転数=0 (流量の影響のみ受ける)
  const effectiveRPM = (mode === 'sink' || mode === 'coil') ? 0.0 : p.rpm;

  const Pot_Radius_m = p.pot_diameter / 2000.0;
  const Pot_Diam_m = p.pot_diameter / 1000.0;
  const Pot_Height_m = p.pot_height / 1000.0;
  const Liq_Area_m2 = Math.PI * Math.pow(Pot_Radius_m, 2);
  const Cp_Soup = getCp(p.brix);

  // 伝熱面積及び総括伝熱係数
  let Ex_Area_m2 = 0.0;
  let effectiveExD = 100.0; // mm
  let fixedU: number | null = null;

  if (mode === 'sink') {
    const bottomArea = Math.PI * Math.pow(Pot_Radius_m, 2);
    const halfSideArea = Pot_Diam_m * Math.PI * (Pot_Height_m / 2.0);
    Ex_Area_m2 = bottomArea + halfSideArea;
    fixedU = 100.0;
  } else if (mode === 'coil') {
    effectiveExD = 9.52;
    const effectiveExL = 10000.0; // 10m
    Ex_Area_m2 = (effectiveExD / 1000.0) * Math.PI * (effectiveExL / 1000.0);
    fixedU = 200.0;
  } else {
    // QULIYA Rotary Chiller
    effectiveExD = 100.0;
    const effectiveExL = 300.0;
    Ex_Area_m2 = (effectiveExD / 1000.0) * Math.PI * (effectiveExL / 1000.0);
  }

  // 飽和蒸気圧 (Tetens式)
  const Psat_r = 0.611 * Math.exp((17.27 * p.room_temp) / (p.room_temp + 237.3));

  // 1ステップあたりの微分導関数計算
  const calcDeriv = (Tc: number): number => {
    const Rho_Curr = getDensity(Tc, p.brix);
    const Mu_Curr = getViscosity(Tc, p.brix);
    const Vol_m3 = p.soup_mass / Rho_Curr;
    const H_liq = Vol_m3 / Liq_Area_m2;
    const Side_Area = Pot_Diam_m * Math.PI * H_liq;

    // 1. Q_evap (蒸発潜熱損失)
    // コイル・シンク式は effectiveRPM = 0 なので自然蒸発項のみ
    const Psat_p = 0.611 * Math.exp((17.27 * Tc) / (Tc + 237.3));
    const Coeff_Evap_B = 0.135;
    const Coeff_Evap_C = 1.57e-10;
    let Q_evap = (Coeff_Evap_B + Coeff_Evap_C * Math.pow(effectiveRPM, 3.0)) *
      Liq_Area_m2 *
      (Psat_p - (p.room_rh / 100.0) * Psat_r) *
      1000.0;
    if (Q_evap < 0) Q_evap = 0;

    // 2. Q_loss (自然放熱: 対流 + 放射)
    const exposedSideArea = mode === 'sink'
      ? Math.max(0, Pot_Diam_m * Math.PI * Math.max(0, H_liq - Pot_Height_m / 2.0))
      : Side_Area;
    const Coeff_Conv_A = 15.0;
    const Q_conv = Coeff_Conv_A * exposedSideArea * (Tc - p.room_temp);
    const Q_loss = Q_evap + Q_conv;

    // 3. Q_water (冷却水への抜熱量)
    let Q_water = 0.0;
    let U_val = 0.0;

    if (p.flow_rate > 0) {
      if (fixedU !== null) {
        U_val = fixedU;
      } else {
        // QULIYA動的Nu/Reモデル
        const n_rps = Math.max(effectiveRPM, 10.0) / 60.0;
        const D_char = effectiveExD / 1000.0;
        const Re_Rot = (Rho_Curr * n_rps * Math.pow(D_char, 2)) / Mu_Curr;

        const Rho_Tap = getDensity(p.water_temp, 0.0);
        const Mu_Tap = getViscosity(p.water_temp, 0.0);
        const Flow_m3s = Math.max(p.flow_rate, 0.1) / 60000.0;
        const Tube_D_m = effectiveExD / 1000.0;
        const Area_Tube = (Math.PI * Math.pow(Tube_D_m, 2)) / 4.0;
        const Velocity = Flow_m3s / Area_Tube;
        const Re_Tube = (Rho_Tap * Velocity * Tube_D_m) / Mu_Tap;

        const Alpha = 0.2588;
        const C_Re_Base = 3.8508;
        const Exp_Total = 0.6301;
        const Re_Total = Math.sqrt(Math.pow(Alpha * Re_Rot, 2) + Math.pow(Re_Tube, 2));
        U_val = C_Re_Base * Math.pow(Re_Total, Exp_Total);
      }

      // NTU法による冷却水抜熱量
      const M_dot = p.flow_rate / 60.0; // kg/s
      const Cap = M_dot * 4186.0; // W/K
      const NTU = (U_val * Ex_Area_m2) / Cap;
      const Eff = 1.0 - Math.exp(-NTU);
      Q_water = Eff * Cap * (Tc - p.water_temp);
    }

    const Q_total = Q_water + Q_loss;
    return -Q_total / (p.soup_mass * Cp_Soup);
  };

  // 時系列シミュレーション (1分刻み Δt = 60s)
  const series: SimulationSeriesPoint[] = [];
  let T_curr = p.start_temp;
  const targetT = p.target_temp;
  const maxMinutes = 180; // 最大3時間で保護打ち切り

  let timeTo50C: number | null = null;
  let timeTo40C: number | null = null;
  let timeTo30C: number | null = null;
  let timeToTarget: number | null = null;

  // t = 0 分
  series.push({
    time_min: 0,
    soup_temp: Number(T_curr.toFixed(1)),
  });

  for (let m = 1; m <= maxMinutes; m++) {
    const prevT = T_curr;
    const prevTime = m - 1;

    // 1分(60秒)間の数値積分 (2秒サブステップのRK4法で高精度・高安定)
    const subDt = 2.0;
    const subSteps = 30; // 30 * 2s = 60s
    for (let s = 0; s < subSteps; s++) {
      const k1 = calcDeriv(T_curr);
      const k2 = calcDeriv(T_curr + 0.5 * subDt * k1);
      const k3 = calcDeriv(T_curr + 0.5 * subDt * k2);
      const k4 = calcDeriv(T_curr + subDt * k3);
      T_curr += (subDt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4);
    }

    const interpolateTime = (targetThreshold: number): number => {
      const frac = (prevT - targetThreshold) / (prevT - T_curr);
      return prevTime + frac;
    };

    if (timeTo50C === null && prevT >= 50.0 && T_curr <= 50.0) {
      timeTo50C = interpolateTime(50.0);
    }
    if (timeTo40C === null && prevT >= 40.0 && T_curr <= 40.0) {
      timeTo40C = interpolateTime(40.0);
    }
    if (timeTo30C === null && prevT >= 30.0 && T_curr <= 30.0) {
      timeTo30C = interpolateTime(30.0);
    }
    if (timeToTarget === null && prevT >= targetT && T_curr <= targetT) {
      timeToTarget = interpolateTime(targetT);
    }

    // 1分毎のスープ温度を記録
    series.push({
      time_min: m,
      soup_temp: Number(T_curr.toFixed(1)),
    });

    // 目標温度に到達した時点で終了
    if (timeToTarget !== null) {
      break;
    }

    // 給水温度＋0.1℃に極限近接した場合は水冷限界のため終了
    if (T_curr <= p.water_temp + 0.1) {
      break;
    }
  }

  const roundedTargetTime = timeToTarget !== null ? Math.round(timeToTarget) : null;
  const totalWaterUsed = roundedTargetTime !== null ? Math.round(p.flow_rate * roundedTargetTime) : 0;

  return {
    mode,
    time_to_target_min: roundedTargetTime,
    total_water_used_L: totalWaterUsed,
    series,
    time_to_50c_min: timeTo50C !== null ? Math.round(timeTo50C) : null,
    time_to_40c_min: timeTo40C !== null ? Math.round(timeTo40C) : null,
    time_to_30c_min: timeTo30C !== null ? Math.round(timeTo30C) : null,
    final_temp: Number(T_curr.toFixed(1)),
  };
}
