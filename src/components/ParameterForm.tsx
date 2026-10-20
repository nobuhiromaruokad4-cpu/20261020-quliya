import React, { useId } from 'react';
import {
  Sliders,
  PlusCircle,
  Gauge,
  Thermometer,
  Layers,
  Wind,
  Clock,
  Waves,
  AlertTriangle,
} from 'lucide-react';
import { SimulationParams } from '../types/simulation';

interface ParameterFormProps {
  params: SimulationParams;
  onChange: (newParams: SimulationParams) => void;
  onSaveCase: () => void;
  isCalculating: boolean;
}

export const ParameterForm: React.FC<ParameterFormProps> = ({
  params,
  onChange,
  onSaveCase,
  isCalculating,
}) => {
  const formId = useId();

  const updateParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    onChange({
      ...params,
      [key]: value,
    });
  };

  // BS等で全消去された時にフォールバック値に戻らず「空文字（0）」を許容するハンドラー
  const handleNumberChange = (key: keyof SimulationParams, valStr: string) => {
    if (valStr === '') {
      updateParam(key, 0 as any);
      return;
    }
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      updateParam(key, parsed as any);
    }
  };

  const mode = params.chillerType || 'rotary';

  // 目標温度 < 水道水温度 (水温) のチェック
  const targetTemp = params.customTargetTemp ?? 30;
  const isTargetBelowTap = targetTemp < params.TapTemp;

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-full text-slate-800">
      {/* Title bar */}
      <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-600" />
          <h2 className="font-bold text-slate-800 text-xs tracking-wide">シミュレーション条件設定</h2>
        </div>
      </div>

      <div className="p-2 space-y-1.5 flex-1 overflow-y-auto">
        {/* 目標温度 < 水道温度 エラー警告バナー */}
        {isTargetBelowTap && (
          <div className="p-2 bg-red-50 border-2 border-red-500 rounded-lg text-red-900 flex items-start space-x-2 animate-in fade-in shadow-xs">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold block text-red-700">設定エラー：目標温度 ＜ 水道温度</span>
              <span>
                目標温度（{targetTemp}℃）が水道水温（{params.TapTemp}℃）より低いため、水冷では目標温度まで冷却できません。目標温度を水温以上に設定してください。
              </span>
            </div>
          </div>
        )}

        {/* 1. 計算モード */}
        <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
          <div className="flex items-center space-x-1 mb-1 text-slate-800">
            <Layers className="w-3 h-3 text-cyan-600 shrink-0" />
            <h3 className="text-[11px] font-bold text-slate-700">1. 計算モード</h3>
            <span className="text-[9.5px] text-slate-500 font-normal ml-auto">※水実験・伝熱モデル準拠</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {/* ① QULIYA式 */}
            <label
              className={`flex items-center justify-center p-1 rounded border text-[11px] cursor-pointer transition ${
                mode === 'rotary'
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-950 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <input
                type="radio"
                name={`chillerMode-${formId}`}
                checked={mode === 'rotary'}
                onChange={() => updateParam('chillerType', 'rotary')}
                className="accent-cyan-600 cursor-pointer mr-1 scale-90"
              />
              <span>QULIYA式</span>
            </label>

            {/* ② コイル式 */}
            <label
              className={`flex flex-col items-center justify-center p-1 rounded border text-[11px] cursor-pointer transition ${
                mode === 'coil'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center space-x-1">
                <input
                  type="radio"
                  name={`chillerMode-${formId}`}
                  checked={mode === 'coil'}
                  onChange={() => updateParam('chillerType', 'coil')}
                  className="accent-amber-600 cursor-pointer scale-90"
                />
                <span className="font-semibold text-[11px]">コイル式</span>
              </div>
              <span className="text-[9px] text-amber-700 font-normal">SUS/U=200/10m</span>
            </label>

            {/* ③ シンク式 */}
            <label
              className={`flex flex-col items-center justify-center p-1 rounded border text-[11px] cursor-pointer transition ${
                mode === 'sink'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center space-x-1">
                <input
                  type="radio"
                  name={`chillerMode-${formId}`}
                  checked={mode === 'sink'}
                  onChange={() => updateParam('chillerType', 'sink')}
                  className="accent-emerald-600 cursor-pointer scale-90"
                />
                <span className="font-semibold text-[11px]">シンク式</span>
              </div>
              <span className="text-[9px] text-emerald-700 font-normal">アルミ寸胴/U=100</span>
            </label>
          </div>
        </div>

        {/* 2. QULIYA CHILLER 伝熱管 */}
        <div
          className={`p-1.5 rounded-lg border transition ${
            mode !== 'rotary'
              ? 'bg-slate-50/50 border-slate-200 opacity-60'
              : 'bg-slate-50/80 border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1 text-slate-800">
            <div className="flex items-center space-x-1">
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                <Gauge className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <h3 className="text-[11px] font-bold text-slate-700 leading-none">2. QULIYA CHILLER 伝熱管</h3>
            </div>
            {mode === 'sink' && (
              <span className="text-[9px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded">
                シンク式選択中
              </span>
            )}
            {mode === 'coil' && (
              <span className="text-[9px] font-mono font-semibold bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                コイル式選択中
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* 回転数 */}
            <div className="bg-white p-1.5 px-2 rounded border border-slate-200 flex flex-col justify-between">
              <label htmlFor={`rpm-${formId}`} className="text-[10px] font-semibold text-slate-700 block mb-1">回転数</label>
              <div className="relative w-full my-1 px-1.5">
                <div
                  className="absolute -top-2 z-10 flex flex-col items-center pointer-events-none"
                  style={{ left: 'calc(6px + (100% - 12px) * 0.70)', transform: 'translateX(-50%)' }}
                  title="標準値: 700rpm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white shadow-2xs" />
                  <div className="w-0.5 h-2.5 bg-amber-500" />
                </div>
                <input
                  id={`rpm-range-${formId}`}
                  type="range"
                  min="0"
                  max="1000"
                  step="100"
                  disabled={mode !== 'rotary'}
                  value={params.RPM || 0}
                  onChange={(e) => handleNumberChange('RPM', e.target.value)}
                  className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded relative z-0 block"
                />
              </div>
              <div className="flex justify-end items-center space-x-1 mt-1">
                <input
                  id={`rpm-${formId}`}
                  type="number"
                  min="0"
                  max="1000"
                  step="100"
                  disabled={mode !== 'rotary'}
                  value={params.RPM === 0 ? '' : params.RPM}
                  onChange={(e) => handleNumberChange('RPM', e.target.value)}
                  className="w-16 text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white disabled:bg-slate-100"
                />
                <span className="text-[9px] text-slate-500 font-mono">rpm</span>
              </div>
            </div>

            {/* 径 (mm) */}
            <div className="bg-white p-1.5 px-2 rounded border border-slate-200 flex flex-col justify-between">
              <label htmlFor={`exD-${formId}`} className="text-[10px] font-semibold text-slate-700 block mb-1">径 (mm)</label>
              <div className="relative w-full my-1 px-1.5">
                <div
                  className="absolute -top-2 z-10 flex flex-col items-center pointer-events-none"
                  style={{ left: 'calc(6px + (100% - 12px) * 0.6667)', transform: 'translateX(-50%)' }}
                  title="標準値: 100mm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white shadow-2xs" />
                  <div className="w-0.5 h-2.5 bg-amber-500" />
                </div>
                <input
                  id={`exD-range-${formId}`}
                  type="range"
                  min="0"
                  max="150"
                  step="50"
                  disabled={mode !== 'rotary'}
                  value={params.Ex_D_mm || 0}
                  onChange={(e) => handleNumberChange('Ex_D_mm', e.target.value)}
                  className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded relative z-0 block"
                />
              </div>
              <div className="flex justify-end items-center space-x-1 mt-1">
                <input
                  id={`exD-${formId}`}
                  type="number"
                  min="0"
                  max="150"
                  step="50"
                  disabled={mode !== 'rotary'}
                  value={params.Ex_D_mm === 0 ? '' : params.Ex_D_mm}
                  onChange={(e) => handleNumberChange('Ex_D_mm', e.target.value)}
                  className="w-14 text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white disabled:bg-slate-100"
                />
                <span className="text-[9px] text-slate-500 font-mono">mm</span>
              </div>
            </div>

            {/* 有効長 (mm) */}
            <div className="bg-white p-1.5 px-2 rounded border border-slate-200 flex flex-col justify-between">
              <label htmlFor={`exL-${formId}`} className="text-[10px] font-semibold text-slate-700 block mb-1">有効長 (mm)</label>
              <div className="relative w-full my-1 px-1.5">
                <div
                  className="absolute -top-2 z-10 flex flex-col items-center pointer-events-none"
                  style={{ left: 'calc(6px + (100% - 12px) * 0.4286)', transform: 'translateX(-50%)' }}
                  title="標準値: 300mm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white shadow-2xs" />
                  <div className="w-0.5 h-2.5 bg-amber-500" />
                </div>
                <input
                  id={`exL-range-${formId}`}
                  type="range"
                  min="0"
                  max="700"
                  step="100"
                  disabled={mode !== 'rotary'}
                  value={params.Ex_L_mm || 0}
                  onChange={(e) => handleNumberChange('Ex_L_mm', e.target.value)}
                  className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded relative z-0 block"
                />
              </div>
              <div className="flex justify-end items-center space-x-1 mt-1">
                <input
                  id={`exL-${formId}`}
                  type="number"
                  min="0"
                  max="700"
                  step="100"
                  disabled={mode !== 'rotary'}
                  value={params.Ex_L_mm === 0 ? '' : params.Ex_L_mm}
                  onChange={(e) => handleNumberChange('Ex_L_mm', e.target.value)}
                  className="w-14 text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white disabled:bg-slate-100"
                />
                <span className="text-[9px] text-slate-500 font-mono">mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 水道水条件 & 4. 環境 */}
        <div className="grid grid-cols-12 gap-1.5">
          {/* 3. 水道水条件 */}
          <div className="col-span-12 sm:col-span-6 bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
            <div className="flex items-center space-x-1 mb-1 text-slate-800">
              <Waves className="w-3 h-3 text-blue-600 shrink-0" />
              <h3 className="text-[11px] font-bold text-slate-700">3. 水道水条件</h3>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {/* 流量 */}
              <div className="bg-white p-1 rounded border border-slate-200">
                <label htmlFor={`tapFlow-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  流量 (L/min)
                </label>
                <input
                  id={`tapFlow-${formId}`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={params.TapFlow === 0 ? '' : params.TapFlow}
                  onChange={(e) => handleNumberChange('TapFlow', e.target.value)}
                  className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
                />
              </div>

              {/* 水温 */}
              <div className="bg-white p-1 rounded border border-slate-200">
                <label htmlFor={`tapTemp-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  水温 (℃)
                </label>
                <input
                  id={`tapTemp-${formId}`}
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={params.TapTemp === 0 ? '' : params.TapTemp}
                  onChange={(e) => handleNumberChange('TapTemp', e.target.value)}
                  className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
                />
              </div>
            </div>
          </div>

          {/* 4. 環境 */}
          <div className="col-span-12 sm:col-span-6 bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
            <div className="flex items-center space-x-1 mb-1 text-slate-800">
              <Wind className="w-3 h-3 text-cyan-600 shrink-0" />
              <h3 className="text-[11px] font-bold text-slate-700">4. 環境</h3>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {/* 室温 */}
              <div className="bg-white p-1 rounded border border-slate-200">
                <label htmlFor={`roomTemp-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">
                  室温 (℃)
                </label>
                <input
                  id={`roomTemp-${formId}`}
                  type="number"
                  step="1"
                  value={params.RoomTemp === 0 ? '' : params.RoomTemp}
                  onChange={(e) => handleNumberChange('RoomTemp', e.target.value)}
                  className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
                />
              </div>

              {/* 湿度 */}
              <div className="bg-white p-1 rounded border border-slate-200">
                <label htmlFor={`roomRh-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">
                  湿度 (%)
                </label>
                <input
                  id={`roomRh-${formId}`}
                  type="number"
                  min="10"
                  max="100"
                  step="1"
                  value={params.RoomRH === 0 ? '' : params.RoomRH}
                  onChange={(e) => handleNumberChange('RoomRH', e.target.value)}
                  className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. スープ条件 */}
        <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
          <div className="flex items-center space-x-1 mb-1 text-slate-800">
            <Thermometer className="w-3 h-3 text-red-500 shrink-0" />
            <h3 className="text-[11px] font-bold text-slate-700">5. スープ条件</h3>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {/* スープ量 */}
            <div className="bg-white p-1 rounded border border-slate-200">
              <label htmlFor={`soupMass-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">量 (L)</label>
              <input
                id={`soupMass-${formId}`}
                type="number"
                min="1"
                max="200"
                step="1"
                value={params.Soup_mass === 0 ? '' : params.Soup_mass}
                onChange={(e) => handleNumberChange('Soup_mass', e.target.value)}
                className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
              />
            </div>

            {/* 初期温度 */}
            <div className="bg-white p-1 rounded border border-slate-200">
              <label htmlFor={`startTemp-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">初期温度 (℃)</label>
              <input
                id={`startTemp-${formId}`}
                type="number"
                min="30"
                max="100"
                step="1"
                value={params.StartTemp === 0 ? '' : params.StartTemp}
                onChange={(e) => handleNumberChange('StartTemp', e.target.value)}
                className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
              />
            </div>

            {/* 目標温度 */}
            <div
              className={`p-1 rounded border transition ${
                isTargetBelowTap
                  ? 'border-red-500 bg-red-50 ring-1 ring-red-400'
                  : 'border-emerald-300 bg-emerald-50/40'
              }`}
            >
              <label
                htmlFor={`targetTemp-${formId}`}
                className={`text-[9px] font-bold block mb-0.5 whitespace-nowrap ${
                  isTargetBelowTap ? 'text-red-700' : 'text-emerald-800'
                }`}
              >
                目標温度 (℃)
              </label>
              <input
                id={`targetTemp-${formId}`}
                type="number"
                min="5"
                max="80"
                step="1"
                value={params.customTargetTemp === 0 ? '' : (params.customTargetTemp ?? 30)}
                onChange={(e) => handleNumberChange('customTargetTemp', e.target.value)}
                className={`w-full text-[10px] px-1 py-0.5 border rounded font-mono text-right bg-white font-bold ${
                  isTargetBelowTap
                    ? 'border-red-400 text-red-700'
                    : 'border-emerald-400 text-emerald-700'
                }`}
              />
            </div>

            {/* 寸胴径 */}
            <div className="bg-white p-1 rounded border border-slate-200">
              <label htmlFor={`potD-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">寸胴径(mm)</label>
              <input
                id={`potD-${formId}`}
                type="number"
                min="200"
                max="800"
                step="10"
                value={params.Pot_D_mm === 0 ? '' : params.Pot_D_mm}
                onChange={(e) => handleNumberChange('Pot_D_mm', e.target.value)}
                className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
              />
            </div>

            {/* 寸胴高さ */}
            <div className="bg-white p-1 rounded border border-slate-200">
              <label htmlFor={`potH-${formId}`} className="text-[9px] font-semibold text-slate-700 block mb-0.5 whitespace-nowrap">寸胴高(mm)</label>
              <input
                id={`potH-${formId}`}
                type="number"
                min="200"
                max="900"
                step="10"
                value={params.Pot_H_mm === 0 ? '' : (params.Pot_H_mm ?? 390)}
                onChange={(e) => handleNumberChange('Pot_H_mm', e.target.value)}
                className="w-full text-[10px] px-1 py-0.5 border border-slate-300 rounded font-mono text-right bg-white"
              />
            </div>

            {/* 水モデル注記バナー */}
            <div className="col-span-5 mt-1 px-2 py-1 bg-cyan-50/70 border border-cyan-200/80 rounded text-[9.5px] text-cyan-900 leading-tight flex flex-wrap items-center justify-between gap-1">
              <span>※物性値：<strong>水モデル準拠</strong>（比熱・密度・粘度は水ベースで計算。実スープは固形分・粘性により冷却時間が延伸します）</span>
              <span className="font-bold text-cyan-800 bg-white px-1.5 py-0.2 rounded border border-cyan-200 shrink-0">Brix対応モデル開発中</span>
            </div>
          </div>
        </div>

        {/* 6. 計算時間設定 & 軸固定 */}
        <div className="bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-200/80 text-[10px]">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            {/* 計算最大時間 */}
            <div className="flex items-center space-x-1 shrink-0">
              <Clock className="w-3 h-3 text-cyan-600 shrink-0" />
              <label htmlFor={`maxTime-${formId}`} className="font-bold text-slate-700">計算時間:</label>
              <input
                id={`maxTime-${formId}`}
                type="number"
                min="10"
                max="300"
                step="10"
                value={params.maxTimeMin === 0 ? '' : params.maxTimeMin}
                onChange={(e) => handleNumberChange('maxTimeMin', e.target.value)}
                className="w-10 text-[10px] px-1 py-0.2 border border-slate-300 rounded font-mono text-right bg-white"
              />
              <span className="text-slate-500">分</span>
            </div>

            {/* ① 時間軸固定 */}
            <div className="flex items-center space-x-1 shrink-0">
              <label className="flex items-center space-x-1 text-slate-700 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={!!(params.fixTimeAxis || params.fixTimeAxisMax)}
                  onChange={(e) => {
                    onChange({
                      ...params,
                      fixTimeAxis: e.target.checked,
                      fixTimeAxisMax: e.target.checked,
                    });
                  }}
                  className="w-3 h-3 accent-cyan-600 rounded cursor-pointer"
                />
                <span>時間</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                disabled={!(params.fixTimeAxis || params.fixTimeAxisMax)}
                value={params.fixedTimeMin === 0 ? '' : (params.fixedTimeMin ?? '')}
                onChange={(e) => handleNumberChange('fixedTimeMin', e.target.value)}
                className="w-9 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-400">~</span>
              <input
                type="number"
                min="10"
                max="300"
                step="5"
                disabled={!(params.fixTimeAxis || params.fixTimeAxisMax)}
                value={params.fixedTimeMax === 0 ? '' : (params.fixedTimeMax ?? params.fixedTimeAxisValue ?? '')}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  onChange({
                    ...params,
                    fixedTimeMax: v,
                    fixedTimeAxisValue: v,
                  });
                }}
                className="w-10 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-500 font-mono">分</span>
            </div>

            {/* ② 温度軸固定 */}
            <div className="flex items-center space-x-1 shrink-0">
              <label className="flex items-center space-x-1 text-slate-700 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={!!params.fixTempAxis}
                  onChange={(e) => updateParam('fixTempAxis', e.target.checked)}
                  className="w-3 h-3 accent-cyan-600 rounded cursor-pointer"
                />
                <span>温度</span>
              </label>
              <input
                type="number"
                min="0"
                max="60"
                step="5"
                disabled={!params.fixTempAxis}
                value={params.fixedTempMin === 0 ? '' : (params.fixedTempMin ?? '')}
                onChange={(e) => handleNumberChange('fixedTempMin', e.target.value)}
                className="w-9 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-400">~</span>
              <input
                type="number"
                min="40"
                max="100"
                step="5"
                disabled={!params.fixTempAxis}
                value={params.fixedTempMax === 0 ? '' : (params.fixedTempMax ?? '')}
                onChange={(e) => handleNumberChange('fixedTempMax', e.target.value)}
                className="w-10 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-500 font-mono">℃</span>
            </div>

            {/* ③ 水量軸固定 */}
            <div className="flex items-center space-x-1 shrink-0">
              <label className="flex items-center space-x-1 text-slate-700 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={!!params.fixWaterAxis}
                  onChange={(e) => updateParam('fixWaterAxis', e.target.checked)}
                  className="w-3 h-3 accent-cyan-600 rounded cursor-pointer"
                />
                <span>水量</span>
              </label>
              <input
                type="number"
                min="0"
                max="500"
                step="50"
                disabled={!params.fixWaterAxis}
                value={params.fixedWaterMin === 0 ? '' : (params.fixedWaterMin ?? '')}
                onChange={(e) => handleNumberChange('fixedWaterMin', e.target.value)}
                className="w-9 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-400">~</span>
              <input
                type="number"
                min="50"
                max="3000"
                step="50"
                disabled={!params.fixWaterAxis}
                value={params.fixedWaterMax === 0 ? '' : (params.fixedWaterMax ?? '')}
                onChange={(e) => handleNumberChange('fixedWaterMax', e.target.value)}
                className="w-11 text-[10px] px-0.5 py-0.2 border border-slate-300 rounded font-mono text-right disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              />
              <span className="text-slate-500 font-mono">L</span>
            </div>
          </div>
        </div>

        {/* 条件名入力 & ケース追加ボタン */}
        <div className="pt-0.5 flex items-center gap-1.5">
          <div className="flex-1 bg-slate-50/90 p-1 px-2 rounded-lg border border-slate-200 flex items-center space-x-1.5">
            <label htmlFor={`caseName-${formId}`} className="text-[10px] font-semibold text-slate-700 shrink-0">条件名:</label>
            <input
              id={`caseName-${formId}`}
              type="text"
              value={params.caseName}
              onChange={(e) => updateParam('caseName', e.target.value)}
              placeholder="Case_Name"
              className="w-full text-[10px] font-mono px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 bg-white"
            />
          </div>

          <button
            type="button"
            onClick={onSaveCase}
            disabled={isCalculating || isTargetBelowTap}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold py-1.5 px-3 rounded-lg border border-slate-700 flex items-center justify-center space-x-1 transition text-xs cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isTargetBelowTap
                ? '目標温度が水道水温より低いため保存できません'
                : '現在の条件を固定して比較リストに追加します'
            }
          >
            <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>ケース追加</span>
          </button>
        </div>
      </div>
    </div>
  );
};