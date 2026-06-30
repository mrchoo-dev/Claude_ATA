// ================================================
// 회사 PC에서 항상 켜둘 대기 서버
// Vercel "지금 크롤링" 버튼이 이 서버를 호출함
// ================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runCrawler } = require('./crawler');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.LOCAL_SERVER_PORT || 4747;
const SECRET = process.env.TRIGGER_SECRET || 'change-this-secret';

let isRunning = false;

// 상태 확인용 (Vercel에서 핑 체크 가능)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', isRunning });
});

// 크롤링 트리거 엔드포인트
app.post('/trigger-crawl', async (req, res) => {
  const { secret } = req.body;

  if (secret !== SECRET) {
    return res.status(403).json({ success: false, error: '인증 실패' });
  }

  if (isRunning) {
    return res.status(429).json({ success: false, error: '이미 크롤링이 진행 중입니다' });
  }

  isRunning = true;
  console.log('\n📡 Vercel로부터 크롤링 요청 수신!');

  try {
    const result = await runCrawler();
    isRunning = false;
    res.json({ success: true, count: result?.count || 0 });
  } catch (err) {
    isRunning = false;
    console.error('크롤링 오류:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🖥️  로컬 대기 서버 시작됨: http://localhost:${PORT}`);
  console.log(`📡 외부에서 접속하려면 ngrok 등으로 터널링이 필요합니다.\n`);
  console.log(`✅ 대기 중... (이 창을 닫지 마세요)\n`);
});
