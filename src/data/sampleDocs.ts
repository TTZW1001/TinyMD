import type { MarkdownDocument } from "../types";

const now = new Date();

function isoMinutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

export const LEGACY_BUNDLED_IDS = [
  "doc-android-plan",
  "doc-readme",
  "doc-journal",
];

export const GUIDE_DOCUMENT_ID = "doc-guide";

export const sampleDocuments: MarkdownDocument[] = [
  {
    id: GUIDE_DOCUMENT_ID,
    title: "TinyMD使用指南.md",
    updatedAt: isoMinutesAgo(2),
    excerpt: "快速了解 TinyMD 的导入、阅读、编辑、导出与 Markdown 样式支持。",
    isBundled: true,
    content: `# TinyMD 使用指南

欢迎使用 TinyMD。

TinyMD 是一款面向安卓手机的轻量级 Markdown 工作区，适合随手记录、阅读文档、整理笔记和快速导出内容。

## 主要功能

- 导入本地 \`.md\` 文档
- 最近文件列表与窗口两种浏览方式
- 阅读模式与源码编辑模式切换
- 本地保存、重命名、删除
- 导出为 \`.md\` 或 PDF
- 浅色、夜间、Sepia 三种主题

## 基本操作

1. 点击“导入”选择本地 Markdown 文件。
2. 点击“新建”创建空白文档。
3. 在“最近”页查看和打开文档。
4. 在“编辑”页修改内容并保存。
5. 在“阅读”页查看排版效果。
6. 在“设置”页切换主题并查看更新日志。

## 编辑快捷样式

- \`H1\`：插入一级标题
- \`引用\`：插入引用段落
- \`清单\`：插入无序列表
- \`任务\`：插入任务列表
- \`代码\`：插入代码块
- \`加粗\`：快速包裹粗体

## Markdown 样式展示

### 文本样式

- **粗体文字**
- *斜体文字*
- ~~删除线~~
- \`行内代码\`

### 任务列表

- [x] 已完成事项
- [ ] 待处理事项

### 引用

> TinyMD 优先保证手机上的阅读与编辑都足够清爽。
>
> 适合整理笔记、方案和轻文档。

### 代码块

\`\`\`python
def hello():
    print("Hello, TinyMD!")
\`\`\`

### 表格

| 名称 | 类型 | 说明 |
| :--- | :--- | :--- |
| TinyMD | 编辑器 | 轻量级 Markdown 工具 |
| 导出 | 功能 | 支持 MD 与 PDF |
| 主题 | 阅读 | 提供三种阅读环境 |

### 链接

[访问项目主页](https://example.com/)

### 分割线

---

## 使用建议

- 长按最近文件可进行重命名或删除
- 阅读长文时推荐夜间或 Sepia 主题
- 导出 PDF 前可先切到阅读模式确认排版

祝你使用顺手。`,
  },
];
