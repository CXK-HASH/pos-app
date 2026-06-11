# 坤坤闪购 — 即时配送平台项目纪实

> 从零搭建一个面向高校的三端即时配送平台

---

## 一、项目起源与目标

### 1.1 为什么做这个项目

校园外卖配送存在明显的痛点：
- 美团/饿了么抽成高，小商家利润被严重压缩
- 校园最后 100 米配送效率低，缺乏本地化解决方案
- 现有平台三端（消费者/商家/骑手）割裂，缺乏统一数据流转

**目标：** 搭建一个轻量级的校园即时配送平台，实现消费者下单 → 商家出餐 → 骑手配送的闭环。

### 1.2 技术选型考量

| 选型 | 方案 | 理由 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | SSR + 静态生成双模式，SEO 友好，Vercel 原生部署 |
| 语言 | TypeScript | 类型安全，重构成本低 |
| 样式 | Tailwind CSS 4 | 原子化 CSS，开发效率高 |
| 数据库 | Supabase (PostgreSQL) | 开箱即用的 Auth + 实时订阅 + RLS 行级安全 |
| 地图 | 百度地图 SDK v3.0 | 国内精度优于 Google Maps，免费额度充足 |
| AI | Dify | 开源 LLM 平台，RAG 知识库，私有化部署 |
| 部署 | Vercel | 零配置 CI/CD，自动 HTTPS，国内 CDN 加速 |

---

## 二、项目搭建过程

### 2.1 初始化阶段

```bash
npx create-next-app@latest pos-app --typescript --tailwind --eslint --app --src-dir
```

选用 App Router 模式，目录结构天然按路由组织，每个页面独立一个 `page.tsx`，API 路由放在 `api/` 下。

### 2.2 数据库设计（Supabase）

**核心表设计：**
- `merchants` — 商家信息（名称、评分、坐标、地址）
- `dishes` — 菜品（名称、价格、所属商家、分类）
- `dish_categories` — 菜品分类
- `orders` — 订单（消费者 ID、商家 ID、骑手 ID、状态、坐标）
- `user_addresses` — 用户地址历史

**Auth 设计：**
- Supabase Auth 邮箱密码登录
- `user_metadata.role` 字段区分角色：`customer` / `merchant` / `driver`
- Gatekeeper 中间件统一分流入口，登录后根据角色自动路由到对应页面

### 2.3 三端路由划分

```
/login          → 统一登录/注册
/customer/home  → 消费者首页
/merchant/[id]  → 商家详情页
/merchant/login → 商家管理后台入口
/admin/dashboard → 商家管理面板
/admin/setup    → 商家入驻表单
/driver/dashboard → 骑手工作台
/orders         → 我的订单
```

---

## 三、地图模块（最复杂的模块）

地图是整个项目的核心复杂度所在，涉及定位、坐标转换、测距、防抖等多项技术。

### 3.1 第一阶段：基础地图集成

**百度地图 SDK 加载问题：**

百度官方加载方式是 `<script src="https://api.map.baidu.com/api?v=3.0&ak=YOUR_KEY&callback=onBMapLoaded">`，但这个脚本内部调用了 `document.write()`。

**问题：** 在异步加载（Next.js `<Script>` 组件）中执行 `document.write()`，会把当前文档全部清空，导致整个页面白屏，Dify 等后续脚本全部丢失。

**解决过程：**
1. ❌ 尝试用 `async` / `defer` 属性规避 → 无效，`document.write` 在异步脚本中必清空
2. ❌ 尝试用 `<Script strategy="beforeInteractive">` → 依然白屏
3. ✅ **最终方案：** 改用百度地图的 `getscript` 核心文件：

```
https://api.map.baidu.com/getscript?v=3.0&ak=${AK}&services=&t=20260511192400
```

通过 `document.createElement('script')` 动态注入，完全绕过 `document.write`，不再清空文档。

### 3.2 第二阶段：坐标漂移问题（21km 偏移）

**现象：** GPS 获取的 WGS-84 坐标直接传给百度地图，标记位置偏移 21km。

**原因：** 中国国家测绘局要求所有地图服务商使用 GCJ-02（国测局坐标系），而 GPS 原始数据是 WGS-84 标准，两者有系统性偏差。百度更是在 GCJ-02 基础上增加了 BD-09 二次加密。

**解决方案：** `src/lib/coordConvert.ts`
- 数学算法层：通过 WGS-84 → GCJ-02 → BD-09 的数学变换公式（查表算法），纯客户端计算，零延迟
- 百度 SDK 层：通过 `BMap.Convertor.translate()` 官方转换接口做双保险
- 先走数学算法快速出结果，再走 SDK 验证，取二者交集

**落地代码（消费者首页）：**
```typescript
// GPS 定位成功后立即转换
navigator.geolocation.getCurrentPosition(async (pos) => {
  const bdCoord = await convertToBd09(pos.coords.latitude, pos.coords.longitude)
  // bdCoord 就是可直接传给百度地图的经纬度
})
```

### 3.3 第三阶段：逆地理编码防抖与并发控制

**问题：** 
1. 地图点击、定位、拖拽图钉都会触发逆地理编码请求，高频率操作会快速耗尽百度每日配额（普通开发者每天 5000-30000 次）
2. 连续快速拖拽图钉会产生大量并发请求

**解决方案：** `src/lib/baiduGuard.ts`

1. **10 分钟缓存：**
   - 以经纬度 `(lng.toFixed(4), lat.toFixed(4))` 为 key，存入 localStorage
   - 10 分钟内命中缓存的请求直接被截留，不消耗配额
   - 跨越页面、跨天访问都有效

2. **并发队列控制（≤3）：**
   ```typescript
   let activeCount = 0
   const queue = []
   // 每次请求结束后自动从队列取出下一个任务
   // 保证任何时候最多 3 个逆地理编码请求同时进行
   ```

3. **`getLocationWithGuard()` 函数**：所有逆地理编码调用统一走这个入口，自动走缓存→队列→请求→缓存更新的流程。

### 3.4 第四阶段：定位精度优化

**问题：** 用户在电脑浏览器上点"📍 定位"按钮，总是定位到错误的地址（某小区/商场），而不是实际所在的郑州工商学院。

**根因分析：**
- 台式机/笔记本没有硬件 GPS 芯片
- 浏览器 Wi-Fi 定位（基于 Wi-Fi 指纹数据库）精度有限，且数据库老旧
- 百度 SDK IP 定位返回的是运营商出口位置，完全不准

**迭代修复过程：**

| 版本 | 方案 | 结果 |
|------|------|------|
| v1 | 纯百度 SDK IP 定位 | × 定位到管城区豪都新象 |
| v2 | HTML5 GPS 优先 + IP 降级 | × IP 降级仍然不准 |
| v3 | 砍掉 IP 降级，GPS 失败就弹提示 | √ GPS 可直接获取时准确 |
| v4 | HTML5 GPS + 百度 SDK 双源竞争 | 部分情况仍被不准坐标抢先 |
| v5 | **三重策略（最终版）**：GPS 竞争 → 逆地理编码检查地址是否可疑 → 可疑则自动触发 300 米范围附近搜索取真实建筑 POI | ✅ 兼顾速度和准确性 |

**核心代码逻辑：**
```typescript
// 1. 双源同时发起
navigator.geolocation.getCurrentPosition() // HTML5 GPS
BMap.Geolocation.getCurrentPosition()      // 百度 Wi-Fi 指纹

// 2. 逆地理编码后检测地址
const suspicious = /(豪都|小区|广场|大厦|购物中心)$/.test(poiTitle)
if (suspicious) {
  // 3. 自动搜附近，取学校/楼宇类 POI
  local.searchNearby('', point, 300)
}
```

### 3.5 地图其他功能

- **点选定位**：点击地图任意位置 → 自动标记 → 逆地理编码获取地址 → 同步到搜索框
- **拖拽微调**：图钉可拖拽 → 松手后 500ms 防抖触发逆地理编码更新地址
- **搜索联想**：输入关键词 → 300ms 防抖 → 百度 LocalSearch 检索 → 下拉展示 POI 列表 → 选中即定位
- **测距**：哈弗辛公式 `getDistance()`，展示商家到消费者的直线距离

---

## 四、Dify 智能体集成

### 4.1 需求

在消费者首页右下角嵌入一个 AI 对话气泡，帮助用户推荐菜品、回答关于商品的问题。

### 4.2 嵌入方式之争

Dify 官方提供了 `embed.min.js`，但它有几个问题：
- 依赖于 `<Script>` 组件加载，与 Next.js SSR 有兼容性问题
- `embed.min.js` 内部控制图标切换（打开/关闭）
- 动画和定位样式与移动端布局冲突

**试错过程：**

| 尝试 | 结果 |
|------|------|
| Next.js `<Script>` 组件 + onLoad | × SSR 编译报错（onLoad 属性不被识别） |
| `<Script strategy="afterInteractive">` | × Dify 在 hydration 前出现样式闪烁 |
| 纯原生 `<script>` 标签注入 | ✅ 绕过一切 SSR 问题 |
| hook `window.setSvgIcon` 固定图标 | × Dify 内部直接操作 innerHTML 替换 SVG |
| CSS `background-image` 覆盖按钮 | ✅ 图标彻底固定 |

### 4.3 最终方案

**四段式注入（`layout.tsx`）：**

```
<head>
  1. CSS 样式（z-index: 999999, position: fixed, 隐藏叉号）
  2. Dify 配置脚本（token, userVariables）
</head>
<body>
  ...
  3. embed.min.js 加载
  4. 交互逻辑（遮罩层 + MutationObserver + 图标美化）
</body>
```

**关键样式：**
- `position: fixed !important` — 固定浮动在视口上，不随滚动动
- `z-index: 999999 !important` — 压过一切页面元素
- `bottom: 6rem` — 上抬避开手机底部导航栏
- `#closeIcon { display: none !important }` — 隐藏叉号，改为点击遮罩关闭
- 气泡图标用 `background-image` 内联 SVG，CSS 层固定，Dify 脚本不管怎么切换 SVG 都不影响

**交互逻辑：**
- MutationObserver 监听气泡窗口显隐 → 自动显示/隐藏气泡按钮
- 透明遮罩（z-index 999998）点击关闭聊天框
- 图标升级为圆角聊天气泡 + 三条波浪线

---

## 五、其他功能模块

### 5.1 天气组件（WeatherWidget）
- 基于 `wttr.in` API（无需 API key）
- 消费者首页顶部展示温度 + 天气图标
- 先读 localStorage 缓存，10 分钟内不重复请求

### 5.2 商家管理后台
- 商家入驻表单（品牌选择、门店设置）
- 菜品 CRUD（名称、价格、分类、上下架）
- 订单管理（待处理、配送中、已完成）

### 5.3 骑手工作台
- 订单池：展示待接单列表，骑手可抢单
- 我的订单：配送状态流转（已接单 → 配送中 → 已完成）
- 地理位置更新（待接入实时导航）

### 5.4 消费者首页搜索
- 关键词搜索 → AI 辅助分类 → 按类别筛选商家
- 地址选择（MapPicker 弹窗）→ 就近展示商家
- 分类列表 + 商家卡片（含评分、距离、优惠标识）

### 5.5 AI 智能分类
- `/api/ai-classify` — 通过大模型对用户搜索词做意图分析
- 将模糊描述（如"想吃点辣的"）映射到具体菜品分类

---

## 六、部署与运维

### 6.1 Vercel 部署

```bash
# 一键部署，自动 HTTPS
vercel --prod
# 配置自定义域名
# 旧域名: pos-app-flax.vercel.app
# CNAME: pos.mypos.cc.cd
```

每个 `git push` 自动触发 Vercel 重新构建部署，约 50s 完成。

### 6.2 环境变量

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BAIDU_MAP_AK=
```

### 6.3 版本管理

Git commit 按功能拆分明细，关键提交记录可回溯每一次决策：
- `coordConvert: WGS-84 → BD-09 坐标系转换` 
- `baiduGuard: 逆地理编码 10 分钟缓存 + 并发队列 ≤3`
- `Dify 气泡 CSS 固定图标，绕过 embed.min.js SVG 切换`
- `定位三重策略：GPS 竞争 → 地址可信度检测 → 近 POI 校正`

---

## 七、问题复盘与经验教训

### 7.1 定位最头疼

**结论：** 浏览器端没有完美的定位方案。台式机的 Wi-Fi 定位精度受限于指纹数据库质量，IP 定位精度只能到区/街道级别。当不需要极高精度时，**搜索 + 地图点选**反而比自动定位更可靠。

**教训：** 最开始应该同时提供多种定位方式让用户选择，而不是押注某一种技术方案。

### 7.2 第三方 SDK 集成要充分测试

百度地图的 `document.write` 问题如果提前看官方文档的已知问题，可以少走弯路。`getscript` 方式虽然是非官方用法，但在社区中被广泛验证。

### 7.3 Dify 嵌入不能依赖

Dify 的 `embed.min.js` 不是为 SSR 框架设计的。最终放弃 Next.js `<Script>` 组件，回到原始的 `<script>` 标签，用 CSS 硬覆盖样式差异——虽然不优雅，但最稳定。

### 7.4 React StrictMode 的双 Effect 触发

开发模式下 `useEffect` 触发两次，如果地图初始化逻辑不幂等，会导致地图重复创建、事件重复绑定。解决方案：用 `useRef` + `mountedRef` 做防抖。

### 7.5 TypeScript 的边界防御

BAI 地图 SDK 是纯 JS 的，没有类型声明。在 TypeScript 项目中，需要对 `window.BMap` 等全局变量做显式的类型断言：

```typescript
declare global {
  interface Window {
    BMap: any
    BMapLib: any
  }
}
```

虽然不完美，但在没有社区类型包的情况下是最实用的方式。

---

## 九、技术栈全景清单

### 框架与运行时

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.2.6 | 全栈 React 框架（App Router），SSR + 静态生成 + API Routes |
| **React** | 19.2.4 | 前端 UI 库，Hooks 状态管理 |
| **TypeScript** | 5.x | 类型安全，减少运行时错误 |

### UI 与样式

| 技术 | 用途 |
|------|------|
| **Tailwind CSS** | v4 | 原子化 CSS 框架，utility-first 快速布局 |
| **Tailwind CSS PostCSS** | @tailwindcss/postcss v4 | 构建时 CSS 编译 |
| **Tailwind CSS Typography / Forms** | — | 文章排版与表单样式（可选） |

### 数据库与后端服务

| 技术 | 用途 |
|------|------|
| **Supabase** | BaaS 平台：PostgreSQL 数据库 + 身份认证 + 行级安全（RLS） |
| **Supabase Auth** | 邮箱密码认证，支持角色元数据（role 字段区分三端用户） |
| **Supabase REST API** | 前端直连数据库，免后端 CRUD 代码 |
| **PostgreSQL** | (通过 Supabase) 关系型数据库，存储商家/菜品/订单/用户地址 |

### 地图与定位

| 技术 | 用途 |
|------|------|
| **百度地图 Web SDK** | v3.0 | 地图渲染、POI 搜索、逆地理编码、覆盖物标记 |
| **百度地图 getscript** | — | 绕过 document.write 问题的核心文件加载方式 |
| **HTML5 Geolocation API** | (navigator.geolocation) | 浏览器端 GPS 定位获取 WGS-84 坐标 |
| **coordConvert.ts** | 自研 | WGS-84 → GCJ-02 → BD-09 坐标系数学转换算法 |
| **Haversine Formula** | 自研 | 球面距离计算（getDistance 函数） |

### 人工智能

| 技术 | 用途 |
|------|------|
| **Dify** | 开源 LLM 平台，提供 AI 聊天对话框 + RAG 知识库 |
| **Dify Embed JS** | embed.min.js | 对话气泡嵌入客户端的官方脚本 |
| **自研 AI 分类 API** | src/app/api/ai-classify/ | 通过大模型对用户搜索词做意图分析 |
| **AI Chat API** | src/app/api/ai/chat/ | 对话式商品推荐接口 |

### 开发工具与构建

| 技术 | 用途 |
|------|------|
| **ESLint** | v9 | 代码规范检查 |
| **eslint-config-next** | 16.2.6 | Next.js 官方 ESLint 配置 |
| **Node.js** | v22+ | 运行时环境 |
| **npm** | — | 包管理 |

### 部署与 CI/CD

| 技术 | 用途 |
|------|------|
| **Vercel** | 云部署平台：自动 HTTPS、全球 CDN、持续集成 |
| **GitHub** | (CXK-HASH/pos-app) 代码托管 + 版本管理 |
| **Vercel CLI** | (vercel) 命令行一键部署与预览 |
| **自定义域名** | pos.mypos.cc.cd（CNAME 指向 Vercel） |

### 外部 API 与数据源

| 技术 | 用途 |
|------|------|
| **百度地图逆地理编码** | 坐标 → 地址（addressComponents + surroundingPois） |
| **百度地图 LocalSearch** | 关键词搜索 POI + 周边搜索 |
| **wttr.in** | 免费天气 API，无需 Key |
| **百度地图坐标转换** | BMap.Convertor.translate() SDK 级坐标系转换 |
| **Supabase Session** | 客户端持久化登录态 |

### 浏览器端存储与优化

| 技术 | 用途 |
|------|------|
| **localStorage** | 逆地理编码 10 分钟缓存、用户地址历史持久化 |
| **sessionStorage** | 临时登录态标记 |
| **MutationObserver** | 监听 Dify 气泡窗口 DOM 变更，响应式显隐按钮 |
| **防抖 (debounce)** | 搜索输入 300ms 防抖、拖拽 500ms 防抖、定位超时 12s |
| **闭包队列** | baiduGuard.ts 逆地理编码并发控制（≤3 并发） |

### 安全与验证

| 技术 | 用途 |
|------|------|
| **Supabase RLS** | Row Level Security，数据库级行权限控制 |
| **Gatekeeper 角色分流** | 登录后根据 role 元数据路由到对应页面 |
| **Bearer Token** | API 请求鉴权（supabase access_token） |

---

## 十、项目总结

### 10.1 完成的里程碑

- ✅ 三端路由体系（消费者/商家/骑手）
- ✅ 百度地图选址（搜索、定位、拖拽、测距）
- ✅ 坐标系安全转换（WGS-84 → BD-09）
- ✅ 逆地理编码配额保护（缓存 + 并发队列）
- ✅ Dify AI 对话框嵌入（移动端自适应）
- ✅ Supabase 认证 + 角色分流
- ✅ 商家入驻与菜品管理
- ✅ 订单流转
- ✅ Vercel 持续部署

### 10.2 待完善

- ❌ 骑手实时导航（需要 GPS 持续追踪）
- ❌ 支付对接（微信/支付宝）
- ❌ 通知推送（WebSocket 或第三方推送）
- ❌ 骑手 WebSocket 实时位置流

### 10.3 技术选型评分

| 技术 | 评分 | 说明 |
|------|------|------|
| Next.js 16 | ⭐⭐⭐⭐⭐ | SSR + API Routes + Vercel 无缝集成 |
| Supabase | ⭐⭐⭐⭐ | Auth 方便，但 RLS 策略配置复杂 |
| 百度地图 | ⭐⭐⭐ | 功能全但 SDK 质量一般 |
| Dify | ⭐⭐⭐⭐ | AI 能力强大，但嵌入兼容性差 |
| Tailwind CSS | ⭐⭐⭐⭐⭐ | 开发体验极佳 |

### 10.4 一句话总结

> **坤坤闪购** 是一个面向校园场景的三端即时配送平台，通过 Next.js + Supabase + 百度地图 + Dify 的技术组合，解决了"定位不准、坐标漂移、Dify 嵌入兼容"等关键技术难题，实现了消费者下单 → 商家出餐 → 骑手配送的完整链路。
