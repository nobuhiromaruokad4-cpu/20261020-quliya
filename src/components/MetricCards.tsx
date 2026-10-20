import React, { useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { SimulationResult } from '../types/simulation';

interface MetricCardsProps {
  result: SimulationResult | null;
  threeModesData?: {
    rotary: SimulationResult;
    coil: SimulationResult;
    sink: SimulationResult;
  } | null;
}

interface ModeResult {
  modeName: 'QULIYA式' | 'コイル式' | 'シンク式';
  key: 'rotary' | 'coil' | 'sink';
  time: number | null;
  waterL: number | null;
  ratioStr: string;
  isActive: boolean;
}

// 分数表現用データの定義
const COMMON_FRACTIONS = [
  { val: 1 / 10, str: '1/10' },
  { val: 1 / 9, str: '1/9' },
  { val: 1 / 8, str: '1/8' },
  { val: 1 / 7, str: '1/7' },
  { val: 1 / 6, str: '1/6' },
  { val: 1 / 5, str: '1/5' },
  { val: 1 / 4, str: '1/4' },
  { val: 1 / 3, str: '1/3' },
  { val: 2 / 5, str: '2/5' },
  { val: 1 / 2, str: '1/2' },
  { val: 3 / 5, str: '3/5' },
  { val: 2 / 3, str: '2/3' },
  { val: 3 / 4, str: '3/4' },
  { val: 4 / 5, str: '4/5' },
  { val: 5 / 6, str: '5/6' },
  { val: 1, str: '1/1' },
];

function formatRatioToSink(time: number | null, sinkTime: number | null): string {
  if (time === null || sinkTime === null || sinkTime <= 0) return '-';
  const ratio = time / sinkTime;
  if (ratio >= 0.95 && ratio <= 1.05) return '1/1';

  let best = COMMON_FRACTIONS[0];
  let minDiff = Math.abs(ratio - best.val);
  for (const f of COMMON_FRACTIONS) {
    const diff = Math.abs(ratio - f.val);
    if (diff < minDiff) {
      minDiff = diff;
      best = f;
    }
  }

  if (minDiff <= 0.08) {
    return best.str;
  }
  const approxDen = Math.round(1 / ratio);
  if (approxDen > 1 && approxDen <= 20) {
    return `1/${approxDen}`;
  }
  return ratio.toFixed(2);
}

const MODE_STYLES = {
  rotary: {
    textColor: 'text-cyan-700',
    dotColor: 'bg-cyan-600',
    timeColor: 'text-cyan-900',
    badge: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
    activeBg: 'bg-cyan-50/90 border border-cyan-300 font-bold shadow-2xs',
    inactiveBg: 'bg-white/90 border border-transparent hover:bg-slate-50',
  },
  coil: {
    textColor: 'text-amber-700',
    dotColor: 'bg-amber-500',
    timeColor: 'text-amber-900',
    badge: 'bg-amber-50 text-amber-800 border border-amber-200',
    activeBg: 'bg-amber-50/90 border border-amber-300 font-bold shadow-2xs',
    inactiveBg: 'bg-white/90 border border-transparent hover:bg-slate-50',
  },
  sink: {
    textColor: 'text-emerald-700',
    dotColor: 'bg-emerald-600',
    timeColor: 'text-emerald-900',
    badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    activeBg: 'bg-emerald-50/90 border border-emerald-300 font-bold shadow-2xs',
    inactiveBg: 'bg-white/90 border border-transparent hover:bg-slate-50',
  },
};

export const MetricCards: React.FC<MetricCardsProps> = ({ result, threeModesData }) => {
  if (!result) return null;

  const currentParams = result.params;
  const targetT = currentParams.customTargetTemp ?? 30;
  const activeMode = currentParams.chillerType || 'rotary';

  const modeSimulations = useMemo(() => {
    if (threeModesData) {
      return {
        rotaryRes: threeModesData.rotary,
        coilRes: threeModesData.coil,
        sinkRes: threeModesData.sink,
      };
    }
    return {
      rotaryRes: result,
      coilRes: result,
      sinkRes: result,
    };
  }, [threeModesData, result]);

  const buildMilestoneData = (
    getTime: (res: SimulationResult) => number | null
  ): ModeResult[] => {
    const { rotaryRes, coilRes, sinkRes } = modeSimulations;
    const tRotary = getTime(rotaryRes);
    const tCoil = getTime(coilRes);
    const tSink = getTime(sinkRes);

    const modesRaw = [
      { modeName: 'QULIYA式' as const, key: 'rotary' as const, res: rotaryRes, time: tRotary },
      { modeName: 'コイル式' as const, key: 'coil' as const, res: coilRes, time: tCoil },
      { modeName: 'シンク式' as const, key: 'sink' as const, res: sinkRes, time: tSink },
    ];

    return modesRaw.map((m) => {
      const rawTime = m.time;
      const hasReached = rawTime !== null;
      const roundedTime = hasReached ? Math.round(rawTime) : null;
      const waterL = hasReached ? Math.round(m.res.params.TapFlow * rawTime) : null;
      const ratioStr = m.key === 'sink' ? '1/1' : formatRatioToSink(rawTime, tSink);

      return {
        modeName: m.modeName,
        key: m.key,
        time: roundedTime,
        waterL,
        ratioStr,
        isActive: activeMode === m.key,
      };
    });
  };

  const milestones = [
    {
      title: '50℃ 到達',
      tempNum: '50℃',
      icon: <Flame className="w-4 h-4 text-orange-500 shrink-0" />,
      isTarget: false,
      modes: buildMilestoneData((r) => r.timeTo50C),
    },
    {
      title: '40℃ 到達',
      tempNum: '40℃',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
      isTarget: false,
      modes: buildMilestoneData((r) => r.timeTo40C),
    },
    {
      title: '30℃ 到達',
      tempNum: '30℃',
      icon: <Clock className="w-4 h-4 text-blue-500 shrink-0" />,
      isTarget: false,
      modes: buildMilestoneData((r) => r.timeTo30C),
    },
    {
      title: `目標 ${targetT}℃ 到達`,
      tempNum: `${targetT}℃`,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
      isTarget: true,
      modes: buildMilestoneData((r) => r.timeToTarget),
    },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
          <span>3方式 到達時間サマリー</span>
        </div>
        <span className="text-xs text-slate-500 font-sans">
          ※水物性モデル準拠（比熱・粘度・熱伝導率は水ベースで算出）
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {milestones.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-2.5 border shadow-2xs transition flex flex-col justify-between ${
              m.isTarget
                ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/25'
                : 'bg-white border-slate-200/90'
            }`}
          >
            {/* カードヘッダー */}
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 w-full">
              <div className="flex items-center space-x-1.5">
                {m.icon}
                <span
                  className={`text-sm sm:text-base font-bold tracking-tight leading-tight ${
                    m.isTarget ? 'text-emerald-950 font-extrabold' : 'text-slate-800'
                  }`}
                >
                  {m.title}
                </span>
              </div>
              {m.isTarget && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-600 text-white rounded-full shrink-0">
                  目標
                </span>
              )}
            </div>

            {/* 各方式の行: Gridレイアウトで「水量:」「数値」「L」の縦ライン位置を完全同期 */}
            <div className="space-y-1.5 font-mono text-xs sm:text-[13px] w-full">
              {m.modes.map((item) => {
                const style = MODE_STYLES[item.key];
                return (
                  <div
                    key={item.modeName}
                    className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-1 sm:gap-x-1.5 w-full px-2 py-1 rounded transition ${
                      item.isActive ? style.activeBg : style.inactiveBg
                    }`}
                  >
                    {/* ① ドット + 方式名 */}
                    <div className="flex items-center space-x-1 shrink-0 pr-0.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${style.dotColor} ${
                          item.isActive ? 'ring-1 ring-offset-1 ring-slate-400' : 'opacity-85'
                        }`}
                      />
                      <span className={`font-bold whitespace-nowrap text-xs sm:text-[13px] ${style.textColor}`}>
                        {item.modeName}
                      </span>
                    </div>

                    {/* ② 所要時間 */}
                    <div className="flex items-center justify-end font-bold pr-0.5">
                      <span
                        className={`text-right text-xs sm:text-sm ${
                          item.time !== null ? style.timeColor : 'text-slate-400 font-normal'
                        }`}
                      >
                        {item.time !== null ? item.time : '未達'}
                      </span>
                      {item.time !== null && (
                        <span className="text-[11px] text-slate-500 ml-0.5 font-normal">分</span>
                      )}
                    </div>

                    {/* ③ 所要時間比率バッジ */}
                    <div className="w-[34px] flex justify-center shrink-0">
                      {item.time !== null ? (
                        <span
                          className={`text-[10px] w-full text-center px-0.5 py-0.2 rounded font-bold ${style.badge}`}
                          title="所要時間比率"
                        >
                          {item.ratioStr}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">-</span>
                      )}
                    </div>

                    {/* ④ 水量ラベル */}
                    <span className="text-slate-500 text-[11px] pl-1 whitespace-nowrap shrink-0">
                      水量:
                    </span>

                    {/* ⑤ 水量数値 (固定幅・右揃えで桁数のズレを防止) */}
                    <div className="text-right shrink-0">
                      {item.time !== null ? (
                        <span className="font-bold text-blue-700 text-xs sm:text-sm inline-block min-w-[32px] sm:min-w-[36px]">
                          {item.waterL}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">未達</span>
                      )}
                    </div>

                    {/* ⑥ 単位 L */}
                    <span className="text-slate-500 text-[11px] shrink-0">L</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};