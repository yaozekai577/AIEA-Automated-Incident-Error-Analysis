# AIEA 参赛作品 PPT — 设计稿 (DESIGN.md)

## 1. 画布与母版（默认三区 A/B/C）
- 画布：1280×720，16:9
- A 标题块：0–120px，主标题 32–40px bold，左padding 60px
- B 内容区：120–660px，可用 540px
- C 页脚条：660–720px，左"AIEA · AI 错误根因分析平台"，右页码 `NN / 15`，14px 灰
- 全局 padding：上下 20px，左右 60px
- 封面 / 章节过渡 / 结束页 可自定义版式（省略 C 区或简化）

## 2. 颜色系统（≤4 主色 + 中性）
| 角色 | hex | 用途 |
|------|-----|------|
| 主色 primary | `#1D4ED8` | 标题栏、主色块、图标 |
| 辅色 secondary | `#0EA5E9` | 卡片底、图表第二系列、分隔 |
| 强调 accent | `#F59E0B` | 巨型数字、关键数据、CTA |
| 文本 text | `#1E293B` | 正文 |
| 浅底 / 灰 | `#F1F5F9` / `#64748B` | 卡片底、次要文字 |

面积占比：主色≤60%，辅色≤30%，强调≤10%（Hero 可达 15–20%）；Supporting 强调≤5%、辅色≤20%。

渐变：`linear-gradient(135deg, #1D4ED8 0%, #0EA5E9 100%)` 用于标题栏/封面/章节；半透明 `rgba(29,78,216,0.08)` 用于大色块背景。

## 3. 字体系统
- 标题：`'Microsoft YaHei','PingFang SC',sans-serif`，bold
- 正文：`'Microsoft YaHei','PingFang SC',sans-serif`，regular
- 字号阶梯：封面主标 64 / 章节大字 64 / 巨型数字 96 / 页标题 34 / 卡标题 24 / 正文 20 / 脚注 14
- 巨型数字用 accent 色 + bold，与正文形成尺度跳跃

## 4. 信息密度
- 常规内容页留白 ≤ 35%；封面/章节/结束可 40–50% 但围绕焦点
- 卡片填充率 ≥ 85%，尾部元素 marginBottom 钉底
- 每页 ≥1 视觉锚点（≥44px 元素或 ≥40% B 区图）

## 5. 配图策略
- 本作品图片**由用户后续自行填充**（按用户要求留空占位）
- 架构图 / 流水线图 / 章节号等结构化元素用 **内联 SVG** 绘制（允许）
- 演示页用虚线占位框 + 文字标注（"截图占位：仪表盘"），用户替换为真实截图
- 禁止生图（用户明确要自己填图）

## 6. 页面映射表（契约）
| # | 文件 | 角色 | 版式 | L1 | 留白 | 色彩 |
|---|------|------|------|----|------|------|
| 01 | slide_01_cover | hero | 全屏渐变+骑线 | 渐变bg | 35% | 主60辅30 |
| 02 | slide_02_catalog | supporting | 左标题+右清单 | — | 25% | 主40辅25 |
| 03 | slide_03_section_bg | transition | 全屏编号大字 | 01 | 45% | 主70 |
| 04 | slide_04_painpoints | supporting | 非对称双栏 | 列表 | 22% | 主50辅20 |
| 05 | slide_05_target_users | supporting | 表格+洞察 | 表 | 28% | 主40辅20 |
| 06 | slide_06_section_arch | transition | 全屏编号大字 | 02 | 45% | 主70 |
| 07 | slide_07_pipeline | hero | 上SVG下文字 | SVG流 | 30% | 强调15 |
| 08 | slide_08_architecture | supporting | 左SVG右注 | SVG架构 | 25% | 主50辅25 |
| 09 | slide_09_section_modules | transition | 全屏编号大字 | 03 | 45% | 主70 |
| 10 | slide_10_modules | supporting | 非对称双栏 | 列表 | 20% | 主45辅20 |
| 11 | slide_11_section_tech | transition | 全屏编号大字 | 04 | 45% | 主70 |
| 12 | slide_12_highlights | supporting | 卡片网格3×2 | 卡 | 22% | 主45辅25 |
| 13 | slide_13_agent | hero | 巨型数字+洞察 | 100% | 35% | 强调20 |
| 14 | slide_14_demo | supporting | 上占位下卡 | 占位×3 | 30% | 主40辅20 |
| 15 | slide_15_ending | hero | 居中金句 | 金句 | 45% | 主60辅30 |
