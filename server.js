const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const RANKINGS_FILE = path.join(DATA_DIR, 'rankings.json');

// データ保存ディレクトリとファイルの初期化
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RANKINGS_FILE)) {
  fs.writeFileSync(RANKINGS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// ランキングデータの読み込み
function readRankings() {
  try {
    const data = fs.readFileSync(RANKINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read rankings:', e);
    return [];
  }
}

// ランキングデータの書き込み（アトミック更新）
function writeRankings(rankings) {
  try {
    const tempFile = `${RANKINGS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(rankings, null, 2), 'utf8');
    fs.renameSync(tempFile, RANKINGS_FILE);
    return true;
  } catch (e) {
    console.error('Failed to write rankings:', e);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // --- API: POST /api/ranking (ランキング登録) ---
  if (req.method === 'POST' && pathname === '/api/ranking') {
    const chunks = [];
    let totalLength = 0;
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength > 1e6) req.destroy(); // 1MB制限
    });

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body || '{}');
        const name = (payload.name || '名無しパズラー').toString().trim().slice(0, 20) || '名無しパズラー';
        const timeSec = Math.max(1, parseInt(payload.timeSec, 10) || 0);
        const moves = Math.max(1, parseInt(payload.moves, 10) || 0);
        const difficulty = ['beginner', 'normal', 'hard', 'master'].includes(payload.difficulty)
          ? payload.difficulty
          : 'normal';
        const hintUsed = Boolean(payload.hintUsed);

        const newEntry = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name,
          timeSec,
          moves,
          difficulty,
          hintUsed,
          createdAt: new Date().toISOString()
        };

        const rankings = readRankings();
        rankings.push(newEntry);
        writeRankings(rankings);

        // 現在の条件（同じ難易度）での順位を計算（手数最優先 -> タイム -> ヒントなし）
        const sameCategory = rankings.filter(r => r.difficulty === difficulty);
        sameCategory.sort((a, b) => {
          if (a.moves !== b.moves) return a.moves - b.moves;
          if (a.timeSec !== b.timeSec) return a.timeSec - b.timeSec;
          if (a.hintUsed !== b.hintUsed) return (a.hintUsed ? 1 : 0) - (b.hintUsed ? 1 : 0);
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        const currentRank = sameCategory.findIndex(r => r.id === newEntry.id) + 1;

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: true,
          entry: newEntry,
          rank: currentRank,
          total: sameCategory.length
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
      }
    });
    return;
  }

  // --- API: GET /api/ranking (ランキング一覧取得) ---
  if (req.method === 'GET' && pathname === '/api/ranking') {
    const period = urlObj.searchParams.get('period') || 'all'; // 'all' | 'monthly' | 'weekly'
    const difficulty = urlObj.searchParams.get('difficulty') || 'normal'; // 'all' | 'beginner' | 'normal' | 'hard' | 'master'
    const noHintOnly = urlObj.searchParams.get('noHintOnly') === 'true';

    const now = Date.now();
    let thresholdTime = 0;
    if (period === 'weekly') {
      thresholdTime = now - (7 * 24 * 60 * 60 * 1000);
    } else if (period === 'monthly') {
      thresholdTime = now - (30 * 24 * 60 * 60 * 1000);
    }

    const allRecords = readRankings();

    const filtered = allRecords.filter(item => {
      // 期間フィルター
      if (thresholdTime > 0) {
        const itemTime = new Date(item.createdAt).getTime();
        if (itemTime < thresholdTime) return false;
      }
      // 難易度フィルター
      if (difficulty !== 'all' && item.difficulty !== difficulty) {
        return false;
      }
      // ヒントなし限定フィルター
      if (noHintOnly && item.hintUsed) {
        return false;
      }
      return true;
    });

    // ソート: 手数昇順(最優先) -> タイム昇順(同手数の場合) -> ヒントなし優先 -> 達成日時降順
    filtered.sort((a, b) => {
      if (a.moves !== b.moves) return a.moves - b.moves;
      if (a.timeSec !== b.timeSec) return a.timeSec - b.timeSec;
      if (a.hintUsed !== b.hintUsed) return (a.hintUsed ? 1 : 0) - (b.hintUsed ? 1 : 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const topList = filtered.slice(0, 100);

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      period,
      difficulty,
      noHintOnly,
      count: filtered.length,
      rankings: topList
    }));
    return;
  }

  // --- 静的ファイル配信 ---
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`NumPre Shift server running at http://localhost:${PORT}/`);
});
