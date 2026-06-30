// 대시보드 "지금 크롤링" 버튼이 호출하는 API
// 회사 PC의 로컬 서버(local-server.js)로 요청을 전달함

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST만 허용됩니다' });
  }

  const LOCAL_SERVER_URL = process.env.LOCAL_CRAWLER_URL; // 예: ngrok 주소
  const TRIGGER_SECRET = process.env.TRIGGER_SECRET || 'change-this-secret';

  if (!LOCAL_SERVER_URL) {
    return res.status(500).json({
      success: false,
      error: '회사 PC 크롤러 주소가 설정되지 않았습니다 (LOCAL_CRAWLER_URL 환경변수 필요)'
    });
  }

  try {
    const response = await fetch(`${LOCAL_SERVER_URL}/trigger-crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TRIGGER_SECRET }),
      signal: AbortSignal.timeout(120000) // 2분 타임아웃
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data.error || '크롤러 서버 오류' });
    }

    return res.status(200).json({ success: true, count: data.count || 0 });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '회사 PC 크롤러 서버에 연결할 수 없습니다. PC가 켜져있는지, 서버가 실행 중인지 확인해주세요.'
    });
  }
}
