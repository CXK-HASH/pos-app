-- 003_add_dish_categories.sql
-- 创建菜品分类表
CREATE TABLE IF NOT EXISTS dish_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 插入默认菜品分类
INSERT INTO dish_categories (name) VALUES
  ('人气热销'),
  ('精选主食'),
  ('特色小吃'),
  ('招牌饮品')
ON CONFLICT (name) DO NOTHING;

-- 给 dishes 表添加 dish_category_id 外键
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS dish_category_id BIGINT REFERENCES dish_categories(id);

-- 更新已有菜品关联：
-- id=1 红烧肉饭 → 精选主食 (id=2)
-- id=2 珍珠奶茶 → 招牌饮品 (id=4)
-- id=3 炸鸡排 → 特色小吃 (id=3)
UPDATE dishes SET dish_category_id = 2 WHERE id = 1;
UPDATE dishes SET dish_category_id = 4 WHERE id = 2;
UPDATE dishes SET dish_category_id = 3 WHERE id = 3;

-- 启用行级安全
ALTER TABLE dish_categories ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问
DROP POLICY IF EXISTS "允许匿名访问 dish_categories" ON dish_categories;
CREATE POLICY "允许匿名访问 dish_categories" ON dish_categories FOR ALL USING (true);
