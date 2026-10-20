import { SimulationParams, SimulationResult, TimeStepData } from '../types/simulation';

/**
 * 撹拌式急速冷却シミュレーション (Agitated Immersion Cooling Engine)
 * 物理計算コア（難読化・保護カプセル化エンジン）
 */

// 経験定数テーブル (保護カプセル)
const _K = Object.freeze({
  w_a: 2.414e-5,
  w_b: 247.8,
  w_c: 140,
  s_c: 4186.0,
  s_k: 4184.0,
  c_ev: 0.135,
  c_ev_r: 1.57e-10,
  c_cv: 15.0,
  c_re: 3.8508,
  c_ex: 0.6301,
  c_al: 0.2588,
  u_snk: 100.0,
  u_col: 200.0,
});

function _calcMu(Tc: number, b: number): number {
  const Tk = Tc + 273.15;
  return _K.w_a * Math.pow(10, _K.w_b / (Tk - _K.w_c)) * Math.pow(10, 0.05 * b);
}

function _calcRho(Tc: number, b: number): number {
  return 1000.0 - (Math.pow(Tc - 4.0, 2) / 180.0) + 5.0 * b;
}

function _calcCp(b: number): number {
  return (4.186 - 0.03 * b) * 1000.0;
}

function _computeState(Tc: number, p: SimulationParams) {
  const mode = p.chillerType || 'rotary';
  const pr = p.Pot_D_mm / 2000.0;
  const pd = p.Pot_D_mm / 1000.0;
  const ph = (p.Pot_H_mm ?? 390.0) / 1000.0;
  const la = Math.PI * Math.pow(pr, 2);
  const cp = _calcCp(p.Brix);

  const rho = _calcRho(Tc, p.Brix);
  const mu = _calcMu(Tc, p.Brix);
  const vol = p.Soup_mass / rho;
  const hliq = vol / la;
  const sarea = pd * Math.PI * hliq;

  let exA = 0.0;
  let exd = p.Ex_D_mm;
  if (mode === 'sink') {
    exA = Math.PI * Math.pow(pr, 2) + pd * Math.PI * (ph / 2.0);
  } else if (mode === 'coil') {
    exd = 9.52;
    exA = (exd / 1000.0) * Math.PI * 10.0;
  } else {
    exd = p.Ex_D_mm;
    exA = (exd / 1000.0) * Math.PI * (p.Ex_L_mm / 1000.0);
  }

  const psp = 0.611 * Math.exp((17.27 * Tc) / (Tc + 237.3));
  const psr = 0.611 * Math.exp((17.27 * p.RoomTemp) / (p.RoomTemp + 237.3));

  // コイル式・シンク式は攪拌なし（回転数＝0）、冷却水流量の影響のみ受ける
  const effectiveRPM = (mode === 'sink' || mode === 'coil') ? 0 : p.RPM;

  let qev = (_K.c_ev + _K.c_ev_r * Math.pow(effectiveRPM, 3.0)) * la * (psp - (p.RoomRH / 100.0) * psr) * 1000.0;
  if (qev < 0) qev = 0;

  const expSide = mode === 'sink' ? Math.max(0, pd * Math.PI * Math.max(0, hliq - ph / 2.0)) : sarea;
  const qcv = _K.c_cv * expSide * (Tc - p.RoomTemp);
  const qloss = qev + qcv;

  let qcool = 0.0;
  let uval = 0.0;
  let retot = 0.0;
  let rerot = 0.0;
  let retube = 0.0;
  let tout = p.TapTemp;

  if (p.TapFlow > 0) {
    if (mode === 'sink') {
      uval = p.fixedU ?? _K.u_snk;
    } else if (mode === 'coil') {
      uval = p.fixedU ?? _K.u_col;
    } else {
      const nrps = Math.max(p.RPM, 10.0) / 60.0;
      const dchar = exd / 1000.0;
      rerot = (rho * nrps * Math.pow(dchar, 2)) / mu;

      const rhotap = _calcRho(p.TapTemp, 0.0);
      const mutap = _calcMu(p.TapTemp, 0.0);
      const flow = Math.max(p.TapFlow, 0.1) / 60000.0;
      const tdm = exd / 1000.0;
      const atube = (Math.PI * Math.pow(tdm, 2)) / 4.0;
      const vel = flow / atube;
      retube = (rhotap * vel * tdm) / mutap;

      retot = Math.sqrt(Math.pow(_K.c_al * rerot, 2) + Math.pow(retube, 2));
      uval = _K.c_re * Math.pow(retot, _K.c_ex);
    }

    const mdot = p.TapFlow / 60.0;
    const cap = mdot * _K.s_c;

    const ntu = (uval * exA) / cap;
    const eff = 1.0 - Math.exp(-ntu);
    qcool = eff * cap * (Tc - p.TapTemp);
    tout = p.TapTemp + qcool / cap;
  }

  let latr = 0.0;
  if (qloss > 0) latr = (qev / qloss) * 100.0;

  const dtdt = -(qcool + qloss) / (p.Soup_mass * cp);

  return {
    dTdt: dtdt,
    U: uval,
    Q_cool: qcool,
    Re_Total: retot,
    Re_Rot: rerot,
    Re_Tube: retube,
    Q_loss: qloss,
    Q_evap: qev,
    Q_conv: qcv,
    Latent_Ratio: latr,
    Tap_Out: tout,
  };
}

const PALETTE = [
  '#0284c7',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#db2777',
  '#ca8a04',
  '#0891b2',
  '#e11d48',
];

export function runSimulation(
  params: SimulationParams,
  caseId?: string,
  colorIndex: number = 0
): SimulationResult {
  const dt = params.dt > 0 ? params.dt : 2.0;
  const maxDisplaySec = (params.maxTimeMin || 120) * 60;
  const maxCompSec = Math.max(maxDisplaySec, 24 * 3600);
  const targetC = params.customTargetTemp ?? 30.0;

  let tcurr = params.StartTemp;
  let time = 0.0;
  let r50: number | null = null;
  let r40: number | null = null;
  let r30: number | null = null;
  let r20: number | null = null;
  let rtar: number | null = null;
  let lastout = -60.0;

  const series: TimeStepData[] = [];
  let usum = 0;
  let qsum = 0;
  let maxq = 0;
  let steps = 0;

  const init = _computeState(tcurr, params);
  series.push({
    timeMin: 0,
    timeSec: 0,
    soupTemp: Number(tcurr.toFixed(2)),
    tapIn: Number(params.TapTemp.toFixed(1)),
    tapOut: Number(init.Tap_Out.toFixed(2)),
    uVal: Number(init.U.toFixed(1)),
    reTotal: Number(init.Re_Total.toFixed(1)),
    reRot: Number(init.Re_Rot.toFixed(1)),
    reTube: Number(init.Re_Tube.toFixed(1)),
    qCool: Number(init.Q_cool.toFixed(0)),
    qEvap: Number(init.Q_evap.toFixed(0)),
    qConv: Number(init.Q_conv.toFixed(0)),
    qLoss: Number(init.Q_loss.toFixed(0)),
    latentRatio: Number(init.Latent_Ratio.toFixed(1)),
    dTdt: Number(init.dTdt.toFixed(4)),
  });

  lastout = 0;
  usum += init.U;
  qsum += init.Q_cool;
  maxq = Math.max(maxq, init.Q_cool);
  steps++;

  while (time <= maxCompSec) {
    if (time >= maxDisplaySec && rtar !== null && (targetC > 20 || r20 !== null)) break;

    // 水道水温に到達した場合は水温で一定値を維持し、maxDisplaySec (120分) まで系列を補完
    if (tcurr <= params.TapTemp + 0.05) {
      tcurr = params.TapTemp;
      while (time < maxDisplaySec) {
        time = Math.min(maxDisplaySec, time + 60.0);
        const st = _computeState(tcurr, params);
        series.push({
          timeMin: Number((time / 60.0).toFixed(2)),
          timeSec: Math.round(time),
          soupTemp: Number(tcurr.toFixed(2)),
          tapIn: Number(params.TapTemp.toFixed(1)),
          tapOut: Number(st.Tap_Out.toFixed(2)),
          uVal: Number(st.U.toFixed(1)),
          reTotal: Number(st.Re_Total.toFixed(1)),
          reRot: Number(st.Re_Rot.toFixed(1)),
          reTube: Number(st.Re_Tube.toFixed(1)),
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

    const prevT = tcurr;
    const prevTime = time;

    const k1 = _computeState(tcurr, params).dTdt;
    const k2 = _computeState(tcurr + 0.5 * dt * k1, params).dTdt;
    const k3 = _computeState(tcurr + 0.5 * dt * k2, params).dTdt;
    const k4 = _computeState(tcurr + dt * k3, params).dTdt;

    tcurr += (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4);
    time += dt;

    const interp = (tar: number) => {
      const frac = (prevT - tar) / (prevT - tcurr);
      return (prevTime + frac * dt) / 60.0;
    };

    if (r50 === null && prevT >= 50.0 && tcurr <= 50.0) r50 = interp(50.0);
    if (r40 === null && prevT >= 40.0 && tcurr <= 40.0) r40 = interp(40.0);
    if (r30 === null && prevT >= 30.0 && tcurr <= 30.0) r30 = interp(30.0);
    if (r20 === null && prevT >= 20.0 && tcurr <= 20.0) r20 = interp(20.0);
    if (rtar === null && prevT >= targetC && tcurr <= targetC) rtar = interp(targetC);

    if (time <= maxDisplaySec + 0.001 && time >= lastout + 60.0 - 0.001) {
      const st = _computeState(tcurr, params);
      const tmin = time / 60.0;

      series.push({
        timeMin: Number(tmin.toFixed(2)),
        timeSec: Math.round(time),
        soupTemp: Number(tcurr.toFixed(2)),
        tapIn: Number(params.TapTemp.toFixed(1)),
        tapOut: Number(st.Tap_Out.toFixed(2)),
        uVal: Number(st.U.toFixed(1)),
        reTotal: Number(st.Re_Total.toFixed(1)),
        reRot: Number(st.Re_Rot.toFixed(1)),
        reTube: Number(st.Re_Tube.toFixed(1)),
        qCool: Number(st.Q_cool.toFixed(0)),
        qEvap: Number(st.Q_evap.toFixed(0)),
        qConv: Number(st.Q_conv.toFixed(0)),
        qLoss: Number(st.Q_loss.toFixed(0)),
        latentRatio: Number(st.Latent_Ratio.toFixed(1)),
        dTdt: Number(st.dTdt.toFixed(4)),
      });

      lastout = time;
      usum += st.U;
      qsum += st.Q_cool;
      maxq = Math.max(maxq, st.Q_cool);
      steps++;
    }
  }

  const finalMin = time / 60.0;
  if (series[series.length - 1].timeSec !== Math.round(time)) {
    const st = _computeState(tcurr, params);
    series.push({
      timeMin: Number(finalMin.toFixed(2)),
      timeSec: Math.round(time),
      soupTemp: Number(tcurr.toFixed(2)),
      tapIn: Number(params.TapTemp.toFixed(1)),
      tapOut: Number(st.Tap_Out.toFixed(2)),
      uVal: Number(st.U.toFixed(1)),
      reTotal: Number(st.Re_Total.toFixed(1)),
      reRot: Number(st.Re_Rot.toFixed(1)),
      reTube: Number(st.Re_Tube.toFixed(1)),
      qCool: Number(st.Q_cool.toFixed(0)),
      qEvap: Number(st.Q_evap.toFixed(0)),
      qConv: Number(st.Q_conv.toFixed(0)),
      qLoss: Number(st.Q_loss.toFixed(0)),
      latentRatio: Number(st.Latent_Ratio.toFixed(1)),
      dTdt: Number(st.dTdt.toFixed(4)),
    });
    usum += st.U;
    qsum += st.Q_cool;
    maxq = Math.max(maxq, st.Q_cool);
    steps++;
  }

  const avgU = steps > 0 ? usum / steps : 0;
  const deltaT = params.StartTemp - tcurr;
  const heatJ = params.Soup_mass * _calcCp(params.Brix) * Math.max(0, deltaT);

  return {
    id: caseId || `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    caseName: params.caseName || 'Case_1',
    params,
    timeTo50C: r50 !== null ? Math.round(r50) : null,
    timeTo40C: r40 !== null ? Math.round(r40) : null,
    timeTo30C: r30 !== null ? Math.round(r30) : null,
    timeTo20C: r20 !== null ? Math.round(r20) : null,
    timeToTarget: rtar !== null ? Math.round(rtar) : null,
    targetTemp: targetC,
    finalTemp: Number(tcurr.toFixed(2)),
    totalTimeMin: Number(finalMin.toFixed(2)),
    avgU: Number(avgU.toFixed(1)),
    maxU: Math.round(maxq),
    minU: 0,
    totalQCoolMJ: Number((heatJ / 1e6).toFixed(2)),
    totalQEvapMJ: 0,
    totalQConvMJ: 0,
    totalQLossMJ: Number((heatJ / 1e6).toFixed(2)),
    timeSeries: series,
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
