import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  HelpCircle,
  Printer,
  Building2,
  User,
  Timer,
  ShieldCheck,
  Zap,
  Droplets,
  Receipt,
  Scale,
} from 'lucide-react';
import { SimulationParams, SimulationResult } from '../types/simulation';

interface SalesSummaryModeProps {
  params?: SimulationParams;
  onParamsChange?: (newParams: SimulationParams) => void;
  activeResult: SimulationResult;
  threeModesData: {
    rotary: SimulationResult;
    coil: SimulationResult;
    sink: SimulationResult;
  };
}

/**
 * PDF出力時のファイル名生成
 * 例: 20261008QULIYA CHELLER試算（〇〇ラーメン様）.pdf
 */
export function getPdfFileName(customerName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const clean = (customerName || '').trim().replace(/(様|御中)$/, '').trim();
  const shopPart = clean ? `${clean}様` : '店名様';
  return `${yyyy}${mm}${dd}QULIYA CHELLER試算（${shopPart}）`;
}

// QULIYA CHILLER モーター消費電力: 200W × 負荷率70% = 140W = 0.14kW
const MOTOR_POWER_KW = 0.20 * 0.70;

export const SalesSummaryMode: React.FC<SalesSummaryModeProps> = ({
  params,
  onParamsChange,
  activeResult,
  threeModesData,
}) => {
  // お客様情報
  const [customerName, setCustomerName] = useState<string>('');
  const [salesRepName, setSalesRepName] = useState<string>('');

  // 営業試算パラメータ
  const [dailyBatches, setDailyBatches] = useState<number>(1);
  const [monthlyDays, setMonthlyDays] = useState<number>(26);
  const [hourlyWage, setHourlyWage] = useState<number>(1200);
  const [monthlyRentalYen, setMonthlyRentalYen] = useState<number>(22000);
  const [showRoiHelp, setShowRoiHelp] = useState<boolean>(false);

  // 単価設定
  const effectiveParams = params ?? activeResult.params;
  const supplyCost = effectiveParams.waterCostSupply ?? 300;
  const drainCost = effectiveParams.waterCostDrain ?? 200;
  const totalWaterCostPerM3 = supplyCost + drainCost;
  const costPerLiter = totalWaterCostPerM3 / 1000;
  const electricityCostPerKwh = effectiveParams.electricityCostPerKwh ?? 30;

  // 単価変更ハンドラー
  const handleWaterSupplyChange = (val: number) => {
    onParamsChange?.({
      ...effectiveParams,
      waterCostSupply: val,
      waterCostPerM3: val + drainCost,
    });
  };

  const handleWaterDrainChange = (val: number) => {
    onParamsChange?.({
      ...effectiveParams,
      waterCostDrain: val,
      waterCostPerM3: supplyCost + val,
    });
  };

  const handleElectricityCostChange = (val: number) => {
    onParamsChange?.({
      ...effectiveParams,
      electricityCostPerKwh: val,
    });
  };

  // PDF保存用の title 同期
  useEffect(() => {
    const prevTitle = document.title;
    document.title = getPdfFileName(customerName);
    return () => {
      document.title = prevTitle;
    };
  }, [customerName]);

  const targetTemp = effectiveParams.customTargetTemp ?? 30;

  // 各モードの結果
  const { rotary: rotRes, coil: coilRes, sink: sinkRes } = threeModesData;

  // 1回あたりの到達時間（分）
  const rotTime = Math.round(rotRes.timeToTarget ?? 15);
  const coilTime = Math.round(coilRes.timeToTarget ?? 45);
  const sinkTime = Math.round(sinkRes.timeToTarget ?? 90);

  // 1回あたりの水道使用量 (L)
  const rotWater = Math.round(rotRes.params.TapFlow * rotTime);
  const coilWater = Math.round(coilRes.params.TapFlow * coilTime);
  const sinkWater = Math.round(sinkRes.params.TapFlow * sinkTime);

  // 1回あたりの水道コスト (円)
  const rotWaterCostPerBatch = Math.round(rotWater * costPerLiter);
  const coilWaterCostPerBatch = Math.round(coilWater * costPerLiter);
  const sinkWaterCostPerBatch = Math.round(sinkWater * costPerLiter);

  // 1回あたりの電気コスト (円: モーター定格200W / 負荷率70%換算)
  const rotPowerKwhPerBatch = MOTOR_POWER_KW * (rotTime / 60);
  const rotElecCostPerBatch = rotPowerKwhPerBatch * electricityCostPerKwh;

  // 1回あたりの削減効果
  const waterSavingsPerBatch = Math.max(0, sinkWaterCostPerBatch - rotWaterCostPerBatch);
  const timeSavingsMinPerBatch = Math.max(0, sinkTime - rotTime);

  // スピード倍率
  const rotSpeedRatio = (sinkTime / Math.max(1, rotTime)).toFixed(1);
  const coilSpeedRatio = (sinkTime / Math.max(1, coilTime)).toFixed(1);

  // 月間計算
  const monthlyBatches = dailyBatches * monthlyDays;

  // QULIYA式 月間水道代・電気代
  const rotWaterCostMonth = Math.round(rotWaterCostPerBatch * monthlyBatches);
  const rotElecCostMonth = Math.round(rotElecCostPerBatch * monthlyBatches);

  // 導入によって増える月間コスト
  const addedCostMonth = monthlyRentalYen + rotElecCostMonth;

  // シンク流水式 月間水道代
  const sinkWaterCostMonth = Math.round(sinkWaterCostPerBatch * monthlyBatches);

  // 月間削減額＆手残り
  const waterSavingsMonth = Math.max(0, sinkWaterCostMonth - rotWaterCostMonth);
  const timeSavingsHoursMonth = (timeSavingsMinPerBatch * monthlyBatches) / 60;
  const laborSavingsMonth = Math.round(timeSavingsHoursMonth * hourlyWage);
  const netSavingsMonth = (waterSavingsMonth + laborSavingsMonth) - addedCostMonth;

  // 印刷・PDF保存のトリガー
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = getPdfFileName(customerName);
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <div className="space-y-2.5">
      {/* 1. トップバナー & アクション */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-3 text-white shadow-md border border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              QULIYA CHILLER 導入によるコスト削減シミュレーション
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              スープ量（{effectiveParams.Soup_mass}kg）、寸胴径（{effectiveParams.Pot_D_mm}mm）、水温（{effectiveParams.TapTemp}℃）条件に基づく月次試算です。
              <br />
              <span className="text-cyan-300 block sm:inline pl-2">
                ※水実験モデル準拠（実スープは粘性・Brixにより冷却時間が延伸します／Brix対応モデル開発中）。
              </span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500 transition cursor-pointer shadow-xs active:scale-95"
              title="この提案書をA4縦1ページでPDF保存または印刷"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF保存 / 印刷</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center space-x-1.5 bg-white/10 px-2 py-1 rounded-md border border-white/10">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-300">提案先店舗・企業名:</span>
            <input
              type="text"
              placeholder="例: 〇〇ラーメン 様"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-transparent border-b border-cyan-400/50 focus:border-cyan-300 outline-none text-white text-xs font-bold px-1 w-40 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-white/10 px-2 py-1 rounded-md border border-white/10">
            <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-300">営業担当者:</span>
            <input
              type="text"
              placeholder="例: 山田 太郎"
              value={salesRepName}
              onChange={(e) => setSalesRepName(e.target.value)}
              className="bg-transparent border-b border-cyan-400/50 focus:border-cyan-300 outline-none text-white text-xs font-bold px-1 w-24 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* 2. メインハイライト: 月あたりのコストシミュレーション */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-xs page-break-inside-avoid">
        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
            <div className="flex items-center space-x-1.5">
              <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                月あたりのコストシミュレーション
              </h3>
            </div>
            <button
              onClick={() => setShowRoiHelp(!showRoiHelp)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              title="計算根拠の確認"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {showRoiHelp && (
            <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
              <p>
                <strong>計算条件:</strong> 月稼働 {monthlyDays}日 × 1日 {dailyBatches}回 ＝ 計 {monthlyBatches}回の冷却仕込み。
              </p>
              <p>
                ・<strong>導入によって増えるコスト:</strong> レンタル代 {monthlyRentalYen.toLocaleString()}円 ＋ 電気代 {rotElecCostMonth.toLocaleString()}円 ＝ 計 {addedCostMonth.toLocaleString()}円/月（※水道代は削減額側で相殺算出）。
              </p>
              <p>
                ・<strong>水道代削減:</strong> 1回削減 {(sinkWater - rotWater).toLocaleString()}L × 単価 {totalWaterCostPerM3}円/m³（上水{supplyCost}＋下水{drainCost}）＝ 月間 ▲{waterSavingsMonth.toLocaleString()}円。
              </p>
              <p>
                ・<strong>人件費削減:</strong> 冷却監視・拘束時間短縮 {timeSavingsHoursMonth.toFixed(1)}時間 × 時給換算 {hourlyWage.toLocaleString()}円 ＝ 月間 ▲{laborSavingsMonth.toLocaleString()}円相当。
              </p>
            </div>
          )}

          {/* メリットカード群 (4カラム配置) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
            {/* ① 導入コスト */}
            <div className="p-2.5 rounded-lg border-2 border-indigo-400 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-100/60 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-950 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>導入によって増えるコスト</span>
                  </span>
                </div>
                <div className="mt-1 text-2xl sm:text-2xl font-black text-indigo-950 font-mono tracking-tight">
                  {addedCostMonth.toLocaleString()}
                  <span className="text-xs font-bold ml-1 text-indigo-800 font-sans">円/月</span>
                </div>
              </div>

              {/* 右寄せ＆右揃え構造 */}
              <div className="mt-1.5 pt-1 border-t border-indigo-200/90 text-[11px] font-mono flex flex-col items-end">
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-1.5 items-center text-slate-600 w-full max-w-[170px]">
                  <span className="text-left whitespace-nowrap">① レンタル料:</span>
                  <span className="text-right font-bold text-slate-800">{monthlyRentalYen.toLocaleString()}</span>
                  <span className="text-right text-slate-600">円</span>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-1.5 items-center text-slate-600 w-full max-w-[170px] mt-0.5">
                  <span className="text-left whitespace-nowrap flex items-center gap-0.5">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>② 電気代:</span>
                  </span>
                  <span className="text-right font-bold text-amber-700">{rotElecCostMonth.toLocaleString()}</span>
                  <span className="text-right text-slate-600">円</span>
                </div>
              </div>
            </div>

            {/* ② 水道代削減 */}
            <div className="p-2.5 rounded-lg border border-cyan-200 bg-cyan-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-800 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span>水道料金の削減額</span>
                  </span>
                </div>
                <div className="mt-1 text-2xl sm:text-2xl font-black text-cyan-900 font-mono">
                  ▲{waterSavingsMonth.toLocaleString()}
                  <span className="text-xs font-bold ml-1 text-cyan-700 font-sans">円/月</span>
                </div>
              </div>

              {/* 右寄せ＆右揃え構造 */}
              <div className="mt-1.5 pt-1 border-t border-cyan-200/80 text-[11px] font-mono flex flex-col items-end">
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-1.5 items-center text-cyan-800 w-full max-w-[170px]">
                  <span className="text-left whitespace-nowrap">月間水削減量:</span>
                  <span className="text-right font-bold">{((sinkWater - rotWater) * monthlyBatches).toLocaleString()}</span>
                  <span className="text-right text-cyan-700">L</span>
                </div>
                <div className="text-[10px] text-cyan-700 leading-tight mt-0.5 text-right w-full">
                  シンク{sinkWaterCostMonth.toLocaleString()}円 → QULIYA{rotWaterCostMonth.toLocaleString()}円
                </div>
              </div>
            </div>

            {/* ③ 人件費削減 */}
            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>人件費削減</span>
                  </span>
                </div>
                <div className="mt-1 text-2xl sm:text-2xl font-black text-amber-900 font-mono">
                  ▲{laborSavingsMonth.toLocaleString()}
                  <span className="text-xs font-bold ml-1 text-amber-700 font-sans">円/月</span>
                </div>
              </div>

              {/* 右寄せ＆右揃え構造 */}
              <div className="mt-1.5 pt-1 border-t border-amber-200/80 text-[11px] font-mono flex flex-col items-end">
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-1.5 items-center text-amber-800 w-full max-w-[170px]">
                  <span className="text-left whitespace-nowrap">拘束時間削減:</span>
                  <span className="text-right font-bold">▲{timeSavingsHoursMonth.toFixed(1)}</span>
                  <span className="text-right text-amber-700">時間</span>
                </div>
                <div className="text-[10px] text-amber-700 leading-tight mt-0.5 text-right w-full">
                  時給{hourlyWage.toLocaleString()}円 × 1回短縮{timeSavingsMinPerBatch}分
                </div>
              </div>
            </div>

            {/* ④ 純手残りメリット */}
            <div className="p-2.5 rounded-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>月間純メリット</span>
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded font-sans">
                    実質手残り
                  </span>
                </div>
                <div className="mt-1 text-2xl sm:text-2xl font-black text-emerald-800 font-mono tracking-tight flex items-baseline">
                  {netSavingsMonth >= 0 ? `+${netSavingsMonth.toLocaleString()}` : `${netSavingsMonth.toLocaleString()}`}
                  <span className="text-xs font-bold ml-1 text-emerald-950 font-sans">円/月</span>
                </div>
              </div>

              {/* 右寄せ＆右揃え構造 */}
              <div className="mt-1.5 pt-1 border-t border-emerald-300/80 text-[11px] font-mono flex flex-col items-end">
                <div className="text-[10px] text-emerald-800 font-semibold leading-tight text-right w-full">
                  （水道＋人件費削減）
                </div>
                <div className="text-[10px] text-emerald-800 font-semibold leading-tight text-right w-full mt-0.5">
                  ー 導入コスト（レンタル＋電気）
                </div>
              </div>
            </div>
          </div>

          {/* 年間換算バー */}
          <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1 text-xs">
            <span className="text-slate-300 font-medium">
              年間インパクト（×12ヶ月換算）:
            </span>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 font-mono font-bold text-[11px]">
              <span className="text-indigo-300">
                導入コスト 年間 {(addedCostMonth * 12).toLocaleString()}円
              </span>
              <span className="text-cyan-300">
                水道代 年間 ▲{(waterSavingsMonth * 12).toLocaleString()}円
              </span>
              <span className="text-amber-300">
                電気代 年間 +{(rotElecCostMonth * 12).toLocaleString()}円
              </span>
              <span className="text-emerald-300 underline font-black">
                純メリット 年間 {netSavingsMonth >= 0 ? `+${(netSavingsMonth * 12).toLocaleString()}` : (netSavingsMonth * 12).toLocaleString()}円
              </span>
            </div>
          </div>
        </div>

        {/* 試算条件の入力コントロール */}
        <div className="mt-2.5 pt-2 border-t border-slate-200 bg-slate-50/70 -mx-3 -mb-3 sm:-mx-3.5 sm:-mb-3.5 p-2.5 rounded-b-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
            <span>お客様の稼働条件 ＆ 料金単価設定:</span>
            <span className="text-[10px] text-slate-500 font-normal">
              数値を変更すると即座に試算結果・グラフが連動します
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <label className="text-[10px] text-slate-600 block mb-0.5">1日の仕込み回数</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={dailyBatches}
                  onChange={(e) => setDailyBatches(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 text-right"
                />
                <span className="text-slate-500 text-[10px]">回</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-600 block mb-0.5">月間仕込み日数</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  value={monthlyDays}
                  onChange={(e) => setMonthlyDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 text-right"
                />
                <span className="text-slate-500 text-[10px]">日</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-600 block mb-0.5">QULIYAチラーレンタル料</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="200000"
                  step="1000"
                  value={monthlyRentalYen}
                  onChange={(e) => setMonthlyRentalYen(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-indigo-700 text-right"
                />
                <span className="text-slate-500 text-[10px]">円</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-600 block mb-0.5">スタッフ時給</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="800"
                  max="5000"
                  step="50"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 text-right"
                />
                <span className="text-slate-500 text-[10px]">円</span>
              </div>
            </div>
          </div>

          <div className="pt-1.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-semibold text-blue-700">上水単価</label>
                <span className="text-[9px] text-slate-400">円/m³</span>
              </div>
              <input
                type="number"
                min="0"
                max="9999"
                step="10"
                value={supplyCost}
                onChange={(e) => handleWaterSupplyChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs font-bold text-blue-900 text-right focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-semibold text-cyan-800">下水単価</label>
                <span className="text-[9px] text-slate-400">円/m³</span>
              </div>
              <input
                type="number"
                min="0"
                max="9999"
                step="10"
                value={drainCost}
                onChange={(e) => handleWaterDrainChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-cyan-200 rounded px-2 py-1 text-xs font-bold text-cyan-900 text-right focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-semibold text-amber-700 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-500" />
                  <span>電気単価</span>
                </label>
                <span className="text-[9px] text-slate-400">円/kWh</span>
              </div>
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                value={electricityCostPerKwh}
                onChange={(e) => handleElectricityCostChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-xs font-bold text-amber-900 text-right focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. 1回あたりの冷却時間＆コスト対比 */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-xs page-break-inside-avoid">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Timer className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="font-black text-base sm:text-lg text-slate-900">
              1回あたりの冷却時間＆コスト比較
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            目標温度 {targetTemp}℃ 到達時（1仕込みあたり）
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {/* ① QULIYA式 */}
          <div className="p-2.5 sm:p-3 rounded-lg border-2 border-cyan-500 bg-gradient-to-b from-white via-cyan-50/40 to-cyan-50/80 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1 gap-1 pb-1 border-b border-cyan-100">
                <div className="flex items-center space-x-1 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0"></span>
                  <span className="text-xs font-black text-cyan-950 whitespace-nowrap">
                    QULIYA式
                  </span>
                </div>
                <span className="bg-cyan-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs shrink-0 whitespace-nowrap">
                  回転冷却（特許）
                </span>
              </div>

              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-cyan-950 font-mono">
                  {rotTime}
                </span>
                <span className="text-xs font-bold text-cyan-700">分</span>
                <span className="ml-2 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                  約{rotSpeedRatio}倍速
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-cyan-200/90 space-y-0.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap">水道使用量:</span>
                <span className="font-bold text-slate-900 whitespace-nowrap">{rotWater} L</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-blue-600" />
                  <span>1回水道代:</span>
                </span>
                <span className="font-bold text-blue-800 whitespace-nowrap">{rotWaterCostPerBatch.toLocaleString()} 円</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>1回電気代:</span>
                </span>
                <span className="font-bold text-amber-700 whitespace-nowrap">
                  約{rotElecCostPerBatch < 1 ? rotElecCostPerBatch.toFixed(1) : Math.round(rotElecCostPerBatch)} 円
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 pt-0.5 border-t border-cyan-200/70">
                <span className="font-semibold whitespace-nowrap">1回光熱費計:</span>
                <span className="font-black text-cyan-950 whitespace-nowrap">
                  {Math.round(rotWaterCostPerBatch + rotElecCostPerBatch).toLocaleString()} 円
                </span>
              </div>
              <div className="flex items-center justify-between text-emerald-900 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 mt-0.5">
                <span className="shrink-0 whitespace-nowrap text-slate-700">1回削減:</span>
                <span className="whitespace-nowrap font-mono text-[10px]">
                  水道▲{waterSavingsPerBatch.toLocaleString()}円 ｜ 時短▲{timeSavingsMinPerBatch}分
                </span>
              </div>

              <div className="mt-0.5 pt-0.5 border-t border-cyan-200/60 text-[9.5px] font-sans leading-tight">
                <div className="flex items-center space-x-1 font-bold text-red-600 whitespace-nowrap">
                  <ShieldCheck className="w-3 h-3 text-red-600 shrink-0" />
                  <span>至適増殖温度帯（35〜40℃）を急速冷却</span>
                </div>
                <p className="text-[9px] text-slate-600 leading-tight mt-0.5">
                  菌の増殖ピーク帯を速やかに通過し、冷蔵庫での早期補完が可能
                </p>
              </div>
            </div>
          </div>

          {/* ② 冷却コイル式 */}
          <div className="p-2.5 sm:p-3 rounded-lg border border-amber-300 bg-amber-50/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-amber-200/60">
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                    冷却コイル式
                  </span>
                </div>
                <span className="text-[9px] text-amber-800 bg-amber-100 px-1 py-0.2 rounded font-sans shrink-0 whitespace-nowrap">
                  据置浸漬
                </span>
              </div>

              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">
                  {coilTime}
                </span>
                <span className="text-xs font-bold text-slate-600">分</span>
                <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                  約{coilSpeedRatio}倍速
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-amber-200/80 space-y-0.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap">水道使用量:</span>
                <span className="font-bold text-slate-900 whitespace-nowrap">{coilWater} L</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-blue-600" />
                  <span>1回水道代:</span>
                </span>
                <span className="font-bold text-slate-800 whitespace-nowrap">{coilWaterCostPerBatch.toLocaleString()} 円</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-slate-400" />
                  <span>1回電気代:</span>
                </span>
                <span className="text-slate-500 whitespace-nowrap">0 円 (無電源)</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 pt-0.5 border-t border-amber-200/70">
                <span className="font-semibold whitespace-nowrap">1回光熱費計:</span>
                <span className="font-bold text-slate-900 whitespace-nowrap">
                  {coilWaterCostPerBatch.toLocaleString()} 円
                </span>
              </div>
              <div className="flex items-center justify-between text-amber-900 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mt-0.5">
                <span className="shrink-0 whitespace-nowrap text-slate-700">1回削減:</span>
                <span className="whitespace-nowrap font-mono text-[10px]">
                  水道▲{Math.max(0, sinkWaterCostPerBatch - coilWaterCostPerBatch).toLocaleString()}円 ｜ 時短▲{Math.max(0, sinkTime - coilTime)}分
                </span>
              </div>

              <div className="mt-0.5 pt-0.5 border-t border-amber-200/60 text-[9.5px] font-sans leading-tight">
                <span className="font-bold text-slate-700 whitespace-nowrap">衛生・運用上の留意点</span>
                <p className="text-[9px] text-slate-500 leading-tight mt-0.5">
                  40分以上要し菌増殖帯に滞留。コイル管の洗浄・衛生管理手間大
                </p>
              </div>
            </div>
          </div>

          {/* ③ シンク流水式 */}
          <div className="p-2.5 sm:p-3 rounded-lg border border-slate-300 bg-slate-50/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200">
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                    シンク流水式
                  </span>
                </div>
                <span className="text-[9px] text-slate-600 bg-slate-200 px-1 py-0.2 rounded font-sans shrink-0 whitespace-nowrap">
                  自然放置
                </span>
              </div>

              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-700 font-mono">
                  {sinkTime}
                </span>
                <span className="text-xs font-bold text-slate-600">分</span>
                <span className="ml-2 text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.2 rounded font-mono">
                  基準 (1/1)
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-slate-200 space-y-0.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap">水道使用量:</span>
                <span className="font-bold text-slate-900 whitespace-nowrap">{sinkWater} L</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-blue-600" />
                  <span>1回水道代:</span>
                </span>
                <span className="font-bold text-slate-800 whitespace-nowrap">{sinkWaterCostPerBatch.toLocaleString()} 円</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="whitespace-nowrap flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-slate-400" />
                  <span>1回電気代:</span>
                </span>
                <span className="text-slate-500 whitespace-nowrap">0 円 (無電源)</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 pt-0.5 border-t border-slate-200">
                <span className="font-semibold whitespace-nowrap">1回光熱費計:</span>
                <span className="font-bold text-slate-900 whitespace-nowrap">
                  {sinkWaterCostPerBatch.toLocaleString()} 円
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-bold bg-slate-100 px-1 py-0.5 rounded border border-slate-200 mt-0.5">
                <span className="shrink-0 whitespace-nowrap text-slate-700">1回削減:</span>
                <span className="whitespace-nowrap font-mono text-[10px]">- (従来の基準方式)</span>
              </div>

              <div className="mt-0.5 pt-0.5 border-t border-slate-200 text-[9.5px] font-sans leading-tight">
                <span className="font-bold text-slate-700 whitespace-nowrap">衛生・運用の留意点</span>
                <p className="text-[9px] text-slate-500 leading-tight mt-0.5">
                  約1.5時間流水放置。菌増殖リスク最大・水道水を大量浪費
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ワンポイント解説バナー */}
        <div className="mt-1.5 bg-gradient-to-r from-red-50 via-amber-50/40 to-slate-50 border border-red-200 rounded-lg p-2 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
          <div className="bg-red-100 text-red-700 p-1 rounded-md shrink-0 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 leading-snug">
            <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900 text-[11px]">
              <span className="text-red-700">💡 なぜ「30℃」への急速冷却が重要なのか？</span>
              <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-normal">
                食中毒菌（中温菌）の増殖至適温度：35℃〜40℃
              </span>
            </div>
            <p className="text-[10px] text-slate-600 leading-normal">
              食中毒菌（中温菌）は35℃〜40℃（至適増殖温度帯）で最も活発に増殖します。寸胴鍋を常温放置するとこの温度帯に1時間以上滞留してしまいますが、QULIYA式チラーで30℃以下まで速やかに冷却することで増殖リスクを低減し、冷蔵庫の庫内温度上昇を防いで衛生的に保冷保管へ移行できます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};