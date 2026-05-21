-- 002_add_merchants.sql
-- 创建商家表
CREATE TABLE IF NOT EXISTS merchants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT 'https://placehold.co/100',
  rating NUMERIC(2, 1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 插入默认商家
INSERT INTO merchants (name, logo_url, rating) VALUES
  ('湘味木桶饭', 'https://placehold.co/100', 4.8),
  ('蜜雪冰城', 'https://placehold.co/100', 4.9)
ON CONFLICT DO NOTHING;

-- 给 dishes 表添加 merchant_id 外键
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS merchant_id BIGINT REFERENCES merchants(id);

-- 更新已有菜品的归属
-- id=1 红烧肉饭 → 湘味木桶饭 (id=1)
-- id=2 珍珠奶茶 → 蜜雪冰城 (id=2)
-- id=3 炸鸡排 → 湘味木桶饭 (id=1)
UPDATE dishes SET merchant_id = 1 WHERE id IN (1, 3);
UPDATE dishes SET merchant_id = 2 WHERE id = 2;

-- 给 orders 表添加 merchant_id 列
ALTER TABLE orders ADD COLUMN IF NOT EXISTS merchant_id BIGINT;

-- 启用行级安全
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问
DROP POLICY IF EXISTS "允许匿名访问 merchants" ON merchants;
CREATE POLICY "允许匿名访问 merchants" ON merchants FOR ALL USING (true);
