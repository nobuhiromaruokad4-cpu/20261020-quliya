import { SimulationParams, SimulationResult, TimeStepData } from '../types/simulation';

/**
 * 撹拌式急速冷却シミュレーション (Agitated Immersion Cooling Simulation)
 * サーバーサイド専有物理計算コア (完全秘匿化)
 */

export function getViscosity(Tc: number, Brix: number): number {
  const Tk = Tc + 273.15;
  const muWater = 2.414e-5 * Math.pow(10, 247.8 / (Tk - 140));
  return muWater * Math.pow(10, 0.05 * Brix);
}

export function getDensity(Tc: number, Brix: number): number {
  return 1000.0 - (Math.pow(Tc - 4.0, 2) / 180.0) + 5.0 * Brix;
}

export function getCp(Brix: number): number {
  return (4.186 - 0.03 * Brix) * 1000.0;
}

export interface StateCalculationResult {
  dTdt: number;
  U: number;
  Q_cool: number;
  Re_Total: number;
  Re_Rot: number;
  Re_Tube: number;
  Q_loss: number;
  Q_evap: number;
  Q_conv: number;
  Latent_Ratio: number;
  Tap_Out: number;
}

export function calculateState(Tc: number, p: SimulationParams): StateCalculationResult {
  const mode = p.chillerType || 'rotary';
  const Pot_Radius_m = p.Pot_D_mm / 2000.0;
  const Pot_Diam_m = p.Pot_D_mm / 1000.0;
  const Pot_Height_m = (p.Pot_H_mm ?? 390.0) / 1000.0;
  const Liq_Area_m2 = Math.PI * Math.pow(Pot_Radius_m, 2);
  const Cp_Soup = getCp(p.Brix);

  const Rho_Curr = getDensity(Tc, p.Brix);
  const Mu_Curr = getViscosity(Tc, p.Brix);
  const Vol_m3 = p.Soup_mass / Rho_Curr;
  const H_liq = Vol_m3 / Liq_Area_m2;
  const Side_Area = Pot_Diam_m * Math.PI * H_liq;

  let Ex_Area_m2 = 0.0;
  let effectiveExD = p.Ex_D_mm;
  if (mode === 'sink') {
    const bottomArea = Math.PI * Math.pow(Pot_Radius_m, 2);
    const halfSideArea = Pot_Diam_m * Math.PI * (Pot_Height_m / 2.0);
    Ex_Area_m2 = bottomArea + halfSideArea;
  } else if (mode === 'coil') {
    effectiveExD = 9.52;
    const effectiveExL = 10000.0;
    Ex_Area_m2 = (effectiveExD / 1000.0) * Math.PI * (effectiveExL / 1000.0);
  } else {
    effectiveExD = p.Ex_D_mm;
    Ex_Area_m2 = (effectiveExD / 1000.0) * Math.PI * (p.Ex_L_mm / 1000.0);
  }

  const Psat_p = 0.611 * Math.exp((17.27 * Tc) / (Tc + 237.3));
  const Psat_r = 0.611 * Math.exp((17.27 * p.RoomTemp) / (p.RoomTemp + 237.3));

  // コイル式・シンク式は攪拌なし（回転数＝0）、冷却水流量の影響のみ受ける
  const effectiveRPM = (mode === 'sink' || mode === 'coil') ? 0.0 : p.RPM;

  let Q_evap = (p.Coeff_Evap_B + p.Coeff_Evap_C * Math.pow(effectiveRPM, 3.0)) *
    Liq_Area_m2 *
    (Psat_p - (p.RoomRH / 100.0) * Psat_r) *
    1000.0;
  if (Q_evap < 0) {
    Q_evap = 0;
  }

  const exposedSideArea = mode === 'sink' ? Math.max(0, Pot_Diam_m * Math.PI * Math.max(0, H_liq - Pot_Height_m / 2.0)) : Side_Area;
  const Q_conv = p.Coeff_Conv_A * exposedSideArea * (Tc - p.RoomTemp);
  const Q_loss = Q_evap + Q_conv;

  let Q_cool = 0.0;
  let U_val = 0.0;
  let Re_Total = 0.0;
  let Re_Rot = 0.0;
  let Re_Tube = 0.0;
  let T_Out = p.TapTemp;

  if (p.TapFlow > 0) {
    if (mode === 'sink') {
      U_val = p.fixedU ?? 100.0;
      Re_Total = 0.0;
    } else if (mode === 'coil') {
      U_val = p.fixedU ?? 200.0;
      Re_Total = 0.0;
    } else {
      const n_rps = Math.max(p.RPM, 10.0) / 60.0;
      const D_char = effectiveExD / 1000.0;
      Re_Rot = (Rho_Curr * n_rps * Math.pow(D_char, 2)) / Mu_Curr;

      const Rho_Tap = getDensity(p.TapTemp, 0.0);
      const Mu_Tap = getViscosity(p.TapTemp, 0.0);
      const Flow_m3s = Math.max(p.TapFlow, 0.1) / 60000.0;
      const Tube_D_m = effectiveExD / 1000.0;
      const Area_Tube = (Math.PI * Math.pow(Tube_D_m, 2)) / 4.0;
      const Velocity = Flow_m3s / Area_Tube;
      Re_Tube = (Rho_Tap * Velocity * Tube_D_m) / Mu_Tap;

      Re_Total = Math.sqrt(Math.pow(p.Alpha * Re_Rot, 2) + Math.pow(Re_Tube, 2));
      U_val = p.C_Re_Base * Math.pow(Re_Total, p.Exp_Total);
    }

    const M_dot = p.TapFlow / 60.0;
    const Cap = M_dot * 4186.0;

    const NTU = (U_val * Ex_Area_m2) / Cap;
    const Eff = 1.0 - Math.exp(-NTU);
    Q_cool = Eff * Cap * (Tc - p.TapTemp);
    T_Out = p.TapTemp + Q_cool / Cap;
  }

  let LatRatio = 0.0;
  if (Q_loss > 0) {
    LatRatio = (Q_evap / Q_loss) * 100.0;
  }

  const dTdt = -(Q_cool + Q_loss) / (p.Soup_mass * Cp_Soup);

  return {
    dTdt,
    U: U_val,
    Q_cool,
    Re_Total,
    Re_Rot,
    Re_Tube,
    Q_loss,
    Q_evap,
    Q_conv,
    Latent_Ratio: LatRatio,
    Tap_Out: T_Out,
  };
}

const PALETTE = [
  '#0284c7', // Sky Blue
  '#ea580c', // Orange
  '#16a34a', // Emerald Green
  '#9333ea', // Purple
  '#db2777', // Pink
  '#ca8a04', // Amber
  '#0891b2', // Cyan
  '#e11d48', // Rose
];

export function runSimulation(
  params: SimulationParams,
  caseId?: string,
  colorIndex: number = 0
): SimulationResult {
  const dt = params.dt > 0 ? params.dt : 2.0;
  const maxDisplaySeconds = (params.maxTimeMin || 120) * 60;
  const maxComputeSeconds = Math.max(maxDisplaySeconds, 24 * 3600);
  const targetCustom = params.customTargetTemp ?? 30.0;

  let T_curr = params.StartTemp;
  let Time = 0.0;
  let R50: number | null = null;
  let R40: number | null = null;
  let R30: number | null = null;
  let R20: number | null = null;
  let RTarget: number | null = null;
  let lastOut = -60.0;

  const timeSeries: TimeStepData[] = [];
  let uSum = 0;
  let qSum = 0;
  let maxQ = 0;
  let stepCount = 0;

  const initial = calculateState(T_curr, params);
  timeSeries.push({
    timeMin: 0,
    timeSec: 0,
    soupTemp: Number(T_curr.toFixed(2)),
    tapIn: Number(params.TapTemp.toFixed(1)),
    tapOut: Number(initial.Tap_Out.toFixed(2)),
    uVal: Number(initial.U.toFixed(1)),
    reTotal: Number(initial.Re_Total.toFixed(1)),
    reRot: Number(initial.Re_Rot.toFixed(1)),
    reTube: Number(initial.Re_Tube.toFixed(1)),
    qCool: Number(initial.Q_cool.toFixed(0)),
    qEvap: Number(initial.Q_evap.toFixed(0)),
    qConv: Number(initial.Q_conv.toFixed(0)),
    qLoss: Number(initial.Q_loss.toFixed(0)),
    latentRatio: Number(initial.Latent_Ratio.toFixed(1)),
    dTdt: Number(initial.dTdt.toFixed(4)),
  });

  lastOut = 0;
  uSum += initial.U;
  qSum += initial.Q_cool;
  maxQ = Math.max(maxQ, initial.Q_cool);
  stepCount++;

  while (Time <= maxComputeSeconds) {
    if (Time >= maxDisplaySeconds && RTarget !== null && (targetCustom > 20 || R20 !== null)) {
      break;
    }

    // 水道水温到達時は水温を維持して120分まで系列補完
    if (T_curr <= params.TapTemp + 0.05) {
      T_curr = params.TapTemp;
      while (Time < maxDisplaySeconds) {
        Time = Math.min(maxDisplaySeconds, Time + 60.0);
        const state = calculateState(T_curr, params);
        timeSeries.push({
          timeMin: Number((Time / 60.0).toFixed(2)),
          timeSec: Math.round(Time),
          soupTemp: Number(T_curr.toFixed(2)),
          tapIn: Number(params.TapTemp.toFixed(1)),
          tapOut: Number(state.Tap_Out.toFixed(2)),
          uVal: Number(state.U.toFixed(1)),
          reTotal: Number(state.Re_Total.toFixed(1)),
          reRot: Number(state.Re_Rot.toFixed(1)),
          reTube: Number(state.Re_Tube.toFixed(1)),
          qCool: 0,
          qEvap: 0,
          qConv: 0,
          qLoss: 0,
          latentRatio: 0,
          dTdt: 0,
        });
      }
      break;
    }

    const prevT = T_curr;
    const prevTime = Time;

    const k1 = calculateState(T_curr, params).dTdt;
    const k2 = calculateState(T_curr + 0.5 * dt * k1, params).dTdt;
    const k3 = calculateState(T_curr + 0.5 * dt * k2, params).dTdt;
    const k4 = calculateState(T_curr + dt * k3, params).dTdt;

    T_curr += (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4);
    Time += dt;

    const interpolateTime = (targetT: number) => {
      const frac = (prevT - targetT) / (prevT - T_curr);
      return (prevTime + frac * dt) / 60.0;
    };

    if (R50 === null && prevT >= 50.0 && T_curr <= 50.0) {
      R50 = interpolateTime(50.0);
    }
    if (R40 === null && prevT >= 40.0 && T_curr <= 40.0) {
      R40 = interpolateTime(40.0);
    }
    if (R30 === null && prevT >= 30.0 && T_curr <= 30.0) {
      R30 = interpolateTime(30.0);
    }
    if (R20 === null && prevT >= 20.0 && T_curr <= 20.0) {
      R20 = interpolateTime(20.0);
    }
    if (RTarget === null && prevT >= targetCustom && T_curr <= targetCustom) {
      RTarget = interpolateTime(targetCustom);
    }

    if (Time <= maxDisplaySeconds + 0.001 && Time >= lastOut + 60.0 - 0.001) {
      const state = calculateState(T_curr, params);
      const timeMin = Time / 60.0;

      timeSeries.push({
        timeMin: Number(timeMin.toFixed(2)),
        timeSec: Math.round(Time),
        soupTemp: Number(T_curr.toFixed(2)),
        tapIn: Number(params.TapTemp.toFixed(1)),
        tapOut: Number(state.Tap_Out.toFixed(2)),
        uVal: Number(state.U.toFixed(1)),
        reTotal: Number(state.Re_Total.toFixed(1)),
        reRot: Number(state.Re_Rot.toFixed(1)),
        reTube: Number(state.Re_Tube.toFixed(1)),
        qCool: Number(state.Q_cool.toFixed(0)),
        qEvap: Number(state.Q_evap.toFixed(0)),
        qConv: Number(state.Q_conv.toFixed(0)),
        qLoss: Number(state.Q_loss.toFixed(0)),
        latentRatio: Number(state.Latent_Ratio.toFixed(1)),
        dTdt: Number(state.dTdt.toFixed(4)),
      });

      lastOut = Time;
      uSum += state.U;
      qSum += state.Q_cool;
      maxQ = Math.max(maxQ, state.Q_cool);
      stepCount++;
    }
  }

  const finalTimeMin = Time / 60.0;
  if (timeSeries[timeSeries.length - 1].timeSec !== Math.round(Time)) {
    const finalState = calculateState(T_curr, params);
    timeSeries.push({
      timeMin: Number(finalTimeMin.toFixed(2)),
      timeSec: Math.round(Time),
      soupTemp: Number(T_curr.toFixed(2)),
      tapIn: Number(params.TapTemp.toFixed(1)),
      tapOut: Number(finalState.Tap_Out.toFixed(2)),
      uVal: Number(finalState.U.toFixed(1)),
      reTotal: Number(finalState.Re_Total.toFixed(1)),
      reRot: Number(finalState.Re_Rot.toFixed(1)),
      reTube: Number(finalState.Re_Tube.toFixed(1)),
      qCool: Number(finalState.Q_cool.toFixed(0)),
      qEvap: Number(finalState.Q_evap.toFixed(0)),
      qConv: Number(finalState.Q_conv.toFixed(0)),
      qLoss: Number(finalState.Q_loss.toFixed(0)),
      latentRatio: Number(finalState.Latent_Ratio.toFixed(1)),
      dTdt: Number(finalState.dTdt.toFixed(4)),
    });
    uSum += finalState.U;
    qSum += finalState.Q_cool;
    maxQ = Math.max(maxQ, finalState.Q_cool);
    stepCount++;
  }

  const avgU = stepCount > 0 ? uSum / stepCount : 0;
  const deltaT = params.StartTemp - T_curr;
  const totalHeatJ = params.Soup_mass * getCp(params.Brix) * Math.max(0, deltaT);

  return {
    id: caseId || `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    caseName: params.caseName || 'Case_1',
    params,
    timeTo50C: R50 !== null ? Number(R50.toFixed(2)) : null,
    timeTo40C: R40 !== null ? Number(R40.toFixed(2)) : null,
    timeTo30C: R30 !== null ? Number(R30.toFixed(2)) : null,
    timeTo20C: R20 !== null ? Number(R20.toFixed(2)) : null,
    timeToTarget: RTarget !== null ? Number(RTarget.toFixed(2)) : null,
    targetTemp: targetCustom,
    finalTemp: Number(T_curr.toFixed(2)),
    totalTimeMin: Number(finalTimeMin.toFixed(2)),
    avgU: Number(avgU.toFixed(1)),
    maxU: Math.round(maxQ),
    minU: 0,
    totalQCoolMJ: Number((totalHeatJ / 1e6).toFixed(2)),
    totalQEvapMJ: 0,
    totalQConvMJ: 0,
    totalQLossMJ: Number((totalHeatJ / 1e6).toFixed(2)),
    timeSeries,
    color: PALETTE[colorIndex % PALETTE.length],
  };
}

export const PRESETS: Record<string, { label: string; desc: string; params: SimulationParams }> = {
  standard: {
    label: '標準条件 (水物性 35kg / 95℃)',
    desc: '基準条件: 700rpm, 水道水 10L/min, 20℃, 鍋φ390mm, 水物性(Brix 0%)',
    params: {
      caseName: '標準冷却_35kg',
      RPM: 700,
      TapFlow: 10.0,
      TapTemp: 20.0,
      Soup_mass: 35.0,
      StartTemp: 95.0,
      Brix: 0.0,
      Ex_D_mm: 100,
      Ex_L_mm: 300,
      Pot_D_mm: 390,
      Pot_H_mm: 390,
      chillerType: 'rotary',
      RoomTemp: 25.0,
      RoomRH: 80.0,
      Coeff_Conv_A: 15.0,
      Coeff_Evap_B: 0.135,
      Coeff_Evap_C: 1.57e-10,
      C_Re_Base: 3.8508,
      Exp_Total: 0.6301,
      Alpha: 0.2588,
      dt: 2.0,
      maxTimeMin: 120,
      fixTimeAxisMax: false,
      fixedTimeAxisValue: 60,
      fixTempAxis: false,
      fixedTempMin: 10,
      fixedTempMax: 95,
      fixWaterAxis: false,
      fixedWaterMax: 500,
      customTargetTemp: 30,
      waterCostPerM3: 500,
      waterCostSupply: 300,
      waterCostDrain: 200,
      electricityCostPerKwh: 30,
    },
  },
};

export function run3ModesSimulation(
  params: SimulationParams
): { rotary: SimulationResult; coil: SimulationResult; sink: SimulationResult } {
  const rotaryParams: SimulationParams = { ...params, chillerType: 'rotary' };
  // コイル式・シンク式は回転数=0(攪拌なし)、冷却水流量の影響のみ受ける
  const coilParams: SimulationParams = { ...params, chillerType: 'coil', RPM: 0 };
  const sinkParams: SimulationParams = { ...params, chillerType: 'sink', RPM: 0 };

  return {
    rotary: runSimulation(rotaryParams, '3m_rotary', 0),
    coil: runSimulation(coilParams, '3m_coil', 1),
    sink: runSimulation(sinkParams, '3m_sink', 2),
  };
}
