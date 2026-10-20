import express from 'express';
import { createServer as createViteServer } from 'vite';
import { runSimulation, run3ModesSimulation, PRESETS } from './src/server/physics';
import { validateAndNormalizeParams, runServerSimulation } from './src/server/simulationService';
import { SimulationParams } from './src/types/simulation';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// CORS対応 (外部からのAPI呼び出しを許可)
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 1. シミュレーション計算API (完全サーバーサイド実行)
// 新規格: { soup_mass, pot_diameter, water_temp, target_temp, flow_rate, rpm, mode }
// 互換性: { params: SimulationParams }
app.all('/api/simulate', (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method === 'GET') {
    return res.json({
      status: 'ok',
      endpoint: '/api/simulate',
      description: 'QULIYA CHILLER 伝熱物理シミュレーションAPI (POSTにてパラメータ送信)',
      parameters: {
        soup_mass: 'スープ質量 [kg] (例: 45)',
        pot_diameter: '寸胴鍋内径 [mm] (例: 450)',
        water_temp: '給水温度 [℃] (例: 18)',
        target_temp: '目標冷却温度 [℃] (デフォルト: 30)',
        flow_rate: '冷却水流量 [L/min] (例: 18)',
        rpm: '攪拌・回転数 [RPM] (例: 70)',
        mode: "'quliya' | 'coil' | 'sink' (デフォルト: 'quliya')",
      },
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};

    // 従来の内部パラメータ形式 { params } の場合
    if (body.params && typeof body.params === 'object') {
      const { params, caseId, colorIndex } = body as {
        params: SimulationParams;
        caseId?: string;
        colorIndex?: number;
      };
      const result = runSimulation(params, caseId, colorIndex ?? 0);
      return res.json(result);
    }

    // 新規格API形式: 入力バリデーション & 最小限データ返却
    const validation = validateAndNormalizeParams(body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = runServerSimulation(validation.params);
    return res.json(result);
  } catch (error: any) {
    console.error('Simulation error:', error);
    return res.status(500).json({ error: error.message || 'Simulation failed' });
  }
});

// 2. 3方式同時計算API (/api/simulate-3modes)
app.all('/api/simulate-3modes', (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};

    // 内部UI用フォーマット { params }
    if (body.params) {
      const threeModes = run3ModesSimulation(body.params);
      return res.json(threeModes);
    }

    // 新規格API形式
    const validation = validateAndNormalizeParams(body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const quliyaRes = runServerSimulation({ ...validation.params, mode: 'quliya' });
    const coilRes = runServerSimulation({ ...validation.params, mode: 'coil', rpm: 0 });
    const sinkRes = runServerSimulation({ ...validation.params, mode: 'sink', rpm: 0 });

    return res.json({
      quliya: quliyaRes,
      coil: coilRes,
      sink: sinkRes,
    });
  } catch (error: any) {
    console.error('3-Modes Simulation error:', error);
    return res.status(500).json({ error: error.message || '3-Modes simulation failed' });
  }
});

// 3. プリセット一覧API (/api/presets)
app.get('/api/presets', (_req, res) => {
  res.json(PRESETS);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running securely on http://0.0.0.0:${PORT}`);
  });
}

startServer();
