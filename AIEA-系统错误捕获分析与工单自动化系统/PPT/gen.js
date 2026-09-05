/* AIEA 参赛作品 PPT 生成器 —— 纯 pptxgenjs，无原生依赖
 * 复刻 STORY.md / DESIGN.md 设计：科技蓝青主色 + 琥珀强调，1280x720(13.33x7.5")，16:9
 * 图片位置以"虚线占位框 + 标注"呈现，方便用户后续自行填充。
 */
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 });
pptx.layout = 'W16x9';
pptx.author = '研发一部 · 姚泽楷';
pptx.title = 'AIEA 参赛作品 — 成果展示';

// ---------- 设计令牌 ----------
const C = {
  primary: '1D4ED8', secondary: '0EA5E9', accent: 'F59E0B',
  text: '1E293B', light: 'F1F5F9', gray: '64748B',
  midgray: '94A3B8', white: 'FFFFFF', faint: 'F8FAFC', border: 'E2E8F0',
};
const FONT = 'Microsoft YaHei';
const pt = (px) => Math.round(px * 0.75); // px(在1280x720画布) -> pt

// ---------- 图标：antd SVG -> 白色 PNG（放在彩色色块上） ----------
const { Resvg } = require('@resvg/resvg-js');
const ICON_DIR = 'C:/Users/admin/Desktop/研发一部-姚泽楷-参赛作品/PPT/resources/icons';
const ANTD_SVG = 'D:/Java/ai开发比赛/frontend/node_modules/@ant-design/icons-svg/inline-svg/outlined';
// 自绘指纹图标（antd 无此图标）：同心弧线模拟指纹纹路，白色描边
const FP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10.5a2 2 0 0 1 2 2c0 2-.8 3-1 4.4"/><path d="M8.1 12.4a3.9 3.9 0 0 1 7.8 0c0 1-.4 2-1 3"/><path d="M5 11a7 7 0 0 1 14 0c0 2.2-.6 4.2-1.6 6.1"/><path d="M9.4 5.1A8.6 8.6 0 0 1 19 11"/><path d="M5 16.3c.7 1 1 2 1 3.3"/></svg>';

function svgToWhitePng(svg, outName, isStroke) {
  let s = svg;
  if (!/xmlns\s*=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1);
  if (!isStroke) {
    // 把具体色 / currentColor 的 fill 改为白色（保留 fill="none" 不动）
    s = s.replace(/fill="(currentColor|#[0-9a-fA-F]{3,6})"/g, 'fill="#ffffff"');
  }
  const resvg = new Resvg(s, { fitTo: { mode: 'width', value: 256 } });
  fs.writeFileSync(path.join(ICON_DIR, outName), resvg.render().asPng());
}

let ICONS = null;
function ensureIcons() {
  if (ICONS) return ICONS;
  if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });
  ICONS = {
    fingerprint: (svgToWhitePng(FP_SVG, 'fingerprint.png', true), path.join(ICON_DIR, 'fingerprint.png')),
    llm: (svgToWhitePng(fs.readFileSync(path.join(ANTD_SVG, 'robot.svg'), 'utf8'), 'robot.png', false), path.join(ICON_DIR, 'robot.png')),
    redis: (svgToWhitePng(fs.readFileSync(path.join(ANTD_SVG, 'database.svg'), 'utf8'), 'database.png', false), path.join(ICON_DIR, 'database.png')),
    pipeline: (svgToWhitePng(fs.readFileSync(path.join(ANTD_SVG, 'thunderbolt.svg'), 'utf8'), 'thunderbolt.png', false), path.join(ICON_DIR, 'thunderbolt.png')),
    degrade: (svgToWhitePng(fs.readFileSync(path.join(ANTD_SVG, 'safety.svg'), 'utf8'), 'safety.png', false), path.join(ICON_DIR, 'safety.png')),
    mask: (svgToWhitePng(fs.readFileSync(path.join(ANTD_SVG, 'eye-invisible.svg'), 'utf8'), 'eye-invisible.png', false), path.join(ICON_DIR, 'eye-invisible.png')),
  };
  return ICONS;
}

// ---------- 通用组件 ----------
function bg(slide, color) { slide.background = { color }; }

function orb(slide, x, y, w, h, transparency) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w, h, fill: { color: C.white, transparency: transparency ?? 90 }, line: { type: 'none' },
  });
}

function header(slide, title, subtitle) {
  slide.addText(
    [
      { text: title, options: { bold: true, fontSize: pt(34), color: C.text } },
      { text: '   ' + subtitle, options: { fontSize: pt(16), color: C.gray } },
    ],
    { x: 0.63, y: 0.42, w: 12.1, h: 0.78, fontFace: FONT, align: 'left', valign: 'middle' }
  );
  slide.addShape(pptx.ShapeType.line, {
    x: 0.63, y: 1.5, w: 12.07, h: 0, line: { color: C.border, width: 1 },
  });
}

function footer(slide, num) {
  slide.addText('AIEA · AI 错误根因分析平台', {
    x: 0.63, y: 6.86, w: 7, h: 0.4, fontSize: pt(14), color: C.midgray, fontFace: FONT, valign: 'middle',
  });
  slide.addText(`${num} / 15`, {
    x: 11, y: 6.86, w: 1.7, h: 0.4, fontSize: pt(14), color: C.midgray, fontFace: FONT, align: 'right', valign: 'middle',
  });
}

// 实心/描边盒子 + 居中文字
function box(slide, label, x, y, w, h, fill, tcolor, fs, bold, radius) {
  const shp = radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  const o = { x, y, w, h, fill: { color: fill }, line: { type: 'none' } };
  if (radius) o.rectRadius = radius;
  slide.addShape(shp, o);
  slide.addText(label, {
    x, y, w, h, align: 'center', valign: 'middle', fontFace: FONT,
    fontSize: fs, bold: bold !== false, color: tcolor, lineSpacingMultiple: 1.0,
  });
}
function obox(slide, label, x, y, w, h, fill, tcolor, border, fs, bold, radius) {
  const shp = radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  const o = { x, y, w, h, fill: { color: fill }, line: { color: border, width: 1.5 } };
  if (radius) o.rectRadius = radius;
  slide.addShape(shp, o);
  slide.addText(label, {
    x, y, w, h, align: 'center', valign: 'middle', fontFace: FONT,
    fontSize: fs, bold: bold !== false, color: tcolor,
  });
}
function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color: color || C.midgray, width: 2, endArrowType: 'triangle' },
  });
}
// 图片占位：虚线框 + 标注（用户后续替换为真实截图）
function placeholder(slide, x, y, w, h, label, sub) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h, fill: { color: C.faint }, line: { color: C.midgray, width: 1.75, dashType: 'dash' },
  });
  slide.addText(
    [
      { text: '【截图占位】\n', options: { fontSize: pt(20), bold: true, color: C.gray, breakLine: true } },
      { text: label, options: { fontSize: pt(20), bold: true, color: C.text, breakLine: true } },
      { text: sub, options: { fontSize: pt(14), color: C.midgray } },
    ],
    { x, y, w, h, align: 'center', valign: 'middle', fontFace: FONT, lineSpacingMultiple: 1.1 }
  );
}

// ================= 01 封面 =================
{
  const s = pptx.addSlide();
  bg(s, C.primary);
  orb(s, 9.6, -1.4, 4.0, 4.0, 92);
  orb(s, -0.9, 5.3, 3.5, 3.5, 93);
  s.addText('AI 驱动的异常全生命周期管理平台', { x: 1.05, y: 1.5, w: 11, h: 0.5, fontSize: pt(24), color: 'FFFFFF', fontFace: FONT, transparency: 8 });
  s.addText('AIEA', { x: 1.0, y: 2.15, w: 11, h: 1.7, fontSize: pt(110), bold: true, color: C.white, fontFace: FONT });
  s.addText('AI 错误根因分析与工单自动化平台', { x: 1.05, y: 4.05, w: 11, h: 0.6, fontSize: pt(30), color: 'FFFFFF', fontFace: FONT });
  s.addShape(pptx.ShapeType.rect, { x: 1.08, y: 4.75, w: 1.25, h: 0.07, fill: { color: C.accent }, line: { type: 'none' } });
  s.addText(
    [
      { text: '参赛人：研发一部 · 姚泽楷', options: { fontSize: pt(20), color: 'FFFFFF' } },
      { text: '      大模型：GLM-5.2', options: { fontSize: pt(20), color: 'FFFFFF' } },
      { text: '      代码 AI 率：100%', options: { fontSize: pt(20), color: 'FFFFFF' } },
    ],
    { x: 1.05, y: 5.4, w: 11.5, h: 0.5, fontFace: FONT }
  );
}

// ================= 02 目录 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 3.75, h: 7.5, fill: { color: C.primary }, line: { type: 'none' } });
  orb(s, 2.4, 5.6, 2.2, 2.2, 90);
  s.addText('目录', { x: 0.46, y: 2.3, w: 3, h: 0.9, fontSize: pt(52), bold: true, color: C.white, fontFace: FONT });
  s.addText('CONTENTS', { x: 0.48, y: 3.35, w: 3, h: 0.4, fontSize: pt(20), color: 'FFFFFF', fontFace: FONT, transparency: 15, charSpacing: 3 });
  s.addShape(pptx.ShapeType.rect, { x: 0.48, y: 3.95, w: 0.67, h: 0.07, fill: { color: C.accent }, line: { type: 'none' } });
  s.addText('从痛点到方案，从架构到落地，全景呈现 AIEA 的设计与实现。', { x: 0.48, y: 4.6, w: 2.85, h: 1.2, fontSize: pt(16), color: 'FFFFFF', fontFace: FONT, transparency: 20, lineSpacingMultiple: 1.6 });

  const items = [
    ['01', '项目背景与痛点', '异常处理现状与五大核心痛点'],
    ['02', '产品方案与系统架构', '端到端流水线 · 整体架构'],
    ['03', '核心功能模块', '八大功能模块一览'],
    ['04', '关键技术亮点', '去重 · 流水线 · 路由 · 零侵入'],
    ['05', '大模型与 7×24 Agent 落地', 'AI 如何构建 AI'],
    ['06', '演示与总结', '运行截图 · 价值总结'],
  ];
  let y = 1.55;
  items.forEach(([no, t, d]) => {
    s.addText(no, { x: 4.4, y, w: 0.75, h: 0.7, fontSize: pt(30), bold: true, color: C.accent, fontFace: FONT, valign: 'middle' });
    s.addText(
      [
        { text: t, options: { fontSize: pt(23), bold: true, color: C.text, breakLine: true } },
        { text: d, options: { fontSize: pt(15), color: C.gray } },
      ],
      { x: 5.25, y, w: 7.4, h: 0.7, fontFace: FONT, valign: 'middle', lineSpacingMultiple: 1.1 }
    );
    s.addShape(pptx.ShapeType.line, { x: 4.4, y: y + 0.82, w: 8.25, h: 0, line: { color: C.border, width: 1 } });
    y += 0.92;
  });
}

// ================= 章节过渡模板 =================
function section(num, title, desc) {
  const s = pptx.addSlide();
  bg(s, C.primary);
  orb(s, -1.2, -1.4, 3.6, 3.6, 92);
  orb(s, 10.5, 5.0, 3.4, 3.4, 93);
  s.addText(num, { x: 8.2, y: 0.6, w: 4.8, h: 5, fontSize: 220, bold: true, color: C.white, fontFace: FONT, align: 'right', valign: 'top', transparency: 85 });
  s.addText(`CHAPTER ${num}`, { x: 1.05, y: 2.4, w: 8, h: 0.5, fontSize: pt(28), color: C.accent, fontFace: FONT, charSpacing: 4 });
  s.addText(title, { x: 1.05, y: 3.0, w: 11, h: 1.0, fontSize: pt(66), bold: true, color: C.white, fontFace: FONT });
  s.addShape(pptx.ShapeType.rect, { x: 1.08, y: 4.15, w: 1.15, h: 0.07, fill: { color: C.accent }, line: { type: 'none' } });
  s.addText(desc, { x: 1.05, y: 4.5, w: 10.5, h: 1.2, fontSize: pt(20), color: 'FFFFFF', fontFace: FONT, transparency: 18, lineSpacingMultiple: 1.7 });
}
section('01', '项目背景与痛点', '微服务时代，异常处理仍停留在“人工翻日志—群里同步—手填工单”的低效模式。');
section('02', '产品方案与系统架构', '把“异常捕获 → 智能去重 → AI 根因分析 → 群聊通知 → 工单闭环”全自动化的端到端工具链。');
section('03', '核心功能模块', '八大模块覆盖“捕获—去重—分析—通知—工单—配置”的完整异常治理闭环。');
section('04', '关键技术亮点', '六个工程化创新点，构成 AIEA 区别于通用告警工具的核心壁垒。');

// ================= 04 背景与核心痛点 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '背景与核心痛点', '传统异常处理链路的五大结构性问题');
  // 左侧强调面板
  s.addShape(pptx.ShapeType.rect, { x: 0.63, y: 1.8, w: 3.85, h: 4.35, fill: { color: C.primary }, line: { type: 'none' } });
  s.addText(
    [
      { text: '流程长', options: { fontSize: pt(30), bold: true, color: C.white, breakLine: true } },
      { text: '重复多', options: { fontSize: pt(30), bold: true, color: C.white, breakLine: true } },
      { text: '缺沉淀', options: { fontSize: pt(30), bold: true, color: C.accent, breakLine: true } },
      { text: '\n从异常发生到人员感知，平均延迟可达数十分钟甚至数小时。', options: { fontSize: pt(18), color: 'FFFFFF', transparency: 15 } },
    ],
    { x: 0.95, y: 2.1, w: 3.2, h: 3.7, fontFace: FONT, valign: 'top', lineSpacingMultiple: 1.35 }
  );
  // 右侧 5 条
  const pains = [
    ['① 异常发现滞后', '依赖人工巡检日志，微服务跨节点排查耗时巨大。'],
    ['② 同类错误反复', '缺少指纹归集，历史排查经验无法复用。'],
    ['③ 群聊通知碎片化', '缺环境/服务/版本上下文，重要告警被淹没。'],
    ['④ 工单手工创建', '复制堆栈、填描述、指派处理人，流程割裂。'],
    ['⑤ 根因依赖经验', '定位根因靠资深开发者，新人上手慢。'],
  ];
  let y = 1.95;
  pains.forEach(([t, d]) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 4.85, y: y + 0.05, w: 0.34, h: 0.34, fill: { color: C.primary }, line: { type: 'none' }, rectRadius: 0.06 });
    s.addText(t, { x: 5.35, y, w: 7.3, h: 0.4, fontSize: pt(22), bold: true, color: C.text, fontFace: FONT });
    s.addText(d, { x: 5.35, y: y + 0.42, w: 7.4, h: 0.4, fontSize: pt(16), color: C.gray, fontFace: FONT });
    y += 0.86;
  });
  footer(s, 7);
}

// ================= 05 目标用户 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '目标用户', '面向中大型研发团队的全角色覆盖');
  const rows = [
    [
      { text: '角色', options: { bold: true, color: C.white, fontSize: pt(18), fill: { color: C.primary }, align: 'center' } },
      { text: '使用场景', options: { bold: true, color: C.white, fontSize: pt(18), fill: { color: C.primary } } },
    ],
    ['后端 / 全栈工程师', '异常自动上报，无需手工粘贴堆栈；直接在工单中看到 AI 根因'],
    [{ text: '技术负责人 / Tech Lead', options: { fill: { color: C.light } } }, { text: '通过仪表盘掌握全团队异常态势，按服务 / 环境维度治理', options: { fill: { color: C.light } } }],
    ['SRE / 运维', '配置通知路由，把不同服务告警精准推送到对应飞书 / 钉钉群'],
    [{ text: '测试 / 产品 / 值班', options: { fill: { color: C.light } } }, { text: '在群聊中第一时间收到带根因的告警卡片，快速感知风险', options: { fill: { color: C.light } } }],
  ];
  s.addTable(rows, {
    x: 0.63, y: 1.85, w: 12.07, colW: [3.6, 8.47], rowH: [0.55, 0.78, 0.78, 0.78, 0.78],
    fontSize: pt(18), fontFace: FONT, color: C.text, valign: 'middle', border: { type: 'solid', color: C.border, pt: 1 },
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.63, y: 6.0, w: 12.07, h: 0.62, fill: { color: 'FEF3E2' }, line: { type: 'none' }, rectRadius: 0.08 });
  s.addText('适用组织：采用微服务 / 多服务架构、使用飞书或钉钉协作、需要工单闭环（内置工单或 Jira）的研发团队。', { x: 0.9, y: 6.0, w: 11.5, h: 0.62, fontSize: pt(18), color: C.text, fontFace: FONT, valign: 'middle' });
  footer(s, 8);
}

// ================= 07 端到端流水线 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '端到端处理流水线', '零侵入接入 · 异步编排 · 自动闭环');
  // 业务系统（左侧）
  box(s, '业务系统\n异常', 0.45, 3.05, 1.7, 1.1, C.primary, C.white, pt(19), true);
  arrow(s, 2.15, 3.6, 2.7, 3.6, C.midgray);
  // AIEA Server 大框（标题置于顶部，不再居中，避免压住内部内容）
  s.addShape(pptx.ShapeType.roundRect, { x: 2.7, y: 1.7, w: 6.45, h: 4.3, fill: { color: C.light }, line: { color: C.secondary, width: 1.5 }, rectRadius: 0.16 });
  s.addText('AIEA Server · 异步流水线', { x: 2.95, y: 1.82, w: 6.0, h: 0.5, fontSize: pt(20), bold: true, color: C.text, fontFace: FONT, valign: 'middle' });
  // 6 个子步骤（位于标题下方，互不重叠）
  const steps = ['接入', '指纹', '去重', 'AI分析', '建单', '通知'];
  let sx = 2.95; const sw = 0.8, sgap = 0.15, sy = 2.55, sh = 0.95;
  steps.forEach((st, i) => {
    obox(s, st, sx, sy, sw, sh, C.white, C.primary, C.primary, pt(15), true, 0.08);
    if (i < steps.length - 1) arrow(s, sx + sw, sy + sh / 2, sx + sw + sgap, sy + sh / 2, C.midgray);
    sx += sw + sgap;
  });
  s.addText('接入方式：SDK · Logback Appender · 直接 HTTP（鉴权 + 限流 + 脱敏）', { x: 2.95, y: 3.7, w: 6.0, h: 0.4, fontSize: pt(15), color: C.gray, fontFace: FONT });
  s.addText('事务提交后触发异步流水线，避免脏读；任一组件故障自动降级兜底', { x: 2.95, y: 4.12, w: 6.0, h: 0.4, fontSize: pt(15), color: C.gray, fontFace: FONT });
  s.addText('RECEIVED → ANALYZING → TICKETED → NOTIFIED / SUPPRESSED', { x: 2.95, y: 4.92, w: 6.0, h: 0.4, fontSize: pt(15), bold: true, color: C.accent, fontFace: FONT });
  // 输出侧
  const outs = [['飞书群', C.secondary], ['钉钉群', C.secondary], ['Jira（可选）', C.midgray]];
  let oy = 2.3;
  outs.forEach(([t, col]) => {
    arrow(s, 9.15, oy + 0.35, 9.35, oy + 0.35, C.midgray);
    box(s, t, 9.35, oy, 2.0, 0.7, col, C.white, pt(17), true, 0.08);
    oy += 1.1;
  });
  footer(s, 9);
}

// ================= 08 系统整体架构 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '系统整体架构', 'Spring Boot 主服务 + 轻量 SDK + React 控制台');
  // 顶部两个数据源（位于 header 横线下方，不再压住标题）
  box(s, '业务 Java 服务 + aiea-sdk', 0.6, 1.62, 3.4, 0.78, C.primary, C.white, pt(15), true, 0.08);
  box(s, '本地 / 存量系统 + Logback', 4.2, 1.62, 3.4, 0.78, C.primary, C.white, pt(15), true, 0.08);
  arrow(s, 2.3, 2.4, 4.1, 2.72, C.midgray);
  arrow(s, 5.9, 2.4, 4.1, 2.72, C.midgray);
  // AIEA Server（标题置顶，模块卡片下移，不再重叠）
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 2.75, w: 7.0, h: 2.4, fill: { color: C.light }, line: { color: C.secondary, width: 1.5 }, rectRadius: 0.16 });
  s.addText('AIEA Server（Spring Boot 3.3）', { x: 0.82, y: 2.87, w: 6.6, h: 0.5, fontSize: pt(19), bold: true, color: C.text, fontFace: FONT, valign: 'middle' });
  const mods = ['接入', '指纹', '去重', '流水线', 'AI分析', '通知', '工单'];
  let mx = 0.82; const mw = 0.84, mg = 0.12, my = 3.5, mh = 1.1;
  mods.forEach((m) => { obox(s, m, mx, my, mw, mh, C.white, C.primary, C.primary, pt(14), true, 0.08); mx += mw + mg; });
  arrow(s, 4.1, 5.15, 4.1, 5.55, C.midgray);
  const dbs = [['MySQL', C.secondary], ['Redis', C.secondary], ['LLM API', C.secondary], ['飞书/钉钉', C.secondary], ['Jira(可选)', C.midgray]];
  let dx = 0.6; const dw = 1.3, dg = 0.15, dy = 5.55;
  dbs.forEach(([t, col]) => { box(s, t, dx, dy, dw, 0.62, col, C.white, pt(14), true, 0.08); dx += dw + dg; });
  // 右侧注释
  const notes = [
    ['零侵入接入', 'SDK 与 Logback Appender 两种方式，业务代码改动极小。'],
    ['异步解耦', '分析、建单、通知在事务提交后异步触发，不阻塞主链路。'],
    ['依赖可替换', '大模型、IM、Jira 均按 OpenAI 兼容协议可选接入。'],
  ];
  let ny = 1.7;
  notes.forEach(([t, d]) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 8.0, y: ny, w: 4.5, h: 1.2, fill: { color: C.light }, line: { type: 'none' }, rectRadius: 0.1 });
    s.addText(t, { x: 8.25, y: ny + 0.16, w: 4.1, h: 0.4, fontSize: pt(18), bold: true, color: C.primary, fontFace: FONT });
    s.addText(d, { x: 8.25, y: ny + 0.58, w: 4.1, h: 0.6, fontSize: pt(13), color: C.gray, fontFace: FONT, lineSpacingMultiple: 1.2 });
    ny += 1.45;
  });
  footer(s, 10);
}

// ================= 10 核心功能模块 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '核心功能模块', '覆盖异常治理全生命周期的八大能力');
  const mods = [
    ['错误接入', 'SDK / Logback Appender / HTTP 零侵入上报', C.primary],
    ['智能去重', '堆栈指纹归一化 + Redis 冷却窗口', C.primary],
    ['AI 根因分析', 'GLM-5.2 生成结构化报告，失败降级兜底', C.primary],
    ['协作通知', '飞书/钉钉按服务 + 渠道路由推送', C.primary],
    ['工单闭环', '内置工单全生命周期，不依赖 Jira', C.secondary],
    ['管理控制台', 'React 可视化，10 个页面统一管理', C.secondary],
    ['动态配置', 'DB > yaml > 默认值，前端热更新', C.secondary],
    ['敏感脱敏', '双层脱敏，上报 Token 仅展示一次', C.secondary],
  ];
  let y = 1.85;
  for (let r = 0; r < 4; r++) {
    const left = mods[r * 2], right = mods[r * 2 + 1];
    [left, right].forEach((m, c) => {
      const x = c === 0 ? 0.63 : 6.85;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.85, h: 0.95, fill: { color: C.light }, line: { type: 'none' }, rectRadius: 0.1 });
      s.addShape(pptx.ShapeType.roundRect, { x: x + 0.18, y: y + 0.22, w: 0.52, h: 0.52, fill: { color: m[2] }, line: { type: 'none' }, rectRadius: 0.1 });
      s.addText(m[0], { x: x + 0.95, y: y + 0.12, w: 4.7, h: 0.4, fontSize: pt(21), bold: true, color: C.text, fontFace: FONT });
      s.addText(m[1], { x: x + 0.95, y: y + 0.52, w: 4.7, h: 0.35, fontSize: pt(15), color: C.gray, fontFace: FONT });
    });
    y += 1.08;
  }
  footer(s, 11);
}

// ================= 12 关键技术亮点 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '关键技术亮点', '从“难题”到“突破”：六个工程化创新点');
  const ic = ensureIcons();
  const hl = [
    ['堆栈指纹归一化', '核心算法', '同错误堆栈行号/变量随机，文本比对无法归并', '去噪声→SHA-256 稳定指纹，自动聚合、收敛告警', C.primary, true, 'fingerprint'],
    ['LLM 三级缓存', '省成本', 'LLM 慢、贵、偶发格式错误', 'DB→yaml→默认三级缓存，命中跳调用 + 失败降级', C.primary, false, 'llm'],
    ['Redis 冷却去重', '防风暴', '突发错误瞬间触发海量通知与工单', '同指纹冷却窗只触发一次，限流去重合一', C.secondary, false, 'redis'],
    ['异步解耦流水线', '性能·一致', '同步分析阻塞业务、易读脏数据', '事务后触发，分析→建单→通知并行，零阻塞', C.secondary, false, 'pipeline'],
    ['全链路故障降级', '高可用', 'Redis/LLM/Jira 任一故障拖垮链路', '每组件独立兜底，主链路永不中断', C.primary, false, 'degrade'],
    ['双层敏感脱敏', '安全合规', '堆栈含 Token/密码/手机号，存储即泄露', '上报 + 存储双层脱敏，Token 仅展示一次', C.secondary, false, 'mask'],
  ];
  let y = 1.8;
  for (let r = 0; r < 2; r++) {
    let x = 0.63;
    for (let c = 0; c < 3; c++) {
      const m = hl[r * 3 + c];
      const [name, tag, hard, fix, col, core, iconKey] = m;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.95, h: 2.06, fill: { color: C.light }, line: { type: 'none' }, rectRadius: 0.12 });
      // 色块 + 图标
      s.addShape(pptx.ShapeType.roundRect, { x: x + 0.22, y: y + 0.22, w: 0.52, h: 0.52, fill: { color: core ? C.accent : col }, line: { type: 'none' }, rectRadius: 0.1 });
      s.addImage({ path: ic[iconKey], x: x + 0.22 + 0.11, y: y + 0.22 + 0.11, w: 0.30, h: 0.30 });
      // 技术名
      s.addText(name, { x: x + 0.85, y: y + 0.18, w: 2.55, h: 0.6, fontSize: pt(19), bold: true, color: C.text, fontFace: FONT, valign: 'middle' });
      // 标签
      s.addShape(pptx.ShapeType.roundRect, { x: x + 3.95 - 1.18, y: y + 0.24, w: 1.0, h: 0.36, fill: { color: core ? 'FEF3C7' : 'DBEAFE' }, line: { color: core ? C.accent : col, width: 1 }, rectRadius: 0.18 });
      s.addText(tag, { x: x + 3.95 - 1.18, y: y + 0.24, w: 1.0, h: 0.36, fontSize: pt(12), bold: true, color: core ? 'B45309' : col, fontFace: FONT, align: 'center', valign: 'middle' });
      // 难题
      s.addText([{ text: '难题　', options: { bold: true, color: 'B91C1C' } }, { text: hard, options: { color: C.gray } }], { x: x + 0.22, y: y + 0.82, w: 3.52, h: 0.55, fontSize: pt(13), fontFace: FONT, lineSpacingMultiple: 1.05, valign: 'top' });
      // 突破
      s.addText([{ text: '突破　', options: { bold: true, color: col } }, { text: fix, options: { color: C.text } }], { x: x + 0.22, y: y + 1.4, w: 3.52, h: 0.55, fontSize: pt(13), fontFace: FONT, lineSpacingMultiple: 1.05, valign: 'top' });
      x += 4.13;
    }
    y += 2.24;
  }
  footer(s, 12);
}

// ================= 13 大模型与 7×24 Agent 落地 =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '大模型与 7×24 Agent 落地', 'AI 如何构建 AI：本作品由 AI Agent 自主开发');
  // 左侧巨型数字
  s.addShape(pptx.ShapeType.roundRect, { x: 0.63, y: 1.9, w: 4.4, h: 4.2, fill: { color: C.primary }, line: { type: 'none' }, rectRadius: 0.2 });
  orb(s, 3.6, 1.6, 1.6, 1.6, 88);
  s.addText('100%', { x: 0.63, y: 2.4, w: 4.4, h: 1.8, fontSize: pt(120), bold: true, color: C.accent, fontFace: FONT, align: 'center' });
  s.addText('代码 AI 生成率', { x: 0.63, y: 4.25, w: 4.4, h: 0.5, fontSize: pt(24), bold: true, color: C.white, fontFace: FONT, align: 'center' });
  s.addText('前后端业务代码与全套配套文档，均由 AI Agent 产出', { x: 0.9, y: 4.9, w: 3.9, h: 0.9, fontSize: pt(15), color: 'FFFFFF', fontFace: FONT, transparency: 15, align: 'center', lineSpacingMultiple: 1.4 });
  // 右侧 3 点
  const pts = [
    ['调度方式', '任务驱动 + 子任务编排，按依赖串行 / 并发执行；长任务转后台，完成自动回调。'],
    ['自主任务范围', '后端主服务全模块、aiea-sdk、前端 10 页面、数据库脚本、文档、单元测试。'],
    ['落地效果', '1 人 1 周完成端到端 MVP，含降级兜底与脱敏安全，质量可交付。'],
  ];
  let y = 2.0;
  pts.forEach(([t, d]) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 5.4, y, w: 0.34, h: 0.34, fill: { color: C.primary }, line: { type: 'none' }, rectRadius: 0.06 });
    s.addText(t, { x: 5.9, y, w: 6.7, h: 0.4, fontSize: pt(22), bold: true, color: C.text, fontFace: FONT });
    s.addText(d, { x: 5.9, y: y + 0.42, w: 6.8, h: 0.7, fontSize: pt(16), color: C.gray, fontFace: FONT, lineSpacingMultiple: 1.3 });
    y += 1.4;
  });
  footer(s, 13);
}

// ================= 14 演示效果（图片占位） =================
{
  const s = pptx.addSlide();
  bg(s, C.white);
  header(s, '演示效果', '运行截图占位（请替换为真实界面截图）');
  const ph = [
    ['仪表盘', '全局统计概览'],
    ['错误详情', '含 AI 根因分析'],
    ['工单详情', '操作时间线'],
  ];
  let x = 0.83;
  ph.forEach(([l, sub]) => { placeholder(s, x, 1.95, 3.55, 3.25, l, sub); x += 3.9; });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.63, y: 5.55, w: 12.07, h: 0.85, fill: { color: 'EAF1FE' }, line: { type: 'none' }, rectRadius: 0.1 });
  s.addText('提示：系统无需登录、打开即用；将上方三个占位框替换为真实运行截图即可用于答辩演示。', { x: 0.9, y: 5.55, w: 11.5, h: 0.85, fontSize: pt(17), color: C.text, fontFace: FONT, valign: 'middle' });
  footer(s, 14);
}

// ================= 15 结束页 =================
{
  const s = pptx.addSlide();
  bg(s, C.primary);
  orb(s, -1.2, -1.5, 3.6, 3.6, 93);
  orb(s, 10.8, 5.2, 3.4, 3.4, 92);
  s.addText('THANK YOU', { x: 1.05, y: 1.9, w: 11, h: 0.5, fontSize: pt(26), color: 'FFFFFF', fontFace: FONT, transparency: 10, charSpacing: 4 });
  s.addText('让异常处理，从人工翻日志', { x: 1.05, y: 2.6, w: 11.5, h: 0.9, fontSize: pt(56), bold: true, color: C.white, fontFace: FONT });
  s.addText('走向 AI 自动化', { x: 1.05, y: 3.55, w: 11.5, h: 0.9, fontSize: pt(56), bold: true, color: C.accent, fontFace: FONT });
  s.addShape(pptx.ShapeType.rect, { x: 1.08, y: 4.7, w: 1.25, h: 0.07, fill: { color: C.accent }, line: { type: 'none' } });
  s.addText('AIEA · AI 错误根因分析与工单自动化平台', { x: 1.05, y: 5.1, w: 11, h: 0.5, fontSize: pt(20), color: 'FFFFFF', fontFace: FONT });
  s.addText(
    [
      { text: '参赛人：研发一部 · 姚泽楷', options: { fontSize: pt(18), color: 'FFFFFF' } },
      { text: '      大模型：GLM-5.2', options: { fontSize: pt(18), color: 'FFFFFF' } },
      { text: '      代码 AI 率：100%', options: { fontSize: pt(18), color: 'FFFFFF' } },
    ],
    { x: 1.05, y: 5.7, w: 11.5, h: 0.5, fontFace: FONT }
  );
}

// ---------- 输出 ----------
const outDir = 'C:/Users/admin/Desktop/研发一部-姚泽楷-参赛作品/PPT';
const primary = path.join(outDir, 'AIEA参赛作品.pptx');
const fallback = path.join(outDir, 'AIEA参赛作品-修订版.pptx');
pptx.writeFile({ fileName: primary })
  .then(() => console.log('OK -> ' + primary))
  .catch(() => pptx.writeFile({ fileName: fallback })
    .then(() => console.log('LOCKED, wrote -> ' + fallback))
    .catch((e) => { console.error('FAIL', e); process.exit(1); }));
