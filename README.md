# ATA 가격 모니터링 대시보드

쿠팡 / G마켓 / 하이마트 최저가를 자동 수집하고 ATA 기준가와 비교하는 대시보드입니다.

---

## 전체 구조

```
[팀원들] → Vercel 대시보드 (어디서든 접속, 조회용)
                  │
                  │ "지금 크롤링" 버튼 클릭 시
                  ▼
         ngrok 터널 (회사 PC 외부 노출)
                  │
                  ▼
       회사 PC: local-server.js (항상 켜져있음)
                  │
                  ▼
         crawler.js 실행 → 쿠팡/G마켓/하이마트 캡처
                  │
                  ▼
         Claude Vision으로 가격 읽기 → Supabase 저장
                  │
                  ▼
         스케줄러: 매주 월 9시, 토 13시 자동 실행
```

---

## 설치 순서

### 1. Supabase DB
`supabase/schema_v3.sql` 내용을 SQL Editor에서 실행 (이미 완료됨)

### 2. 회사 PC 크롤러 설치

```cmd
cd crawler
npm install
npx playwright install chromium
```

`.env` 파일에 `ANTHROPIC_API_KEY` 입력

### 3. 회사 PC 대기 서버 + ngrok 설치 (외부에서 버튼으로 호출 가능하게)

```cmd
npm run server
```

이러면 `http://localhost:4747` 에서 대기 서버가 켜짐.

**외부(Vercel)에서 접속 가능하게 ngrok 설치:**
1. [ngrok.com](https://ngrok.com) 가입 (무료)
2. ngrok 다운로드 후 압축 해제
3. CMD에서: `ngrok http 4747`
4. 나오는 주소 (예: `https://abcd1234.ngrok-free.app`) 복사

### 4. Vercel 환경변수에 ngrok 주소 추가

Vercel → Settings → Environment Variables:
- `LOCAL_CRAWLER_URL` = ngrok 주소 (예: `https://abcd1234.ngrok-free.app`)
- `TRIGGER_SECRET` = `mr.choo94`

⚠️ **ngrok 무료 버전은 PC 재시작/ngrok 재시작마다 주소가 바뀌어요.**
바뀔 때마다 Vercel 환경변수도 업데이트해야 합니다. (유료 ngrok은 고정 주소 가능)

### 5. 스케줄러 실행 (자동 수집용, 별도 창에서)

```cmd
npm run schedule
```

매주 월요일 오전 9시, 토요일 오후 1시 자동 실행됩니다.

---

## 매일 켜둬야 하는 것 (회사 PC, 별도 CMD 창 2개)

```cmd
# 창 1: 버튼 클릭 대응용 대기 서버
npm run server

# 창 2: ngrok 터널 (외부 접속 허용)
ngrok http 4747

# 창 3: 자동 스케줄러 (선택, 정기 수집용)
npm run schedule
```

---

## 관리자 비밀번호

`mr.choo94` — 모델 관리 페이지, 크롤링 수동 실행 시 필요
