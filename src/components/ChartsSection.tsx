import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingDown,
  Layers,
  GitCompare,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  Plugin,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SimulationResult } from '../types/simulation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartsSectionProps {
  activeResult: SimulationResult | null;
  savedResults: SimulationResult[];
  threeModesData?: {
    rotary: SimulationResult;
    coil: SimulationResult;
    sink: SimulationResult;
  } | null;
  initialTab?: 'cooling' | 'threeModes' | 'compare';
  compact?: boolean;
  hideTabs?: boolean;
  hideHoverReadout?: boolean;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  activeResult,
  savedResults,
  threeModesData,
  initialTab = 'cooling',
  compact = false,
  hideTabs = false,
  hideHoverReadout = false,
}) => {
  const [activeTab, setActiveTab] = useState<'cooling' | 'threeModes' | 'compare'>(
    initialTab
  );

  // モバイル画面（画面幅 640px 未満）の判定フック
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [coolingHover, setCoolingHover] = useState<{
    timeMin: number;
    soupTemp: number | null;
    tapOut: number | null;
    waterUsed: number | null;
  } | null>(null);

  const [threeModesHover, setThreeModesHover] = useState<{
    timeMin: number;
    rotaryTemp: number | null;
    coilTemp: number | null;
    sinkTemp: number | null;
    tapIn: number | null;
  } | null>(null);

  const [compareHover, setCompareHover] = useState<{
    timeMin: number;
    cases: { name: string; temp: number | null; color: string }[];
  } | null>(null);

  if (!activeResult) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
        <p className="text-slate-500 text-xs">パラメータを設定するとグラフが描画されます。</p>
      </div>
    );
  }

  const targetTemp = activeResult.params.customTargetTemp ?? 30;
  const timeToTarget = activeResult.timeToTarget;
  const waterAtTarget =
    timeToTarget !== null ? Math.round(activeResult.params.TapFlow * timeToTarget) : null;

  const p = activeResult.params;
  const paramsFingerprint = `${activeResult.id}_${targetTemp}_${timeToTarget}_${waterAtTarget}_${p.RPM}_${p.TapFlow}_${p.TapTemp}_${p.Soup_mass}_${p.StartTemp}_${p.Brix}_${p.Ex_D_mm}_${p.Ex_L_mm}_${p.Pot_D_mm}_${p.Pot_H_mm}_${p.chillerType}_${p.RoomTemp}_${p.RoomRH}`;

  const defaultMaxTime = 120;
  const isFixTime = !!(activeResult.params.fixTimeAxis || activeResult.params.fixTimeAxisMax);
  const timeMinVal = isFixTime ? Math.max(0, activeResult.params.fixedTimeMin ?? 0) : 0;
  const timeMaxVal = isFixTime
    ? Math.max(timeMinVal + 1, activeResult.params.fixedTimeMax ?? activeResult.params.fixedTimeAxisValue ?? defaultMaxTime)
    : Math.max(defaultMaxTime, Math.ceil(activeResult.totalTimeMin));

  const timeLabels = Array.from(
    { length: Math.max(1, timeMaxVal - timeMinVal + 1) },
    (_, i) => String(timeMinVal + i)
  );

  const interpolateFromSeries = (t: number, key: 'soupTemp' | 'tapOut' | 'qCool' | 'qEvap' | 'qConv'): number | null => {
    const series = activeResult.timeSeries;
    if (series.length === 0) return null;
    if (t <= series[0].timeMin) return series[0][key];
    if (t >= series[series.length - 1].timeMin) return series[series.length - 1][key];

    for (let i = 0; i < series.length - 1; i++) {
      const p1 = series[i];
      const p2 = series[i + 1];
      if (t >= p1.timeMin && t <= p2.timeMin) {
        if (p2.timeMin === p1.timeMin) return p1[key];
        const ratio = (t - p1.timeMin) / (p2.timeMin - p1.timeMin);
        return p1[key] + ratio * (p2[key] - p1[key]);
      }
    }
    return series[series.length - 1][key];
  };

  const soupTempData = timeLabels.map((tStr) => {
    const val = interpolateFromSeries(parseFloat(tStr), 'soupTemp');
    return val !== null ? Number(val.toFixed(2)) : null;
  });

  const tapOutData = timeLabels.map((tStr) => {
    const val = interpolateFromSeries(parseFloat(tStr), 'tapOut');
    return val !== null ? Number(val.toFixed(2)) : null;
  });

  const tapInData = timeLabels.map(() => activeResult.params.TapTemp);

  const waterUsageData = timeLabels.map((tStr) => {
    const t = parseFloat(tStr);
    return Number((activeResult.params.TapFlow * t).toFixed(1));
  });

  const isFixTemp = !!activeResult.params.fixTempAxis;
  const tempMinVal = isFixTemp ? activeResult.params.fixedTempMin ?? 10 : 0;
  const tempMaxVal = isFixTemp ? activeResult.params.fixedTempMax ?? 95 : undefined;

  const isFixWater = !!activeResult.params.fixWaterAxis;
  const waterMinVal = isFixWater ? activeResult.params.fixedWaterMin ?? 0 : 0;
  const waterMaxVal = isFixWater ? activeResult.params.fixedWaterMax ?? 500 : undefined;

  // 時間ラベルのステップ（刻み幅）決定ヘルパー
  const getStepInterval = (maxTime: number) => {
    if (isMobile) {
      if (maxTime > 300) return 60;
      if (maxTime > 150) return 30;
      return 20;
    }
    if (maxTime > 300) return 30;
    if (maxTime > 180) return 20;
    return 10;
  };

  // --- Chart 1: カスタムプラグイン ---
  const targetLinePlugin: Plugin<'line'> = {
    id: `targetLineAnnotation_${paramsFingerprint}`,
    afterDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const yScale = scales.y;
      const xScale = scales.x;
      if (!yScale || !xScale) return;

      const yPixel = yScale.getPixelForValue(targetTemp);
      if (yPixel < chartArea.top || yPixel > chartArea.bottom) return;

      ctx.save();

      if (timeToTarget !== null && timeToTarget >= timeMinVal && timeToTarget <= timeMaxVal) {
        const relIndex = timeToTarget - timeMinVal;
        const xPixel = xScale.getPixelForValue(relIndex);

        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#059669';
        ctx.moveTo(chartArea.left, yPixel);
        ctx.lineTo(xPixel, yPixel);
        ctx.stroke();

        const yWaterScale = scales.yWater;
        let yWaterPixel: number | null = null;
        if (yWaterScale && waterAtTarget !== null) {
          yWaterPixel = yWaterScale.getPixelForValue(waterAtTarget);
        }

        const topOfVerticalLine = yWaterPixel !== null ? Math.min(yPixel, yWaterPixel) : yPixel;
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#059669';
        ctx.moveTo(xPixel, topOfVerticalLine);
        ctx.lineTo(xPixel, chartArea.bottom);
        ctx.stroke();

        if (yWaterPixel !== null && yWaterPixel >= chartArea.top && yWaterPixel <= chartArea.bottom) {
          ctx.beginPath();
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = '#2563eb';
          ctx.moveTo(xPixel, yWaterPixel);
          ctx.lineTo(chartArea.right, yWaterPixel);
          ctx.stroke();

          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.arc(xPixel, yWaterPixel, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#2563eb';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.arc(xPixel, yPixel, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#059669';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        const roundedMin = Math.round(timeToTarget);
        const labelText1 = `目標 ${targetTemp}℃ 到達: ${roundedMin}分`;
        const labelText2 = `水道使用量: ${waterAtTarget}L`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const w1 = ctx.measureText(labelText1).width;
        ctx.font = 'bold 10px Inter, sans-serif';
        const w2 = ctx.measureText(labelText2).width;
        const boxW = Math.max(w1, w2) + 16;
        const boxH = 40;

        let boxX = xPixel + 10;
        if (boxX + boxW > chartArea.right - 4) {
          boxX = xPixel - boxW - 10;
        }
        if (boxX < chartArea.left + 4) {
          boxX = chartArea.left + 4;
        }

        let boxY = yPixel - boxH - 20;
        let isAbove = true;
        if (boxY < chartArea.top + 4) {
          boxY = yPixel + 20;
          isAbove = false;
        }

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#059669';
        const pointerTargetX = Math.max(boxX + 10, Math.min(boxX + boxW - 10, xPixel));
        const pointerTargetY = isAbove ? boxY + boxH : boxY;
        ctx.moveTo(xPixel, yPixel);
        ctx.lineTo(pointerTargetX, pointerTargetY);
        ctx.stroke();

        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText1, boxX + 8, boxY + 5);

        ctx.fillStyle = '#1d4ed8';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(labelText2, boxX + 8, boxY + 21);
      } else {
        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#059669';
        ctx.moveTo(chartArea.left, yPixel);
        ctx.lineTo(chartArea.right, yPixel);
        ctx.stroke();
      }

      ctx.restore();
    },
  };

  const stepInterval = getStepInterval(timeMaxVal);

  const coolingChartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'スープ温度 (℃)',
        data: soupTempData,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.05)',
        borderWidth: 2.8,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#dc2626',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        tension: 0.25,
        yAxisID: 'y',
        fill: true,
        spanGaps: true,
      },
      {
        label: '水道水 出口 (℃)',
        data: tapOutData,
        borderColor: '#f97316',
        borderWidth: 2.2,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#f97316',
        tension: 0.2,
        yAxisID: 'y',
        fill: false,
        spanGaps: true,
      },
      {
        label: '水道水 入口 (℃)',
        data: tapInData,
        borderColor: '#06b6d4',
        borderWidth: 1.8,
        borderDash: [3, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        yAxisID: 'y',
        fill: false,
      },
      {
        label: '水道水使用量 (L)',
        data: waterUsageData,
        borderColor: '#2563eb',
        borderWidth: 2.0,
        borderDash: [3, 2],
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#2563eb',
        tension: 0.1,
        yAxisID: 'yWater',
        fill: false,
        spanGaps: true,
      },
    ],
  };

  const coolingOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: compact ? 35 : 15, left: 2, top: 12, bottom: 6 },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onHover: (_event, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const timeVal = parseFloat(timeLabels[idx]);
        setCoolingHover({
          timeMin: timeVal,
          soupTemp: soupTempData[idx] ?? null,
          tapOut: tapOutData[idx] ?? null,
          waterUsed: waterUsageData[idx] ?? null,
        });
      }
    },
    plugins: {
      legend: {
        display: !compact,
        position: 'top',
        align: 'center',
        labels: {
          usePointStyle: false,
          boxWidth: 14,
          boxHeight: 3,
          font: { size: 10, family: 'Inter, sans-serif', weight: 'bold' },
          color: '#334155',
          padding: 6,
        },
      },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '冷却経過時間 (分)',
          color: '#475569',
          font: { size: 11, weight: 'bold' },
        },
        grid: {
          color: (ctx) => {
            const val = Number(timeLabels[ctx.index]);
            return val % stepInterval === 0 ? '#cbd5e1' : 'transparent';
          },
          lineWidth: (ctx) => {
            const val = Number(timeLabels[ctx.index]);
            return val % stepInterval === 0 ? 1.0 : 0;
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          font: { size: 10, weight: 'bold' },
          color: '#475569',
          callback: (_val, index) => {
            const num = Number(timeLabels[index]);
            return num % stepInterval === 0 ? `${num}` : '';
          },
        },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: '温度 (℃)',
          color: '#dc2626',
          font: { size: 11, weight: 'bold' },
        },
        min: tempMinVal,
        ...(tempMaxVal !== undefined ? { max: tempMaxVal } : {}),
        grid: {
          color: (ctx) => (ctx.tick.value % 10 === 0 ? '#cbd5e1' : '#f1f5f9'),
          lineWidth: (ctx) => (ctx.tick.value % 10 === 0 ? 1.2 : 0.8),
        },
        ticks: {
          stepSize: 10,
          font: { size: 10, weight: 'bold' },
          callback: (value) => `${value}℃`,
        },
      },
      yWater: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: '水道量(L)',
          color: '#2563eb',
          font: { size: 11, weight: 'bold' },
        },
        grid: { drawOnChartArea: false },
        min: waterMinVal,
        ...(waterMaxVal !== undefined ? { max: waterMaxVal } : {}),
        ticks: {
          font: { size: 10, weight: 'bold' },
          callback: (value) => `${value}L`,
        },
      },
    },
  };

  // --- Chart 2: 3方式比較 ---
  const threeModesSimulations = useMemo(() => {
    if (threeModesData) {
      return [
        { name: 'QULIYA式', res: threeModesData.rotary, color: '#0891b2', timeTarget: threeModesData.rotary.timeToTarget },
        { name: 'コイル式', res: threeModesData.coil, color: '#f59e0b', timeTarget: threeModesData.coil.timeToTarget },
        { name: 'シンク式', res: threeModesData.sink, color: '#059669', timeTarget: threeModesData.sink.timeToTarget },
      ];
    }
    return [
      { name: 'QULIYA式', res: activeResult, color: '#0891b2', timeTarget: activeResult.timeToTarget },
      { name: 'コイル式', res: activeResult, color: '#f59e0b', timeTarget: activeResult.timeToTarget },
      { name: 'シンク式', res: activeResult, color: '#059669', timeTarget: activeResult.timeToTarget },
    ];
  }, [threeModesData, activeResult]);

  const threeModesMaxTime = isFixTime
    ? timeMaxVal
    : Math.max(defaultMaxTime, activeResult.params.maxTimeMin || 120);

  const threeModesLabels = Array.from(
    { length: Math.max(1, Math.ceil(threeModesMaxTime) - timeMinVal + 1) },
    (_, i) => String(timeMinVal + i)
  );

  const threeStepInterval = getStepInterval(threeModesMaxTime);

  const getModeTempAtTime = (series: SimulationResult['timeSeries'], t: number): number | null => {
    if (!series || series.length === 0) return null;
    if (t <= series[0].timeMin) return series[0].soupTemp;
    if (t >= series[series.length - 1].timeMin) return series[series.length - 1].soupTemp;
    for (let i = 0; i < series.length - 1; i++) {
      const p1 = series[i];
      const p2 = series[i + 1];
      if (t >= p1.timeMin && t <= p2.timeMin) {
        const ratio = (t - p1.timeMin) / (p2.timeMin - p1.timeMin);
        return Number((p1.soupTemp + ratio * (p2.soupTemp - p1.soupTemp)).toFixed(2));
      }
    }
    return series[series.length - 1].soupTemp;
  };

  const threeModesDatasets = [
    ...threeModesSimulations.map((m) => {
      const data = threeModesLabels.map((tStr) => {
        const t = parseFloat(tStr);
        return getModeTempAtTime(m.res.timeSeries, t);
      });

      let targetTimeStr = '';
      if (m.timeTarget !== null) {
        targetTimeStr = ` (${Math.round(m.timeTarget)}分)`;
      } else {
        targetTimeStr = ' (未達)';
      }

      return {
        label: `${m.name}${targetTimeStr}`,
        data,
        borderColor: m.color,
        backgroundColor: 'transparent',
        borderWidth: 2.8,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: m.color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        spanGaps: true,
      };
    }),
    {
      label: `水温 (${activeResult.params.TapTemp}℃)`,
      data: threeModesLabels.map(() => activeResult.params.TapTemp),
      borderColor: '#06b6d4',
      borderWidth: 1.8,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      spanGaps: true,
    },
  ];

  const threeModesChartData = {
    labels: threeModesLabels,
    datasets: threeModesDatasets,
  };

  const threeModesPlugin: Plugin<'line'> = {
    id: `threeModesPlugin_${paramsFingerprint}`,
    afterDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const yScale = scales.y;
      const xScale = scales.x;
      if (!yScale || !xScale) return;

      const yPixel = yScale.getPixelForValue(targetTemp);
      if (yPixel < chartArea.top || yPixel > chartArea.bottom) return;

      ctx.save();

      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#059669';
      ctx.moveTo(chartArea.left, yPixel);
      ctx.lineTo(chartArea.right, yPixel);
      ctx.stroke();

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`目標 ${targetTemp}℃`, chartArea.left + 6, yPixel - 6);

      const tapTemp = activeResult.params.TapTemp;
      const yTapPixel = yScale.getPixelForValue(tapTemp);
      if (yTapPixel >= chartArea.top && yTapPixel <= chartArea.bottom) {
        ctx.fillStyle = '#0891b2';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`水温 ${tapTemp}℃`, chartArea.left + 6, yTapPixel + 13);
      }

      threeModesSimulations.forEach((m, idx) => {
        if (m.timeTarget !== null) {
          if (m.timeTarget >= timeMinVal && m.timeTarget <= threeModesMaxTime) {
            const relIndex = m.timeTarget - timeMinVal;
            const xPixel = xScale.getPixelForValue(relIndex);

            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = m.color;
            ctx.moveTo(xPixel, yPixel);
            ctx.lineTo(xPixel, chartArea.bottom);
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(xPixel, yPixel, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = m.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            const badgeText = `${m.name}: ${Math.round(m.timeTarget)}分`;
            ctx.font = 'bold 10px Inter, sans-serif';
            const txtW = ctx.measureText(badgeText).width;
            const bW = txtW + 12;
            const bH = 18;

            const yOffset = 30 + idx * 24;
            let badgeY = yPixel - yOffset;
            let isAbove = true;
            if (badgeY < chartArea.top + 6) {
              badgeY = chartArea.top + 6 + idx * 22;
            }

            let badgeX = xPixel + (idx === 0 ? -bW / 2 : idx === 1 ? -bW / 2 : 6);
            if (badgeX + bW > chartArea.right - 4) {
              badgeX = xPixel - bW - 6;
            }
            if (badgeX < chartArea.left + 4) {
              badgeX = chartArea.left + 4;
            }

            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = m.color;
            const connectX = Math.max(badgeX + 6, Math.min(badgeX + bW - 6, xPixel));
            const connectY = isAbove ? badgeY + bH : badgeY;
            ctx.moveTo(xPixel, yPixel);
            ctx.lineTo(connectX, connectY);
            ctx.stroke();

            ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(badgeX, badgeY, bW, bH, 4);
            } else {
              ctx.rect(badgeX, badgeY, bW, bH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = 'transparent';

            ctx.fillStyle = m.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, badgeX + bW / 2, badgeY + bH / 2);
          }
        }
      });

      ctx.restore();
    },
  };

  const threeModesOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: compact ? 25 : 15, left: 2, top: 12, bottom: 6 },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onHover: (_event, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const timeVal = parseFloat(threeModesLabels[idx]);
        const rT = getModeTempAtTime(threeModesSimulations[0].res.timeSeries, timeVal);
        const cT = getModeTempAtTime(threeModesSimulations[1].res.timeSeries, timeVal);
        const sT = getModeTempAtTime(threeModesSimulations[2].res.timeSeries, timeVal);
        setThreeModesHover({
          timeMin: timeVal,
          rotaryTemp: rT,
          coilTemp: cT,
          sinkTemp: sT,
          tapIn: activeResult.params.TapTemp,
        });
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '冷却経過時間 (分)',
          color: '#475569',
          font: { size: 11, weight: 'bold' },
        },
        grid: {
          color: (ctx) => {
            const val = Number(threeModesLabels[ctx.index]);
            return val % threeStepInterval === 0 ? '#cbd5e1' : 'transparent';
          },
          lineWidth: (ctx) => {
            const val = Number(threeModesLabels[ctx.index]);
            return val % threeStepInterval === 0 ? 1.0 : 0;
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          font: { size: 10, weight: 'bold' },
          color: '#475569',
          callback: (_val, index) => {
            const num = Number(threeModesLabels[index]);
            return num % threeStepInterval === 0 ? `${num}` : '';
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'スープ温度 (℃)',
          color: '#dc2626',
          font: { size: 11, weight: 'bold' },
        },
        min: tempMinVal,
        ...(tempMaxVal !== undefined ? { max: tempMaxVal } : {}),
        grid: {
          color: (ctx) => (ctx.tick.value % 10 === 0 ? '#cbd5e1' : '#f1f5f9'),
          lineWidth: (ctx) => (ctx.tick.value % 10 === 0 ? 1.2 : 0.8),
        },
        ticks: {
          stepSize: 10,
          font: { size: 10, weight: 'bold' },
          callback: (value) => `${value}℃`,
        },
      },
    },
  };

  // --- Chart 3: 多ケース比較 ---
  const compareList = savedResults.length > 0 ? savedResults : [activeResult];
  const compareMaxTime = isFixTime
    ? timeMaxVal
    : Math.max(...compareList.map((r) => r.totalTimeMin));
  const compareLabels = Array.from(
    { length: Math.max(1, Math.ceil(compareMaxTime) - timeMinVal + 1) },
    (_, i) => String(timeMinVal + i)
  );

  const compareStepInterval = getStepInterval(compareMaxTime);

  const compareChartData = {
    labels: compareLabels,
    datasets: compareList.map((res) => {
      const mappedTemps = compareLabels.map((tStr) => {
        const t = parseFloat(tStr);
        return getModeTempAtTime(res.timeSeries, t);
      });

      const modeLabel =
        res.params.chillerType === 'sink'
          ? 'シンク式'
          : res.params.chillerType === 'coil'
          ? 'コイル式'
          : 'QULIYA式';

      const targetTimeStr = res.timeToTarget !== null ? ` (目標: ${Math.round(res.timeToTarget)}分)` : '';

      return {
        label: `${res.caseName} [${modeLabel}]${targetTimeStr}`,
        data: mappedTemps,
        borderColor: res.color,
        backgroundColor: 'transparent',
        borderWidth: res.id === activeResult.id ? 2.8 : 1.8,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: res.color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        spanGaps: true,
      };
    }),
  };

  const compareOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: compact ? 25 : 15, left: 2, top: 12, bottom: 6 },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onHover: (_event, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const timeVal = parseFloat(compareLabels[idx]);
        const caseList = compareList.map((res) => {
          const tVal = getModeTempAtTime(res.timeSeries, timeVal);
          return {
            name: res.caseName,
            temp: tVal,
            color: res.color,
          };
        });
        setCompareHover({
          timeMin: timeVal,
          cases: caseList,
        });
      }
    },
    plugins: {
      legend: {
        display: !compact,
        position: 'top',
        align: 'center',
        labels: {
          usePointStyle: false,
          boxWidth: 14,
          boxHeight: 3,
          font: { size: 10, family: 'Inter, sans-serif', weight: 'bold' },
          color: '#334155',
          padding: 6,
        },
      },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '経過時間 (分)',
          color: '#475569',
          font: { size: 11, weight: 'bold' },
        },
        grid: {
          color: (ctx) => {
            const val = Number(compareLabels[ctx.index]);
            return val % compareStepInterval === 0 ? '#cbd5e1' : 'transparent';
          },
          lineWidth: (ctx) => {
            const val = Number(compareLabels[ctx.index]);
            return val % compareStepInterval === 0 ? 1.0 : 0;
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          font: { size: 10, weight: 'bold' },
          color: '#475569',
          callback: (_val, index) => {
            const num = Number(compareLabels[index]);
            return num % compareStepInterval === 0 ? `${num}` : '';
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'スープ温度 (℃)',
          color: '#dc2626',
          font: { size: 11, weight: 'bold' },
        },
        min: tempMinVal,
        ...(tempMaxVal !== undefined ? { max: tempMaxVal } : {}),
        grid: {
          color: (ctx) => (ctx.tick.value % 10 === 0 ? '#cbd5e1' : '#f1f5f9'),
          lineWidth: (ctx) => (ctx.tick.value % 10 === 0 ? 1.2 : 0.8),
        },
        ticks: {
          stepSize: 10,
          font: { size: 10, weight: 'bold' },
          callback: (value) => `${value}℃`,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-full">
      {!hideTabs && (
        <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('cooling')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'cooling'
                  ? 'bg-slate-800 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>冷却曲線</span>
            </button>

            <button
              onClick={() => setActiveTab('threeModes')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'threeModes'
                  ? 'bg-cyan-700 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>3方式比較</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-slate-800 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                多ケース比較
                {savedResults.length > 0 && (
                  <span className="ml-1 text-[10px] px-1 py-0 rounded-full bg-white/20 text-white font-mono">
                    {savedResults.length}
                  </span>
                )}
              </span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-sans hidden sm:block">
            ※水物性モデル準拠（水ベース伝熱計算）
          </div>
        </div>
      )}

      <div
        className={`p-2 sm:p-2.5 relative flex-1 ${
          compact
            ? 'min-h-[350px] h-[390px] print:min-h-[320px] print:h-[320px] print:p-1'
            : 'min-h-[460px] h-full flex-1'
        }`}
      >
        {activeTab === 'cooling' && (
          <Line
            key={`cooling_${paramsFingerprint}_${isFixTime}_${isFixTemp}_${isFixWater}_${timeMaxVal}_${tempMaxVal}_${waterMaxVal}_${isMobile}`}
            data={coolingChartData}
            options={coolingOptions}
            plugins={[targetLinePlugin]}
          />
        )}
        {activeTab === 'threeModes' && (
          <Line
            key={`threeModes_${paramsFingerprint}_${isFixTime}_${isFixTemp}_${threeModesMaxTime}_${isMobile}`}
            data={threeModesChartData}
            options={threeModesOptions}
            plugins={[threeModesPlugin]}
          />
        )}
        {activeTab === 'compare' && (
          <Line
            key={`compare_${compareList.length}_${isFixTime}_${isFixTemp}_${isMobile}`}
            data={compareChartData}
            options={compareOptions}
          />
        )}
      </div>

      {!hideHoverReadout && (
        <div className={`bg-slate-900 text-white px-3 text-xs flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 ${compact ? 'py-1 min-h-[28px]' : 'py-1.5 min-h-[34px]'}`}>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-xs font-semibold">プロット読取値:</span>

            {activeTab === 'cooling' && (
              coolingHover ? (
                <div className="flex items-center space-x-3.5 font-mono text-xs flex-wrap gap-y-0.5">
                  <span className="text-cyan-300 font-bold">
                    時間: {coolingHover.timeMin}分
                  </span>
                  <span className="text-rose-400 font-bold">
                    スープ: {coolingHover.soupTemp !== null ? `${coolingHover.soupTemp}℃` : '-'}
                  </span>
                  <span className="text-orange-300 font-semibold">
                    出口水温: {coolingHover.tapOut !== null ? `${coolingHover.tapOut}℃` : '-'}
                  </span>
                  <span className="text-blue-300 font-semibold">
                    水道量: {coolingHover.waterUsed !== null ? `${coolingHover.waterUsed}L` : '-'}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic">
                  グラフ上をマウスでなぞると各時点の数値が表示されます
                </span>
              )
            )}

            {activeTab === 'threeModes' && (
              threeModesHover ? (
                <div className="flex items-center space-x-3.5 font-mono text-xs flex-wrap gap-y-0.5">
                  <span className="text-cyan-300 font-bold">
                    時間: {threeModesHover.timeMin}分
                  </span>
                  <span className="text-cyan-400 font-bold">
                    QULIYA式: {threeModesHover.rotaryTemp !== null ? `${threeModesHover.rotaryTemp}℃` : '-'}
                  </span>
                  <span className="text-amber-400 font-bold">
                    コイル式: {threeModesHover.coilTemp !== null ? `${threeModesHover.coilTemp}℃` : '-'}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    シンク式: {threeModesHover.sinkTemp !== null ? `${threeModesHover.sinkTemp}℃` : '-'}
                  </span>
                  <span className="text-cyan-200 font-semibold">
                    水温: {threeModesHover.tapIn !== null ? `${threeModesHover.tapIn}℃` : '-'}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic">
                  グラフ上をマウスでなぞると3方式それぞれの温度が表示されます
                </span>
              )
            )}

            {activeTab === 'compare' && (
              compareHover ? (
                <div className="flex items-center space-x-3 font-mono text-xs flex-wrap gap-y-1">
                  <span className="text-cyan-300 font-bold mr-1">
                    時間: {compareHover.timeMin}分
                  </span>
                  {compareHover.cases.map((c, i) => (
                    <span key={i} className="flex items-center space-x-1" style={{ color: c.color }}>
                      <span className="font-semibold">{c.name}:</span>
                      <span className="font-bold">{c.temp !== null ? `${c.temp}℃` : '-'}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic">
                  グラフ上をマウスでなぞると保存ケースそれぞれの温度が表示されます
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};