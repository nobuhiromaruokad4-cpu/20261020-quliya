export interface SimulationParams {
  caseName: string;
  // 運転条件
  RPM: number;         // 撹拌回転数 (rpm)
  TapFlow: number;     // 冷却水流量 (L/min)
  TapTemp: number;     // 冷却水入口温度 (℃)
  // スープ物性
  Soup_mass: number;   // スープ重量 (kg)
  StartTemp: number;   // 初期温度 (℃)
  Brix: number;        // 糖度・濃度 (Brix %)
  // 機器寸法
  Ex_D_mm: number;     // 冷却管外径 (mm)
  Ex_L_mm: number;     // 冷却管有効長 (mm)
  Pot_D_mm: number;    // 寸胴径 (mm)
  Pot_H_mm?: number;   // 寸胴高さ (mm)
  // チラー種別 (rotary: 回転式熱交換器, sink: シンク漬け冷却 U=100 アルミ寸胴 半分高さ, coil: SUSコイル式チラー U=200 φ9.52mm 10m)
  chillerType?: 'rotary' | 'sink' | 'coil';
  fixedU?: number;     // 固定U (W/m²·K)
  // 環境条件
  RoomTemp: number;    // 室温 (℃)
  RoomRH: number;      // 室内相対湿度 (%)
  // モデル係数 (高度チューニング)
  Coeff_Conv_A: number; // 鍋側面対流係数 (デフォルト: 15.0)
  Coeff_Evap_B: number; // 蒸発係数B (デフォルト: 0.135)
  Coeff_Evap_C: number; // 蒸発係数C (デフォルト: 1.57e-10)
  C_Re_Base: number;    // Re相関ベース係数 (デフォルト: 3.8508)
  Exp_Total: number;    // Re指数 (デフォルト: 0.6301)
  Alpha: number;        // 旋回流重み係数 (デフォルト: 0.2588)
  // 計算条件
  dt: number;           // 時間刻み幅 (秒, デフォルト: 2.0)
  maxTimeMin: number;   // 最大計算時間 (分, デフォルト: 120)
  fixTimeAxis?: boolean; // 時間軸固定
  fixedTimeMin?: number; // 時間軸最小固定値 (分, デフォルト: 0)
  fixedTimeMax?: number; // 時間軸最大固定値 (分, デフォルト: 60)
  // 後方互換用プロパティ
  fixTimeAxisMax?: boolean;
  fixedTimeAxisValue?: number;
  fixTempAxis?: boolean; // 温度軸固定
  fixedTempMin?: number; // 温度軸最小固定値 (℃, デフォルト: 10)
  fixedTempMax?: number; // 温度軸最大固定値 (℃, デフォルト: 95)
  fixWaterAxis?: boolean; // 水道使用量軸固定
  fixedWaterMin?: number; // 水道使用量軸最小固定値 (L, デフォルト: 0)
  fixedWaterMax?: number; // 水道使用量軸最大固定値 (L, デフォルト: 500)
  customTargetTemp?: number; // 任意目標温度 (℃, デフォルト: 30)
  waterCostPerM3?: number;   // 水道料金単価 合計 (円/m³)
  waterCostSupply?: number;  // 上水道料金単価 (円/m³, デフォルト: 300)
  waterCostDrain?: number;   // 下水道料金単価 (円/m³, デフォルト: 200)
  electricityCostPerKwh?: number; // 電気料金単価 (円/kWh, デフォルト: 30)
}

export interface TimeStepData {
  timeMin: number;
  timeSec: number;
  soupTemp: number;
  tapIn: number;
  tapOut: number;
  uVal: number;
  reTotal: number;
  reRot: number;
  reTube: number;
  qCool: number;      // W
  qEvap: number;      // W
  qConv: number;      // W
  qLoss: number;      // W
  latentRatio: number;
  dTdt: number;
}

export interface SimulationResult {
  id: string;
  caseName: string;
  color: string;
  params: SimulationParams;
  timeSeries: TimeStepData[];
  totalTimeMin: number;
  timeTo50C: number | null;
  timeTo40C: number | null;
  timeTo30C: number | null;
  timeTo20C: number | null;
  timeToTarget: number | null;
  targetTemp: number;
  finalTemp: number;
  avgU: number;
  maxU: number;
  minU: number;
  totalQCoolMJ: number;
  totalQEvapMJ: number;
  totalQConvMJ: number;
  totalQLossMJ: number;
}
