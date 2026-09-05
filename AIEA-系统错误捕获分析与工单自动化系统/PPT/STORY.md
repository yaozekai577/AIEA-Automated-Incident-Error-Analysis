# AIEA 参赛作品 PPT — 叙事大纲 (STORY.md)

## ① 用户意图对齐
- **目标受众**：AI 开发比赛评审 / 答辩评委
- **核心目标**：让评委相信 AIEA 是一个"完整、有创新、且由 AI Agent 7×24 自主构建"的异常全生命周期管理平台
- **PPT 长度**：15 页（Hero 4 页 ≈ 27%，落在 20–30%）
- **视觉调性**：科技现代 / 简洁专业 / 蓝青主色 + 琥珀强调
- **内容边界**：必讲——背景痛点、方案架构、功能模块、技术亮点、Agent 落地、演示占位；不讲——具体代码实现细节、内部部署账号

## ② 页面布局骨架
- 总页 15；分 4 章 + 封面/结束
- Hero 页：01 封面、07 流水线、13 Agent落地、15 结束（间隔 ≥1 个 supporting）
- Rhythm：封面 peak → 目录 valley → 章节过渡 transition → 内容 valley/peak 交替
- 非对称版式 ≥ 40%：01/02/04/07/08/10/13/14 共 8 页（53%）
- 对称版式仅用：12（卡片网格）、15（居中金句）；其余过渡页为全屏大字

## ③ 页面大纲

| # | 文件 | 类型 | 角色 | 节奏 | 版式 | 主视觉 | 字数/留白 | 色彩分配 | anti_pattern |
|---|------|------|------|------|------|--------|-----------|----------|--------------|
| 01 | slide_01_cover | cover | hero | peak | 全屏渐变+骑线大字 | 渐变背景+大标题 | 40/35% | 主60辅30 | 禁止装饰小图 |
| 02 | slide_02_catalog | catalog | supporting | valley | 左标题+右内容清单 | 六章条目 | 160/25% | 主40辅25 | 禁止等宽卡片 |
| 03 | slide_03_section_bg | section | transition | transition | 全屏编号大字 | 章节号01 | 40/45% | 主70 | 禁止铺正文 |
| 04 | slide_04_painpoints | content | supporting | valley | 非对称双栏 | 五痛点列表 | 320/22% | 主50辅20 | 禁止N卡片横排 |
| 05 | slide_05_target_users | content | supporting | valley | 表格+洞察 | 用户角色表 | 240/28% | 主40辅20 | 禁止大图顶替 |
| 06 | slide_06_section_arch | section | transition | transition | 全屏编号大字 | 章节号02 | 40/45% | 主70 | 禁止铺正文 |
| 07 | slide_07_pipeline | content | hero | peak | 上图下文(SVG流水线) | SVG端到端流 | 220/30% | 强调15 | 禁止装饰小图 |
| 08 | slide_08_architecture | content | supporting | valley | 左图右注(SVG架构) | SVG架构图 | 260/25% | 主50辅25 | 禁止等宽卡片 |
| 09 | slide_09_section_modules | section | transition | transition | 全屏编号大字 | 章节号03 | 40/45% | 主70 | 禁止铺正文 |
| 10 | slide_10_modules | content | supporting | valley | 非对称双栏(两列) | 八模块清单 | 340/20% | 主45辅20 | 禁止N卡片横排 |
| 11 | slide_11_section_tech | section | transition | transition | 全屏编号大字 | 章节号04 | 40/45% | 主70 | 禁止铺正文 |
| 12 | slide_12_highlights | content | supporting | valley | 卡片网格(3×2) | 六亮点卡 | 300/22% | 主45辅25 | 仅此1页N卡 |
| 13 | slide_13_agent | content | hero | peak | 巨型数字+洞察 | 100% AI率 | 180/35% | 强调20 | 禁止等宽卡片 |
| 14 | slide_14_demo | content | supporting | valley | 上大图+下方占位框 | 截图占位×3 | 160/30% | 主40辅20 | 占位框留白明确 |
| 15 | slide_15_ending | ending | hero | peak | 居中金句+落款 | 收束金句 | 60/45% | 主60辅30 | 禁止多元素堆砌 |
