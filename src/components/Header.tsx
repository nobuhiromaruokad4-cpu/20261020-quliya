import React from 'react';
import {
  Sparkles,
  Sliders,
} from 'lucide-react';

interface HeaderProps {
  viewMode: 'summary' | 'detail';
  onToggleViewMode: (mode: 'summary' | 'detail') => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onToggleViewMode,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logos & Title */}
          <div className="flex items-center space-x-3.5">
            {/* パートナー / ブランドロゴ表示エリア */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white/95 px-2.5 py-1 rounded-md shadow-xs border border-white/20">
              {/* [1] 新越ワークス 企業ロゴ */}
              <a
                href="https://www.shin-works.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                title="株式会社 新越ワークス"
                className="flex items-center hover:opacity-80 transition"
              >
                <img
                  src="https://www.shin-works.co.jp/wp-content/themes/shinetsu_works/dist/images/logo.svg"
                  alt="株式会社 新越ワークス ロゴ"
                  className="h-4 sm:h-4.5 w-auto object-contain max-w-[65px]"
                  onError={(e) => {
                    e.currentTarget.src = '/shin_works_logo.svg';
                  }}
                />
              </a>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* [2] Three Snow ロゴ */}
              <a
                href="https://www.shin-works.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                title="Three Snow (スリースノー事業部)"
                className="flex items-center hover:opacity-80 transition"
              >
                <img
                  src="https://www.shin-works.co.jp/wp-content/uploads/2024/09/three-snow-logo.svg"
                  alt="Three Snow ロゴ"
                  className="h-4 sm:h-4.5 w-auto object-contain max-w-[65px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </a>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* [3] プロジェクト / 製品ブランドロゴ */}
              <div className="flex items-center" title="Project Logo">
                <img
                  src="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2ge8KOv/s-632x190_v-fs_webp_76048f0f-c9e4-44b6-89aa-2e1543bbbfff_small.webp"
                  alt="プロジェクトロゴ"
                  className="h-4 sm:h-4.5 w-auto object-contain max-w-[70px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* [4] 東北大学 多元物質科学研究所 ロゴ */}
              <a
                href="https://www2.tagen.tohoku.ac.jp/"
                target="_blank"
                rel="noopener noreferrer"
                title="東北大学 多元物質科学研究所 (IMRAM)"
                className="flex items-center hover:opacity-80 transition"
              >
                <img
                  src="/tagen_logo.svg"
                  alt="東北大学 多元物質科学研究所 ロゴ"
                  className="h-4.5 sm:h-5 w-auto object-contain max-w-[110px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </a>
            </div>

            {/* アプリケーションタイトル & Developed by N.Maruoka, IMRAM, Tohoku University */}
            <div className="hidden sm:flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white leading-tight">
                  スープ冷却シミュレーター
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight leading-tight mt-0.5">
                Developed by N.Maruoka, IMRAM, Tohoku University
              </span>
            </div>
          </div>

          {/* Actions & View Mode Toggle */}
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle (冷却 / コスト) */}
            <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center shadow-xs">
              <button
                onClick={() => onToggleViewMode('detail')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  viewMode === 'detail'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="冷却シミュレーション・詳細物理パラメータ設定・グラフ解析"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>冷却</span>
              </button>
              <button
                onClick={() => onToggleViewMode('summary')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  viewMode === 'summary'
                    ? 'bg-cyan-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="月あたりのコスト削減・月額レンタル試算"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>コスト</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
