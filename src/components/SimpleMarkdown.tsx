import React from "react";
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  content: string;
  color: string;
  muted: string;
  border: string;
  accent: string;
  panel: string;
};

type InlineToken =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineToken[] }
  | { type: "em"; children: InlineToken[] }
  | { type: "del"; children: InlineToken[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: InlineToken[] };

type ListItem = {
  level: number;
  kind: "ul" | "ol" | "task";
  marker?: string;
  checked?: boolean;
  text: string;
};

type TableBlock = {
  headers: string[];
  rows: string[][];
  aligns: Array<"left" | "center" | "right">;
};

const INLINE_PATTERN =
  /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripFence(line: string) {
  return line.replace(/^```/, "").trim();
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function alignmentFromSeparator(cell: string): "left" | "center" | "right" {
  const trimmed = cell.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
  if (trimmed.endsWith(":")) return "right";
  return "left";
}

function parseInlineTokens(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  INLINE_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: "text", text: source.slice(lastIndex, index) });
    }

    if (match[3] && match[4]) {
      tokens.push({
        type: "link",
        href: match[4],
        children: parseInlineTokens(match[3]),
      });
    } else if (match[5]) {
      tokens.push({ type: "code", text: match[5] });
    } else if (match[6] || match[7]) {
      tokens.push({
        type: "strong",
        children: parseInlineTokens(match[6] || match[7]),
      });
    } else if (match[8]) {
      tokens.push({
        type: "del",
        children: parseInlineTokens(match[8]),
      });
    } else if (match[9] || match[10]) {
      tokens.push({
        type: "em",
        children: parseInlineTokens(match[9] || match[10]),
      });
    } else if (match[1] || match[2]) {
      tokens.push({
        type: "text",
        text: match[1] ? `[图片] ${match[1] || match[2]}` : `[图片]`,
      });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push({ type: "text", text: source.slice(lastIndex) });
  }

  return tokens;
}

function renderInlineTokens(
  tokens: InlineToken[],
  color: string,
  muted: string,
  accent: string,
  keyPrefix: string
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === "text") {
      return <Text key={key}>{token.text}</Text>;
    }
    if (token.type === "code") {
      return (
        <Text key={key} style={[styles.inlineCode, { color, backgroundColor: `${accent}18` }]}>
          {token.text}
        </Text>
      );
    }
    if (token.type === "strong") {
      return (
        <Text key={key} style={styles.strong}>
          {renderInlineTokens(token.children, color, muted, accent, `${key}-strong`)}
        </Text>
      );
    }
    if (token.type === "em") {
      return (
        <Text key={key} style={styles.emphasis}>
          {renderInlineTokens(token.children, color, muted, accent, `${key}-em`)}
        </Text>
      );
    }
    if (token.type === "del") {
      return (
        <Text key={key} style={styles.strike}>
          {renderInlineTokens(token.children, color, muted, accent, `${key}-del`)}
        </Text>
      );
    }
    return (
      <Text
        key={key}
        style={[styles.link, { color: accent }]}
        onPress={() => Linking.openURL(token.href).catch(() => undefined)}
      >
        {renderInlineTokens(token.children, color, muted, accent, `${key}-link`)}
      </Text>
    );
  });
}

function renderInlineText(
  text: string,
  style: object,
  color: string,
  muted: string,
  accent: string,
  key: string
) {
  return (
    <Text key={key} style={[style, { color }]}>
      {renderInlineTokens(parseInlineTokens(text), color, muted, accent, key)}
    </Text>
  );
}

function renderTable(block: TableBlock, border: string, color: string, muted: string, accent: string, panel: string, key: string) {
  const columnCount = Math.max(
    block.headers.length,
    ...block.rows.map((row) => row.length),
    1
  );
  const headers = [...block.headers];
  while (headers.length < columnCount) headers.push("");

  const rows = block.rows.map((row) => {
    const padded = [...row];
    while (padded.length < columnCount) padded.push("");
    return padded;
  });

  const aligns = Array.from({ length: columnCount }, (_, index) => block.aligns[index] || "left");
  const charWeights = Array.from({ length: columnCount }, (_, index) => {
    const headerWeight = Math.min(Math.max(headers[index]?.length || 0, 8), 18);
    const rowWeight = rows.reduce((max, row) => {
      const rawLength = row[index]?.replace(/\s+/g, "").length || 0;
      return Math.max(max, Math.min(Math.max(rawLength, 8), 30));
    }, 0);
    return Math.max(headerWeight, rowWeight, 9);
  });
  const viewportWidth = Dimensions.get("window").width;
  const availableWidth = Math.max(viewportWidth - 80, 320);
  const minimumColumnWidth = 96;
  const preferredTableWidth = Math.max(
    availableWidth,
    columnCount * 120,
    minimumColumnWidth * columnCount
  );
  const totalWeight = charWeights.reduce((sum, item) => sum + item, 0) || columnCount;
  const columnWidths = charWeights.map((weight) =>
    Math.max(minimumColumnWidth, Math.floor((preferredTableWidth * weight) / totalWeight))
  );
  const tableWidth = columnWidths.reduce((sum, item) => sum + item, 0);

  return (
    <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.table, { borderColor: border, width: tableWidth }]}>
        <View style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: border, backgroundColor: panel }]}>
          {headers.map((header, index) => (
            <View
              key={`head-${index}`}
              style={[
                styles.tableCell,
                { width: columnWidths[index] },
                index > 0 && { borderLeftColor: border, borderLeftWidth: 1 },
              ]}
            >
              {renderInlineText(header, [styles.tableHeaderText, textAlign(aligns[index])], color, muted, accent, `th-${index}`)}
            </View>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={[styles.tableRow, rowIndex > 0 && { borderTopColor: border, borderTopWidth: 1 }]}>
            {row.map((cell, cellIndex) => (
              <View
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[
                  styles.tableCell,
                  { width: columnWidths[cellIndex] },
                  cellIndex > 0 && { borderLeftColor: border, borderLeftWidth: 1 },
                ]}
              >
                {renderInlineText(
                  cell,
                  [styles.tableCellText, textAlign(aligns[cellIndex])],
                  color,
                  muted,
                  accent,
                  `td-${rowIndex}-${cellIndex}`
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function textAlign(alignment: "left" | "center" | "right") {
  return {
    textAlign: alignment,
  } as const;
}

function renderListItem(
  item: ListItem,
  color: string,
  muted: string,
  accent: string,
  index: number
) {
  const indent = item.level * 18;
  let markerNode: React.ReactNode;
  if (item.kind === "task") {
    markerNode = (
      <Text style={[styles.taskBox, { color: item.checked ? accent : muted }]}>
        {item.checked ? "■" : "□"}
      </Text>
    );
  } else if (item.kind === "ol") {
    markerNode = (
      <Text style={[styles.number, { color: accent }]}>
        {item.marker}
      </Text>
    );
  } else {
    markerNode = (
      <Text style={[styles.bullet, { color: accent }]}>•</Text>
    );
  }

  return (
    <View key={`list-${index}`} style={[styles.row, { marginLeft: indent }]}>
      {markerNode}
      {renderInlineText(item.text, styles.listText, color, muted, accent, `list-text-${index}`)}
    </View>
  );
}

function markdownToHtmlBlocks(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = stripFence(line);
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(
        `<pre><code class="language-${escapeHtml(language || "text")}">${escapeHtml(codeLines.join("\n"))}</code></pre>`
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineToHtml(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push("<hr />");
      i += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${quoteLines.map((item) => `<p>${inlineToHtml(item)}</p>`).join("")}</blockquote>`);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(alignmentFromSeparator);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      html.push(
        `<table><thead><tr>${headers
          .map((header, index) => `<th style="text-align:${aligns[index] || "left"}">${inlineToHtml(header)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, index) =>
                    `<td style="text-align:${aligns[index] || "left"}">${inlineToHtml(cell)}</td>`
                )
                .join("")}</tr>`
          )
          .join("")}</tbody></table>`
      );
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch || listMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const currentTask = current.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
        const currentList = current.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!currentTask && !currentList) break;

        if (currentTask) {
          items.push({
            level: Math.floor(currentTask[1].length / 2),
            kind: "task",
            checked: /[xX]/.test(currentTask[2]),
            text: currentTask[3],
          });
        } else if (currentList) {
          items.push({
            level: Math.floor(currentList[1].length / 2),
            kind: /\d+\./.test(currentList[2]) ? "ol" : "ul",
            marker: currentList[2],
            text: currentList[3],
          });
        }
        i += 1;
      }

      html.push(
        `<div class="list-block">${items
          .map((item) => {
            const marker =
              item.kind === "task"
                ? `<span class="marker">${item.checked ? "■" : "□"}</span>`
                : `<span class="marker">${escapeHtml(item.marker || "•")}</span>`;
            return `<div class="list-row" style="margin-left:${item.level * 18}px">${marker}<span>${inlineToHtml(
              item.text
            )}</span></div>`;
          })
          .join("")}</div>`
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith(">") &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^(\s*)[-*+]\s+\[([ xX])\]\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${inlineToHtml(paragraphLines.join("<br />"))}</p>`);
  }

  return html.join("");
}

function inlineToHtml(source: string) {
  let html = escapeHtml(source);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    if (/^https?:\/\//i.test(url)) {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
    }
    return `<span class="image-inline">[图片] ${escapeHtml(alt || url)}</span>`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return html;
}

export function markdownToHtml(content: string, options: {
  background: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  panel: string;
  title?: string;
}) {
  const title = options.title ? escapeHtml(options.title) : "TinyMD";
  const body = markdownToHtmlBlocks(content);
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        padding: 36px;
        background: ${options.background};
        color: ${options.text};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.75;
        font-size: 15px;
      }
      h1,h2,h3,h4,h5,h6 { margin: 0 0 14px; line-height: 1.3; }
      h1 { font-size: 30px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      p { margin: 0 0 14px; }
      strong { font-weight: 700; }
      em { font-style: italic; }
      del { text-decoration: line-through; }
      code {
        font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
        background: ${options.panel};
        padding: 1px 6px;
      }
      pre {
        margin: 0 0 16px;
        padding: 14px;
        border: 1px solid ${options.border};
        background: ${options.panel};
        overflow: hidden;
      }
      pre code {
        background: transparent;
        padding: 0;
        display: block;
        white-space: pre-wrap;
      }
      blockquote {
        margin: 0 0 16px;
        padding-left: 14px;
        border-left: 3px solid ${options.accent};
        color: ${options.muted};
      }
      blockquote p { margin-bottom: 8px; }
      .list-block { margin: 0 0 14px; }
      .list-row {
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
      }
      .marker {
        min-width: 22px;
        color: ${options.accent};
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin: 0 0 18px;
      }
      th, td {
        border: 1px solid ${options.border};
        padding: 10px 12px;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: ${options.panel};
        text-align: left;
      }
      a {
        color: ${options.accent};
        text-decoration: none;
      }
      hr {
        border: 0;
        border-top: 1px solid ${options.border};
        margin: 20px 0;
      }
      img {
        max-width: 100%;
        height: auto;
        border: 1px solid ${options.border};
      }
      .image-inline {
        color: ${options.muted};
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

export function SimpleMarkdown({
  content,
  color,
  muted,
  border,
  accent,
  panel,
}: Props) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = stripFence(line);
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      elements.push(
        <View key={`code-${i}`} style={[styles.codeBlock, { borderColor: border, backgroundColor: panel }]}>
          {language ? <Text style={[styles.codeLanguage, { color: muted }]}>{language}</Text> : null}
          <Text style={[styles.codeText, { color }]}>{codeLines.join("\n")}</Text>
        </View>
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const headingStyle =
        level === 1
          ? styles.h1
          : level === 2
            ? styles.h2
            : level === 3
              ? styles.h3
              : styles.h4;
      elements.push(renderInlineText(heading[2], headingStyle, color, muted, accent, `h-${i}`));
      i += 1;
      continue;
    }

    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      elements.push(<View key={`hr-${i}`} style={[styles.hr, { borderTopColor: border }]} />);
      i += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      elements.push(
        <View key={`quote-${i}`} style={[styles.quote, { borderLeftColor: accent }]}>
          {quoteLines.map((quoteLine, index) =>
            renderInlineText(
              quoteLine,
              [styles.quoteText, index < quoteLines.length - 1 && styles.quoteTextGap],
              muted,
              muted,
              accent,
              `quote-${i}-${index}`
            )
          )}
        </View>
      );
      continue;
    }

    const imageOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageOnly) {
      const [, alt, uri] = imageOnly;
      elements.push(
        /^https?:\/\//i.test(uri) ? (
          <View key={`img-${i}`} style={[styles.imageWrap, { borderColor: border, backgroundColor: panel }]}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            {alt ? <Text style={[styles.imageCaption, { color: muted }]}>{alt}</Text> : null}
          </View>
        ) : (
          <View key={`img-${i}`} style={[styles.assetPlaceholder, { borderColor: border, backgroundColor: panel }]}>
            <Text style={[styles.assetPlaceholderTitle, { color }]}>图片</Text>
            <Text style={[styles.assetPlaceholderBody, { color: muted }]} numberOfLines={2}>
              {alt || uri}
            </Text>
          </View>
        )
      );
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(alignmentFromSeparator);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      elements.push(
        renderTable(
          { headers, rows, aligns },
          border,
          color,
          muted,
          accent,
          panel,
          `table-${i}`
        )
      );
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch || listMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const currentTask = current.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
        const currentList = current.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!currentTask && !currentList) break;

        if (currentTask) {
          items.push({
            level: Math.floor(currentTask[1].length / 2),
            kind: "task",
            checked: /[xX]/.test(currentTask[2]),
            text: currentTask[3],
          });
        } else if (currentList) {
          items.push({
            level: Math.floor(currentList[1].length / 2),
            kind: /\d+\./.test(currentList[2]) ? "ol" : "ul",
            marker: currentList[2],
            text: currentList[3],
          });
        }
        i += 1;
      }

      elements.push(
        <View key={`list-block-${i}`} style={styles.listBlock}>
          {items.map((item, index) => renderListItem(item, color, muted, accent, index))}
        </View>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith(">") &&
      !/^!\[([^\]]*)\]\(([^)]+)\)$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^(\s*)[-*+]\s+\[([ xX])\]\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    elements.push(
      renderInlineText(
        paragraphLines.join(" "),
        styles.paragraph,
        color,
        muted,
        accent,
        `p-${i}`
      )
    );
  }

  return <View>{elements}</View>;
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 14,
  },
  h2: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 12,
  },
  h3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
  },
  h4: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 26,
    marginBottom: 12,
  },
  strong: {
    fontWeight: "700",
  },
  emphasis: {
    fontStyle: "italic",
  },
  strike: {
    textDecorationLine: "line-through",
  },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  link: {
    textDecorationLine: "underline",
  },
  listBlock: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 24,
    width: 14,
  },
  number: {
    fontSize: 14,
    lineHeight: 24,
    width: 28,
    fontWeight: "700",
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 14,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 24,
  },
  quoteTextGap: {
    marginBottom: 8,
  },
  codeBlock: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  codeLanguage: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
  },
  taskBox: {
    width: 16,
    fontSize: 13,
    lineHeight: 24,
  },
  table: {
    borderWidth: 1,
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeaderRow: {},
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  tableCellText: {
    fontSize: 14,
    lineHeight: 22,
  },
  hr: {
    borderTopWidth: 1,
    marginVertical: 16,
  },
  imageWrap: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  image: {
    width: "100%",
    height: 220,
  },
  imageCaption: {
    fontSize: 12,
    lineHeight: 18,
  },
  assetPlaceholder: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  assetPlaceholderTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  assetPlaceholderBody: {
    fontSize: 13,
    lineHeight: 20,
  },
});
