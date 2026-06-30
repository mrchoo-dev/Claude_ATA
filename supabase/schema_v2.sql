-- ================================================
-- ATA 가격 모니터링 DB 스키마 (UUID 버전)
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 모델 마스터 테이블
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  brand TEXT NOT NULL CHECK (brand IN ('LG', 'SS')),
  model_name TEXT NOT NULL,
  ata_price INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 채널별 모델 URL 테이블
CREATE TABLE IF NOT EXISTS model_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id),
  channel TEXT NOT NULL CHECK (channel IN ('coupang', 'gmarket', 'himart')),
  search_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_id, channel)
);

-- 4. 가격 이력 테이블
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id),
  channel TEXT NOT NULL,
  price INTEGER,
  screenshot_url TEXT,
  raw_text TEXT,
  ata_diff INTEGER,
  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 기본 카테고리 데이터 삽입
INSERT INTO categories (name) VALUES
  ('워시타워'),
  ('워시콤보'),
  ('트롬단품'),
  ('건조기단품')
ON CONFLICT (name) DO NOTHING;

-- 6. Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- 읽기는 모두 허용
CREATE POLICY "공개 읽기" ON categories FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON models FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON model_channels FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON price_history FOR SELECT USING (true);

-- 쓰기는 anon도 허용
CREATE POLICY "anon 쓰기" ON models FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON model_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON price_history FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 업데이트" ON models FOR UPDATE USING (true);
CREATE POLICY "anon 업데이트" ON model_channels FOR UPDATE USING (true);
