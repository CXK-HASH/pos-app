-- 001_create_dishes_and_orders.sql
-- 创建菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 插入默认菜品数据
INSERT INTO dishes (name, price, image_url) VALUES
  ('红烧肉饭', 28.00, NULL),
  ('珍珠奶茶', 15.00, NULL),
  ('炸鸡排', 12.50, NULL)
ON CONFLICT DO NOTHING;

-- 启用行级安全
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 允许匿名完全访问
DROP POLICY IF EXISTS "允许匿名访问 dishes" ON dishes;
CREATE POLICY "允许匿名访问 dishes" ON dishes FOR ALL USING (true);

DROP POLICY IF EXISTS "允许匿名访问 orders" ON orders;
CREATE POLICY "允许匿名访问 orders" ON orders FOR ALL USING (true);
