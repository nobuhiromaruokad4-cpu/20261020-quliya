import React from 'react';
import {
  Trash2,
  Eye,
  Layers,
} from 'lucide-react';
import { SimulationResult } from '../types/simulation';

interface CaseManagerProps {
  cases: SimulationResult[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onClearAll: () => void;
}

export const CaseManager: React.FC<CaseManagerProps> = ({
  cases,
  activeCaseId,
  onSelectCase,
  onDeleteCase,
  onClearAll,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden text-slate-800">
      {/* Title */}
      <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          <h3 className="font-bold text-slate-800 text-xs tracking-wide">
            シミュレーションケース管理・比較リスト
          </h3>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {cases.length} ケース
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {cases.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-rose-600 hover:text-rose-800 px-2 py-0.5 hover:bg-rose-50 rounded transition flex items-center space-x-1 cursor-pointer"
              title="保存ケースをすべて消去"
            >
              <Trash2 className="w-3 h-3" />
              <span>全件クリア</span>
            </button>
          )}
        </div>
      </div>

      {/* Case List Table */}
      {cases.length === 0 ? (
        <div className="p-3 text-center text-slate-400 text-xs">
          まだ保存されたケースはありません。「ケース追加」を押すと現在の条件を保持し、別条件との比較ができます。
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
          <table className="w-full text-left text-[11px] font-mono whitespace-nowrap">
            <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-1 font-bold">色 / ケース名</th>
                <th className="px-2 py-1 font-bold">熱交換器</th>
                <th className="px-2 py-1 font-bold">RPM</th>
                <th className="px-2 py-1 font-bold">流量 (L/min)</th>
                <th className="px-2 py-1 font-bold">水温 (℃)</th>
                <th className="px-2 py-1 font-bold">重量 (kg)</th>
                <th className="px-2 py-1 font-bold text-amber-700">40℃時間</th>
                <th className="px-2 py-1 font-bold text-blue-700">30℃時間</th>
                <th className="px-2 py-1 font-bold text-emerald-700">目標時間</th>
                <th className="px-3 py-1 text-right font-sans font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => {
                const isActive = c.id === activeCaseId;
                const mode = c.params.chillerType || 'rotary';
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 transition cursor-pointer ${
                      isActive ? 'bg-cyan-50/70 font-semibold' : ''
                    }`}
                    onClick={() => onSelectCase(c.id)}
                  >
                    <td className="px-3 py-1 flex items-center space-x-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="font-semibold text-slate-800 font-sans text-xs">
                        {c.caseName}
                      </span>
                      {isActive && (
                        <span className="text-[9px] bg-cyan-600 text-white px-1 py-0.2 rounded font-sans font-medium">
                          選択中
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <span
                        className={`px-1 py-0.2 rounded text-[10px] ${
                          mode === 'sink'
                            ? 'bg-emerald-100 text-emerald-800'
                            : mode === 'coil'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-cyan-100 text-cyan-800'
                        }`}
                      >
                        {mode === 'sink' ? 'シンク式' : mode === 'coil' ? 'コイル式' : 'QULIYA式'}
                      </span>
                    </td>
                    <td className="px-2 py-1">{c.params.RPM}</td>
                    <td className="px-2 py-1">{c.params.TapFlow}</td>
                    <td className="px-2 py-1">{c.params.TapTemp}</td>
                    <td className="px-2 py-1">{c.params.Soup_mass}</td>
                    <td className="px-2 py-1 text-amber-700 font-bold">
                      {c.timeTo40C ? `${c.timeTo40C.toFixed(1)}分` : '-'}
                    </td>
                    <td className="px-2 py-1 text-blue-700 font-bold">
                      {c.timeTo30C ? `${c.timeTo30C.toFixed(1)}分` : '-'}
                    </td>
                    <td className="px-2 py-1 text-emerald-700 font-bold">
                      {c.timeToTarget ? `${c.timeToTarget.toFixed(1)}分` : '-'}
                    </td>
                    <td className="px-3 py-1 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectCase(c.id)}
                        className="text-cyan-600 hover:text-cyan-800 p-0.5 hover:bg-cyan-50 rounded"
                        title="このケースを表示"
                      >
                        <Eye className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => onDeleteCase(c.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 hover:bg-rose-50 rounded"
                        title="このケースを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
