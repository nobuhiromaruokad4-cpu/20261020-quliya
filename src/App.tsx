import React, { useState, useTransition } from 'react';
import { SimulationParams, SimulationResult } from './types/simulation';
import { runSimulation, run3ModesSimulation, PRESETS } from './lib/physics';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ParameterForm } from './components/ParameterForm';
import { ChartsSection } from './components/ChartsSection';
import { CaseManager } from './components/CaseManager';
import { SalesSummaryMode } from './components/SalesSummaryMode';
import { ContactInfoCard } from './components/ContactInfoCard';

const STORAGE_KEY = 'soup_chiller_last_params_v2';

function formatTimestampCaseName(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day}_${hours}:${minutes}:${seconds}`;
}

function loadInitialParams(): SimulationParams {
  const defaultParams: SimulationParams = {
    ...PRESETS.standard.params,
    caseName: formatTimestampCaseName(),
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultParams,
        ...parsed,
        caseName: formatTimestampCaseName(),
        Brix: 0,
      };
    }
  } catch (e) {
    console.error('Failed to load params from localStorage', e);
  }
  return defaultParams;
}

export default function App() {
  const [params, setParams] = useState<SimulationParams>(() => loadInitialParams());

  const [activeResult, setActiveResult] = useState<SimulationResult>(() => {
    const initialParams = loadInitialParams();
    return runSimulation(initialParams, 'initial_standard', 0);
  });

  const [savedCases, setSavedCases] = useState<SimulationResult[]>(() => {
    const initialParams = loadInitialParams();
    return [runSimulation(initialParams, 'initial_standard', 0)];
  });

  const [threeModesData, setThreeModesData] = useState<{
    rotary: SimulationResult;
    coil: SimulationResult;
    sink: SimulationResult;
  }>(() => {
    const initialParams = loadInitialParams();
    return run3ModesSimulation(initialParams);
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('detail');

  // パラメータが変更されたら即座にlocalStorageに保存し、シミュレーションを実行・グラフへ反映
  const handleParamsChange = (newParams: SimulationParams) => {
    const cleanParams: SimulationParams = {
      ...newParams,
      Brix: 0,
    };
    setParams(cleanParams);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanParams));
    } catch (e) {
      console.error('Failed to save params to localStorage', e);
    }

    startTransition(() => {
      const activeIdx = savedCases.findIndex((c) => c.id === activeResult?.id);
      const colorIdx = activeIdx >= 0 ? activeIdx : 0;
      const result = runSimulation(cleanParams, activeResult?.id, colorIdx);
      const threeModes = run3ModesSimulation(cleanParams);

      setActiveResult(result);
      setThreeModesData(threeModes);

      if (activeIdx >= 0) {
        setSavedCases((prev) => {
          const next = [...prev];
          next[activeIdx] = result;
          return next;
        });
      }
    });
  };

  // ケースとして保存（比較リストに新規追加）
  const handleSaveCase = () => {
    setIsCalculating(true);
    setTimeout(() => {
      startTransition(() => {
        const nextColorIdx = savedCases.length;
        const currentCaseName = params.caseName.trim() || formatTimestampCaseName();
        const newCaseParams: SimulationParams = {
          ...params,
          Brix: 0,
          caseName: currentCaseName,
        };
        const result = runSimulation(newCaseParams, undefined, nextColorIdx);
        const threeModes = run3ModesSimulation(newCaseParams);

        setActiveResult(result);
        setThreeModesData(threeModes);

        const nextCaseParams = {
          ...newCaseParams,
          caseName: formatTimestampCaseName(),
        };
        setParams(nextCaseParams);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCaseParams));
        } catch (e) {
          console.error(e);
        }
        setSavedCases((prev) => [...prev, result]);
        setIsCalculating(false);
      });
    }, 30);
  };

  // ケース選択
  const handleSelectCase = (caseId: string) => {
    const found = savedCases.find((c) => c.id === caseId);
    if (found) {
      setActiveResult(found);
      const updatedParams = { ...found.params, Brix: 0 };
      setParams(updatedParams);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedParams));
      } catch (e) {
        console.error(e);
      }
      setThreeModesData(run3ModesSimulation(updatedParams));
    }
  };

  // ケース削除
  const handleDeleteCase = (caseId: string) => {
    setSavedCases((prev) => prev.filter((c) => c.id !== caseId));
  };

  // 全ケースクリア
  const handleClearAll = () => {
    if (confirm('保存されている比較ケースをクリアしますか？')) {
      const resetResult = runSimulation(params, undefined, 0);
      setActiveResult(resetResult);
      setSavedCases([resetResult]);
      setThreeModesData(run3ModesSimulation(params));
    }
  };

  // 初期化 (新デフォルト値に戻す)
  const handleReset = () => {
    if (confirm('パラメータをご指定の標準初期条件に戻しますか？')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error(e);
      }
      const defaultP: SimulationParams = {
        ...PRESETS.standard.params,
        caseName: formatTimestampCaseName(),
        Brix: 0,
      };
      setParams(defaultP);
      const res = runSimulation(defaultP, undefined, 0);
      setActiveResult(res);
      setSavedCases([res]);
      setThreeModesData(run3ModesSimulation(defaultP));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Header */}
      <Header
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-3 space-y-2.5">
        {/* === コストモード時 (A4縦・最適化レイアウト) === */}
        {viewMode === 'summary' && (
          <div className="space-y-2.5 page-break-inside-avoid">
            {/* 上段: 提案書ヘッダー・月次コスト削減・3方式スピード対比 */}
            <SalesSummaryMode
              params={params}
              onParamsChange={handleParamsChange}
              activeResult={activeResult}
              threeModesData={threeModesData}
            />

            {/* 中下段: 3方式比較グラフ（左側 約2/3・8/12） ＋ メカニズム＆お問い合わせ窓口（右側 約1/3・4/12） */}
            {/* print:grid-cols-12 を指定して印刷時も横並びを強制設定 */}
            <div className="w-full grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-2.5 print:gap-2 items-stretch page-break-inside-avoid">
              {/* 左側 (約2/3・8/12): 3方式冷却スピード比較グラフ */}
              <div className="w-full md:col-span-8 print:col-span-8 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                    <span className="font-black text-base sm:text-lg text-slate-900">
                      3方式比較
                    </span>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 font-sans leading-tight">
                    <span>※水物性モデル準拠（実スープは粘性・Brixで延伸 / </span>
                    <span className="font-bold text-cyan-800">Brix対応モデル開発中</span>
                    <span>）</span>
                  </div>
                </div>
                <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-center">
                  <ChartsSection
                    activeResult={activeResult}
                    savedResults={savedCases}
                    threeModesData={threeModesData}
                    initialTab="threeModes"
                    compact={true}
                    hideTabs={true}
                    hideHoverReadout={true}
                  />
                </div>
              </div>

              {/* 右側 (約1/3・4/12): メカニズム（上段）＋ お問い合わせ・製品窓口（下段） */}
              <div className="w-full md:col-span-4 print:col-span-4 flex flex-col">
                <ContactInfoCard />
              </div>
            </div>
          </div>
        )}

        {/* === 冷却モード時 (物理パラメータ設定・時系列データ) === */}
        {viewMode === 'detail' && (
          <>
            {/* Upper: Summary Metric Cards */}
            <section aria-label="計算サマリー指標">
              <MetricCards result={activeResult} threeModesData={threeModesData} />
            </section>

            {/* 
              Two-column layout:
              Left Parameters Form: 5 cols
              Right Charts: 7 cols
            */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
              {/* Left Column: Parameter Inputs (5 cols) */}
              <div className="lg:col-span-5 flex flex-col">
                <ParameterForm
                  params={params}
                  onChange={handleParamsChange}
                  onSaveCase={handleSaveCase}
                  isCalculating={isCalculating || isPending}
                />
              </div>

              {/* Right Column: Graphs & Analysis (7 cols) */}
              <div className="lg:col-span-7 flex flex-col">
                <ChartsSection
                  activeResult={activeResult}
                  savedResults={savedCases}
                  threeModesData={threeModesData}
                />
              </div>
            </div>

            {/* Lower Section: ケース管理・比較リスト (1列フル幅配置) */}
            <section aria-label="ケース管理・比較">
              <CaseManager
                cases={savedCases}
                activeCaseId={activeResult?.id || ''}
                onSelectCase={handleSelectCase}
                onDeleteCase={handleDeleteCase}
                onClearAll={handleClearAll}
              />
            </section>
          </>
        )}
      </main>

      {/* Footer attribution */}
      <footer className="mt-auto border-t border-slate-200 bg-white/80 py-2.5 px-4 text-center text-xs text-slate-500 no-print">
        <p className="font-mono text-[11px]">
          Developed by N.Maruoka, IMRAM, Tohoku University
        </p>
      </footer>
    </div>
  );
}