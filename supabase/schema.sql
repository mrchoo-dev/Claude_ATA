-- ================================================
-- ATA 가격 모니터링 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. 카테고리 테이블 (워시타워, 워시콤보, 트롬단품, 건조기단품)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 모델 마스터 테이블
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  brand TEXT NOT NULL CHECK (brand IN ('LG', 'SS')),  -- SS = 삼성
  model_name TEXT NOT NULL,
  ata_price INTEGER,  -- ATA 기준가 (만원)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 채널별 모델 URL 테이블
CREATE TABLE IF NOT EXISTS model_channels (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES models(id),
  channel TEXT NOT NULL CHECK (channel IN ('coupang', 'gmarket', 'himart')),
  search_url TEXT,  -- 검색 URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_id, channel)
);

-- 4. 가격 이력 테이블
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES models(id),
  channel TEXT NOT NULL,
  price INTEGER,  -- 최저가 (만원)
  screenshot_url TEXT,  -- 스크린샷 저장 경로
  raw_text TEXT,  -- AI가 읽은 원본 텍스트
  ata_diff INTEGER,  -- ATA 대비 차이 (음수 = ATA보다 낮음)
  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 기본 카테고리 데이터 삽입
INSERT INTO categories (name) VALUES
  ('워시타워'),
  ('워시콤보'),
  ('트롬단품'),
  ('건조기단품')
ON CONFLICT (name) DO NOTHING;

-- 6. Row Level Security (공개 읽기, 인증된 사용자만 쓰기)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- 읽기는 모두 허용
CREATE POLICY "공개 읽기" ON categories FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON models FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON model_channels FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON price_history FOR SELECT USING (true);

-- 쓰기는 anon도 허용 (크롤러가 anon 키로 저장)
CREATE POLICY "anon 쓰기" ON models FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON model_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON price_history FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 업데이트" ON models FOR UPDATE USING (true);
CREATE POLICY "anon 업데이트" ON model_channels FOR UPDATE USING (true);
