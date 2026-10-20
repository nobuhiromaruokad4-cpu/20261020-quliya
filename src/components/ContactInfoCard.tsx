import React from 'react';
import { Phone, Mail, User, Building } from 'lucide-react';

export const ContactInfoCard: React.FC = () => {
  return (
    <div className="flex flex-col gap-2.5 h-full justify-between w-full">
      {/* 1. 上段: QULIYA式急速冷却の伝熱メカニズム */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
        <div className="pb-1 border-b border-slate-100 mb-1 space-y-1">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[9.5px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shadow-2xs leading-tight">
              特許7598603
            </span>
            <span className="text-[9.5px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shadow-2xs leading-tight">
              特願2026-201346
            </span>
          </div>          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
            <span className="font-black text-base sm:text-lg text-slate-900">
              QULIYA式はなぜはやい？
            </span>
          </div>

        </div>
        <p className="text-[10.5px] text-slate-600 leading-relaxed">
          金属製円筒の中に水道水を流入させ、スープの中で連続回転。円筒の高速回転により冷却の大きな抵抗となる境膜（温度境界層）を薄くし、高い熱交換効率で急速冷却。菌の<strong className="text-red-600 font-bold">至適増殖温度帯（35℃〜40℃）を速やかに通過させて30℃へ急冷</strong>。風味維持と衛生管理向上を両立します。
        </p>
      </div>

      {/* 2. 下段: お問い合わせ・製品窓口カード */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between flex-1 shadow-xs">
        <div>
          <div className="pb-1 border-b border-slate-200 mb-1 space-y-1">
            <div className="flex items-center space-x-1.5">
              <Building className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
              <span className="text-sm font-bold text-slate-900">
                お問い合わせ・製品窓口
              </span>
            </div>
          </div>

          <div className="space-y-1 text-xs text-slate-700">
            <div>
              <div className="text-[10px] text-slate-500 font-semibold leading-tight">メーカー・製造元</div>
              <div className="text-sm font-black text-slate-900 leading-tight">
                株式会社 新越ワークス
              </div>
              <div className="text-[10.5px] text-slate-600 font-medium">
                スリースノー事業部（新潟県燕市）
              </div>
            </div>

            <div className="pt-1 border-t border-slate-200/80 space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                <span className="text-xs">
                  担当：<strong className="text-sm font-black text-slate-900">山後 隼人</strong>（さんご はやと）
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <a
                  href="tel:0256-63-5854"
                  className="text-base font-bold text-slate-800 hover:text-cyan-700 font-mono"
                >
                  0256-63-5854
                </a>
              </div>

              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <a
                  href="mailto:h-sango@shin-works.co.jp"
                  className="text-xs font-bold text-blue-600 hover:underline font-mono break-all leading-tight"
                >
                  h-sango@shin-works.co.jp
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1 mt-1">
          <div className="pt-1 border-t border-slate-200 text-[9.5px] text-slate-600 leading-tight space-y-0.5">
            <p>※貴店の寸胴鍋・スープを用いた<strong className="text-red-600 font-bold">実機冷却テスト（出張・無料）</strong>も承っております。</p>
          </div>

          {/* ロゴ表示スペース：カードの一番下（2行構成：1行目に新越ワークス・Three Snow・製品、2行目に東北大） */}
          <div className="bg-white rounded-md p-1.5 border border-slate-200 flex flex-col gap-1 shadow-2xs">
            {/* 1行目: 新越ワークス企業ロゴ / Three Snow ロゴ / プロジェクト製品ロゴ */}
            <div className="flex items-center justify-between px-1 gap-1">
              {/* 新越ワークス 企業ロゴ */}
              <a
                href="https://www.shin-works.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                title="株式会社 新越ワークス"
                className="flex items-center hover:opacity-80 transition shrink-0"
              >
                <img
                  src="https://www.shin-works.co.jp/wp-content/themes/shinetsu_works/dist/images/logo.svg"
                  alt="株式会社 新越ワークス ロゴ"
                  className="h-3 sm:h-3.5 w-auto object-contain max-w-[65px]"
                  onError={(e) => {
                    e.currentTarget.src = '/shin_works_logo.svg';
                  }}
                />
              </a>

              <div className="h-3 w-px bg-slate-200 shrink-0" />

              {/* Three Snow ロゴ */}
              <a
                href="https://www.shin-works.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                title="Three Snow (スリースノー事業部)"
                className="flex items-center hover:opacity-80 transition shrink-0"
              >
                <img
                  src="https://www.shin-works.co.jp/wp-content/uploads/2024/09/three-snow-logo.svg"
                  alt="Three Snow ロゴ"
                  className="h-3 sm:h-3.5 w-auto object-contain max-w-[55px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </a>

              <div className="h-3 w-px bg-slate-200 shrink-0" />

              {/* プロジェクト / 製品ロゴ */}
              <div className="flex items-center shrink-0" title="Project Logo">
                <img
                  src="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2ge8KOv/s-632x190_v-fs_webp_76048f0f-c9e4-44b6-89aa-2e1543bbbfff_small.webp"
                  alt="プロジェクトロゴ"
                  className="h-3 sm:h-3.5 w-auto object-contain max-w-[60px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div className="w-full h-px bg-slate-100" />

            {/* 2行目: 東北大学 多元物質科学研究所 ロゴ */}
            <div className="flex items-center justify-center py-0.5">
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
                  className="h-4.5 sm:h-5 w-auto object-contain max-w-[145px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
