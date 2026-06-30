-- ================================================
-- ATA 스키마 v2: 채널별 모델 구조로 변경
-- 기존 테이블 삭제 후 재생성합니다
-- Supabase SQL Editor에서 실행하세요
-- ================================================

DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS model_channels;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS categories;

-- 1. 카테고리 (워시타워, 워시콤보, 트롬단품, 건조기단품)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 그룹: "카테고리 + 브랜드" 단위 (예: 워시타워-LG, 워시타워-삼성)
--    대시보드에서 ATA 기준가는 이 단위로 관리
CREATE TABLE product_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  brand TEXT NOT NULL CHECK (brand IN ('LG', 'SS')),
  ata_price INTEGER,  -- ATA 기준가 (만원)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, brand)
);

-- 3. 채널별 모델명 (쿠팡엔 W2420WHNR, 하이마트엔 WL22GEHU 식으로 다 다름)
CREATE TABLE channel_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES product_groups(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('coupang', 'gmarket', 'himart')),
  model_name TEXT NOT NULL,
  search_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, channel)
);

-- 4. 가격 이력
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_model_id UUID REFERENCES channel_models(id) ON DELETE CASCADE,
  price INTEGER,
  screenshot_url TEXT,
  raw_text TEXT,
  ata_diff INTEGER,
  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 기본 카테고리
INSERT INTO categories (name, display_order) VALUES
  ('워시타워', 1),
  ('워시콤보', 2),
  ('트롬단품', 3),
  ('건조기단품', 4);

-- 6. RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 읽기" ON categories FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON product_groups FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON channel_models FOR SELECT USING (true);
CREATE POLICY "공개 읽기" ON price_history FOR SELECT USING (true);

CREATE POLICY "anon 쓰기" ON product_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON channel_models FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 쓰기" ON price_history FOR INSERT WITH CHECK (true);
CREATE POLICY "anon 업데이트" ON product_groups FOR UPDATE USING (true);
CREATE POLICY "anon 업데이트" ON channel_models FOR UPDATE USING (true);
CREATE POLICY "anon 삭제" ON product_groups FOR DELETE USING (true);
CREATE POLICY "anon 삭제" ON channel_models FOR DELETE USING (true);
