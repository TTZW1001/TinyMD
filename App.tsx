import React, {
  useRef,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  LayoutAnimation,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  UIManager,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { markdownToHtml, SimpleMarkdown } from "./src/components/SimpleMarkdown";
import { GUIDE_DOCUMENT_ID, LEGACY_BUNDLED_IDS, sampleDocuments } from "./src/data/sampleDocs";
import { palettes } from "./src/theme";
import type { Palette } from "./src/theme";
import type {
  EditorMode,
  MarkdownDocument,
  RecentViewMode,
  TabKey,
  ThemeMode,
} from "./src/types";

const STORAGE_KEY = "tinymd-state-v1";
const DOCUMENTS_DIR = `${FileSystem.documentDirectory ?? ""}documents/`;
const EXPORTS_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}exports/`;

type ExportFormat = "md" | "pdf";

type PersistedState = {
  documents: MarkdownDocument[];
  selectedId: string;
  themeMode: ThemeMode;
  recentViewMode: RecentViewMode;
};

const APP_VERSION = "1.1.0";

const CHANGELOG_ITEMS = [
  "默认文档调整为《TinyMD使用指南》，首开内容更清晰。",
  "进一步整理初始工作区，让成品状态更简洁。",
  "继续优化阅读、编辑、导出与主题切换体验。",
  "统一首发成品内容，适合直接安装开始使用。",
];

function migrateDocuments(docs: MarkdownDocument[]) {
  const legacyIds = new Set(LEGACY_BUNDLED_IDS);
  const bundledGuide = sampleDocuments[0];
  const existingGuide = docs.find((doc) => doc.id === GUIDE_DOCUMENT_ID);
  const userDocs = docs.filter((doc) => !doc.isBundled);
  const hasGuide = docs.some((doc) => doc.id === GUIDE_DOCUMENT_ID);
  const hasLegacyBundled = docs.some((doc) => legacyIds.has(doc.id));

  if (!docs.length) {
    return [...sampleDocuments];
  }

  if (!userDocs.length && (hasLegacyBundled || !hasGuide)) {
    return [...sampleDocuments];
  }

  const preserved = docs.filter((doc) => !legacyIds.has(doc.id) && doc.id !== GUIDE_DOCUMENT_ID);
  const nextDocs = [existingGuide ?? bundledGuide, ...preserved];
  return nextDocs.length ? nextDocs : [...sampleDocuments];
}

function makeExcerpt(content: string) {
  return content
    .replace(/[#>*`\-\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 84);
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (60 * 1000));
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImportedTitle(name: string) {
  return name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
}

function stripExtension(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  return trimmed || "TinyMD 文档";
}

function normalizeTitleForCompare(value: string) {
  return stripExtension(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, "");
}

function stripRedundantTitle(content: string, title: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine === -1) return content;
  const firstLine = lines[firstContentLine];
  const heading = firstLine.match(/^(#{1,6})\s+(.+)$/);
  if (!heading) return content;
  const headingText = normalizeTitleForCompare(heading[2]);
  const titleText = normalizeTitleForCompare(title);
  if (!headingText || headingText !== titleText) return content;
  lines.splice(firstContentLine, 1);
  while (lines[firstContentLine] !== undefined && !lines[firstContentLine].trim()) {
    lines.splice(firstContentLine, 1);
  }
  return lines.join("\n");
}

async function ensureDocsDir() {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  }
}

async function ensureExportsDir() {
  const info = await FileSystem.getInfoAsync(EXPORTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORTS_DIR, { intermediates: true });
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [recentViewMode, setRecentViewMode] = useState<RecentViewMode>("list");
  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [editorMode, setEditorMode] = useState<EditorMode>("rendered");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<MarkdownDocument[]>(sampleDocuments);
  const [selectedId, setSelectedId] = useState(sampleDocuments[0]?.id ?? "");
  const [draftContent, setDraftContent] = useState(sampleDocuments[0]?.content ?? "");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState(stripExtension(sampleDocuments[0]?.title ?? "TinyMD 文档"));
  const [exportFormat, setExportFormat] = useState<ExportFormat>("md");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [manageDocId, setManageDocId] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [manageDocTitle, setManageDocTitle] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const themeFade = useRef(new Animated.Value(1)).current;

  const deferredQuery = useDeferredValue(searchQuery);
  const palette = palettes[themeMode];
  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? documents[0];
  const readerContent = selectedDoc ? stripRedundantTitle(draftContent, selectedDoc.title) : "";
  const topInset = (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) + 6;

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await ensureDocsDir();
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setReady(true);
          return;
        }
        const persisted = JSON.parse(raw) as PersistedState;
        if (!mounted) return;
        const initialDocs = migrateDocuments(
          persisted.documents?.length ? persisted.documents : sampleDocuments
        );
        const selectedDocId = initialDocs.some((doc) => doc.id === persisted.selectedId)
          ? persisted.selectedId
          : initialDocs[0]?.id || "";
        setDocuments(initialDocs);
        setSelectedId(selectedDocId);
        setDraftContent(
          initialDocs.find((doc) => doc.id === selectedDocId)?.content ??
            initialDocs[0]?.content ??
            ""
        );
        setExportName(stripExtension(selectedDocId ? (initialDocs.find((doc) => doc.id === selectedDocId)?.title ?? initialDocs[0]?.title ?? "TinyMD 文档") : initialDocs[0]?.title ?? "TinyMD 文档"));
        setThemeMode(persisted.themeMode ?? "dark");
        setRecentViewMode(persisted.recentViewMode ?? "list");
      } catch (error) {
        console.error("Failed to load TinyMD state", error);
      } finally {
        if (mounted) setReady(true);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !selectedDoc) return;
    const payload: PersistedState = {
      documents,
      selectedId,
      themeMode,
      recentViewMode,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((error) => {
      console.error("Failed to persist TinyMD state", error);
    });
  }, [documents, ready, recentViewMode, selectedDoc, selectedId, themeMode]);

  useEffect(() => {
    if (!selectedDoc) return;
    setExportName(stripExtension(selectedDoc.title));
  }, [selectedDoc?.id]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(themeFade, {
        toValue: 0.92,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(themeFade, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [themeMode, themeFade]);

  const filteredDocs = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => {
      const haystack = `${doc.title}\n${doc.excerpt}\n${doc.content}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredQuery, documents]);

  function openDocument(doc: MarkdownDocument, nextTab: TabKey = "editor") {
    setSelectedId(doc.id);
    setDraftContent(doc.content);
    setSelection({ start: 0, end: 0 });
    setExportOpen(false);
    startTransition(() => setActiveTab(nextTab));
  }

  function applyFormatting(kind: "h1" | "quote" | "ul" | "task" | "code" | "bold") {
    const start = selection.start;
    const end = selection.end;
    const selectedText = draftContent.slice(start, end);
    let nextText = draftContent;
    let nextSelection = selection;

    const insert = (value: string, cursorOffset?: number) => {
      nextText = `${draftContent.slice(0, start)}${value}${draftContent.slice(end)}`;
      const position = cursorOffset ?? value.length;
      nextSelection = {
        start: start + position,
        end: start + position,
      };
    };

    const wrapSelected = (prefix: string, suffix = "") => {
      const content = selectedText || "内容";
      const value = `${prefix}${content}${suffix}`;
      nextText = `${draftContent.slice(0, start)}${value}${draftContent.slice(end)}`;
      const innerStart = start + prefix.length;
      const innerEnd = innerStart + content.length;
      nextSelection = selectedText
        ? { start: innerStart, end: innerEnd }
        : { start: innerStart, end: innerEnd };
    };

    const lineStart = draftContent.lastIndexOf("\n", start - 1) + 1;
    const lineEndCandidate = draftContent.indexOf("\n", end);
    const lineEnd = lineEndCandidate === -1 ? draftContent.length : lineEndCandidate;
    const currentLine = draftContent.slice(lineStart, lineEnd);

    const prefixLine = (prefix: string) => {
      const updatedLine = currentLine.startsWith(prefix) ? currentLine : `${prefix}${currentLine}`;
      nextText = `${draftContent.slice(0, lineStart)}${updatedLine}${draftContent.slice(lineEnd)}`;
      nextSelection = {
        start: lineStart + updatedLine.length,
        end: lineStart + updatedLine.length,
      };
    };

    switch (kind) {
      case "h1":
        prefixLine("# ");
        break;
      case "quote":
        prefixLine("> ");
        break;
      case "ul":
        prefixLine("- ");
        break;
      case "task":
        prefixLine("- [ ] ");
        break;
      case "code":
        if (selectedText) {
          wrapSelected("```txt\n", "\n```");
        } else {
          insert("```txt\n代码\n```", 7);
        }
        break;
      case "bold":
        wrapSelected("**", "**");
        break;
    }

    setDraftContent(nextText);
    setSelection(nextSelection);
  }

  function handleSelectionChange(
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) {
    setSelection(event.nativeEvent.selection);
  }

  async function importDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/markdown", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      await ensureDocsDir();
      const asset = result.assets[0];
      const importedTitle = normalizeImportedTitle(asset.name || "imported.md");
      const safeName = `${slugify(importedTitle) || "document"}-${Date.now()}.md`;
      const targetUri = `${DOCUMENTS_DIR}${safeName}`;
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await FileSystem.copyAsync({
        from: asset.uri,
        to: targetUri,
      });

      const nextDoc: MarkdownDocument = {
        id: `doc-${Date.now()}`,
        title: importedTitle,
        content,
        excerpt: makeExcerpt(content),
        updatedAt: new Date().toISOString(),
        originalUri: asset.uri,
        storageUri: targetUri,
      };

      setDocuments((current) => [nextDoc, ...current.filter((doc) => doc.id !== nextDoc.id)]);
      openDocument(nextDoc);
    } catch (error) {
      console.error("Import failed", error);
      Alert.alert("导入失败", "没有成功读取这个 Markdown 文件。");
    }
  }

  async function saveDocument() {
    if (!selectedDoc) return;

    try {
      await ensureDocsDir();
      const storageUri =
        selectedDoc.storageUri ||
        `${DOCUMENTS_DIR}${slugify(selectedDoc.title) || "document"}-${selectedDoc.id}.md`;

      await FileSystem.writeAsStringAsync(storageUri, draftContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const updatedDoc: MarkdownDocument = {
        ...selectedDoc,
        content: draftContent,
        excerpt: makeExcerpt(draftContent),
        updatedAt: new Date().toISOString(),
        storageUri,
      };

      setDocuments((current) =>
        current.map((doc) => (doc.id === updatedDoc.id ? updatedDoc : doc))
      );
      setEditorMode("rendered");
      Alert.alert("已保存", "文档已保存到 TinyMD 本地目录。");
    } catch (error) {
      console.error("Save failed", error);
      Alert.alert("保存失败", "当前文档没有成功写入本地目录。");
    }
  }

  async function exportDocument() {
    if (!selectedDoc) return;
    try {
      const latestContent = selectedDoc.id === selectedId ? draftContent : selectedDoc.content;
      const safeBaseName = sanitizeFileName(exportName);
      await ensureExportsDir();

      let targetUri = `${EXPORTS_DIR}${safeBaseName}.md`;
      let mimeType = "text/markdown";

      if (exportFormat === "md") {
        await FileSystem.writeAsStringAsync(targetUri, latestContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        const html = markdownToHtml(latestContent, {
          background: palette.background,
          text: palette.text,
          muted: palette.textSoft,
          border: palette.border,
          accent: palette.primary,
          panel: palette.panel,
          title: safeBaseName,
        });
        const printResult = await Print.printToFileAsync({ html });
        targetUri = `${EXPORTS_DIR}${safeBaseName}.pdf`;
        mimeType = "application/pdf";
        await FileSystem.copyAsync({
          from: printResult.uri,
          to: targetUri,
        });
      }

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("已导出", `文件已保存到 ${exportFormat.toUpperCase()} 导出目录。`);
        return;
      }

      await Sharing.shareAsync(targetUri, {
        mimeType,
        dialogTitle: "导出 TinyMD 文档",
      });
      setExportOpen(false);
    } catch (error) {
      console.error("Export failed", error);
      Alert.alert("导出失败", "没有成功生成导出文件。");
    }
  }

  function createBlankDocument() {
    const baseTitle = `New Note ${documents.length + 1}.md`;
    const nextDoc: MarkdownDocument = {
      id: `doc-${Date.now()}`,
      title: baseTitle,
      content: "# 新文档\n\n从这里开始写。",
      excerpt: "从这里开始写。",
      updatedAt: new Date().toISOString(),
    };
    setDocuments((current) => [nextDoc, ...current]);
    setEditorMode("source");
    setExportName(stripExtension(baseTitle));
    openDocument(nextDoc);
  }

  function promptManageDocument(doc: MarkdownDocument) {
    setManageDocId(doc.id);
    setManageDocTitle(doc.title);
    setManageOpen(true);
  }

  async function deleteDocument(docId: string) {
    const target = documents.find((doc) => doc.id === docId);
    if (!target) return;
    try {
      if (target.storageUri) {
        const info = await FileSystem.getInfoAsync(target.storageUri);
        if (info.exists) {
          await FileSystem.deleteAsync(target.storageUri, { idempotent: true });
        }
      }
      const remaining = documents.filter((doc) => doc.id !== docId);
      setDocuments(remaining.length ? remaining : sampleDocuments);
      setManageOpen(false);
      const nextDoc = remaining[0] ?? sampleDocuments[0];
      if (nextDoc) {
        openDocument(nextDoc, activeTab === "reader" ? "reader" : "recent");
      }
      setRenameOpen(false);
    } catch (error) {
      console.error("Delete failed", error);
      Alert.alert("删除失败", "没有成功移除这个文件。");
    }
  }

  async function renameDocument() {
    const target = documents.find((doc) => doc.id === manageDocId);
    const nextTitleBase = sanitizeFileName(renameValue);
    if (!target || !nextTitleBase) return;
    const nextTitle = nextTitleBase.toLowerCase().endsWith(".md")
      ? nextTitleBase
      : `${nextTitleBase}.md`;

    try {
      let nextStorageUri = target.storageUri;
      if (target.storageUri) {
        const currentInfo = await FileSystem.getInfoAsync(target.storageUri);
        if (currentInfo.exists) {
          await ensureDocsDir();
          nextStorageUri = `${DOCUMENTS_DIR}${slugify(nextTitle) || "document"}-${target.id}.md`;
          if (nextStorageUri !== target.storageUri) {
            await FileSystem.moveAsync({
              from: target.storageUri,
              to: nextStorageUri,
            });
          }
        }
      }

      setDocuments((current) =>
        current.map((doc) =>
          doc.id === manageDocId
            ? {
                ...doc,
                title: nextTitle,
                updatedAt: new Date().toISOString(),
                storageUri: nextStorageUri,
              }
            : doc
        )
      );
      if (selectedId === manageDocId) {
        setExportName(stripExtension(nextTitle));
      }
      setManageOpen(false);
      setRenameOpen(false);
    } catch (error) {
      console.error("Rename failed", error);
      Alert.alert("重命名失败", "没有成功更新这个文件名。");
    }
  }

  const styles = useMemo(() => createStyles(palette, topInset), [palette, topInset]);

  if (!ready) {
    return (
      <SafeAreaView style={[styles.app, styles.centered]}>
        <StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} />
        <Text style={styles.loadingTitle}>TinyMD</Text>
        <Text style={styles.loadingText}>正在载入文档与主题设置…</Text>
      </SafeAreaView>
    );
  }

  return (
    <Animated.View style={[styles.app, { opacity: themeFade }]}>
      <StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} />
      <ExpoStatusBar style={themeMode === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TinyMD</Text>
          <Text style={styles.headerSubtitle}>轻量 Markdown 工作区</Text>
        </View>
        <View style={styles.headerActions}>
          <ActionButton label="导入" onPress={importDocument} palette={palette} primary prominence="toolbar" />
          <ActionButton label="新建" onPress={createBlankDocument} palette={palette} prominence="toolbar" />
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          ["recent", "最近"],
          ["editor", "编辑"],
          ["reader", "阅读"],
          ["settings", "设置"],
        ].map(([key, label]) => {
          const current = key as TabKey;
          const active = current === activeTab;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveTab(current)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "recent" ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toolbarRow}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="搜索标题或内容"
              placeholderTextColor={palette.textSoft}
              style={styles.searchInput}
            />
            <View style={styles.modeSwitch}>
              <MiniToggle
                label="列表"
                active={recentViewMode === "list"}
                onPress={() => setRecentViewMode("list")}
                palette={palette}
              />
              <MiniToggle
                label="窗口"
                active={recentViewMode === "preview"}
                onPress={() => setRecentViewMode("preview")}
                palette={palette}
              />
            </View>
          </View>

          {recentViewMode === "list" ? (
            <View style={styles.listColumn}>
              {filteredDocs.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => openDocument(doc)}
                  onLongPress={() => promptManageDocument(doc)}
                  style={[
                    styles.docRow,
                    selectedId === doc.id && styles.docRowSelected,
                  ]}
                >
                  <View style={styles.docMark}>
                    <Text style={styles.docMarkText}>MD</Text>
                  </View>
                  <View style={styles.docCopy}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={styles.docExcerpt} numberOfLines={2}>
                      {doc.excerpt}
                    </Text>
                  </View>
                  <Text style={styles.docTime}>{formatTime(doc.updatedAt)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.previewGrid}>
              {filteredDocs.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => openDocument(doc)}
                  onLongPress={() => promptManageDocument(doc)}
                  style={[
                    styles.previewCard,
                    selectedId === doc.id && styles.previewCardSelected,
                  ]}
                >
                  <Text style={styles.previewCardTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <Text style={styles.previewCardText} numberOfLines={5}>
                    {doc.excerpt}
                  </Text>
                  <Text style={styles.previewCardTime}>{formatTime(doc.updatedAt)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}

      {activeTab === "editor" ? (
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={topInset + 18}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              editorMode === "source" && { paddingBottom: keyboardHeight + 28 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {selectedDoc ? (
              <>
                <View style={styles.docHeader}>
                  <View style={styles.docHeaderCopy}>
                    <Text style={styles.editorTitle}>{selectedDoc.title}</Text>
                    <Text style={styles.editorMeta}>
                      最后修改 {formatTime(selectedDoc.updatedAt)} · {selectedDoc.storageUri ? "本地已保存" : "示例文档"}
                    </Text>
                  </View>
                  <View style={styles.docHeaderActions}>
                    <MiniToggle
                      label="正文"
                      active={editorMode === "rendered"}
                      onPress={() => setEditorMode("rendered")}
                      palette={palette}
                    />
                    <MiniToggle
                      label="源码"
                      active={editorMode === "source"}
                      onPress={() => setEditorMode("source")}
                      palette={palette}
                    />
                  </View>
                </View>

                <View style={styles.formatRow}>
                  {([
                    ["H1", "h1"],
                    ["引用", "quote"],
                    ["清单", "ul"],
                    ["任务", "task"],
                    ["代码", "code"],
                    ["加粗", "bold"],
                  ] as const).map(([label, kind]) => (
                    <Pressable
                      key={kind}
                      onPress={() => {
                        setEditorMode("source");
                        applyFormatting(kind);
                      }}
                      style={styles.formatButton}
                    >
                      <Text style={styles.formatButtonText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.editorSurface}>
                  {editorMode === "rendered" ? (
                    <SimpleMarkdown
                      content={draftContent}
                      color={palette.text}
                      muted={palette.textSoft}
                      border={palette.border}
                      accent={palette.primary}
                      panel={palette.backgroundSoft}
                    />
                  ) : (
                    <TextInput
                      multiline
                      value={draftContent}
                      onChangeText={setDraftContent}
                      onSelectionChange={handleSelectionChange}
                      selection={selection}
                      style={styles.editorInput}
                      placeholder="开始写 Markdown…"
                      placeholderTextColor={palette.textSoft}
                      textAlignVertical="top"
                    />
                  )}
                </View>

                <View style={styles.footerActions}>
                  <ActionButton label="保存" onPress={saveDocument} palette={palette} primary />
                  <ActionButton
                    label={exportOpen ? "收起导出" : "导出"}
                    onPress={() => setExportOpen((current) => !current)}
                    palette={palette}
                  />
                </View>

                {exportOpen ? (
                  <View style={styles.exportCard}>
                    <Text style={styles.exportTitle}>导出文件</Text>
                    <TextInput
                      value={exportName}
                      onChangeText={setExportName}
                      placeholder="输入文件名"
                      placeholderTextColor={palette.textSoft}
                      style={styles.exportInput}
                    />
                    <View style={styles.exportFormatRow}>
                      <MiniToggle
                        label="MD"
                        active={exportFormat === "md"}
                        onPress={() => setExportFormat("md")}
                        palette={palette}
                      />
                      <MiniToggle
                        label="PDF"
                        active={exportFormat === "pdf"}
                        onPress={() => setExportFormat("pdf")}
                        palette={palette}
                      />
                    </View>
                    <View style={styles.exportActions}>
                      <ActionButton label="取消" onPress={() => setExportOpen(false)} palette={palette} />
                      <ActionButton label="确认导出" onPress={exportDocument} palette={palette} primary />
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="还没有打开文档"
                body="先导入一个 Markdown 文件，或者新建一个空白文档。"
                palette={palette}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {activeTab === "reader" ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedDoc ? (
            <>
              <View style={styles.readerSurface}>
                <View style={styles.readerHeader}>
                  <Text style={styles.readerTitle}>{stripExtension(selectedDoc.title)}</Text>
                  <Text style={styles.readerMetaTitle}>{selectedDoc.title}</Text>
                </View>
                <SimpleMarkdown
                  content={readerContent}
                  color={palette.text}
                  muted={palette.textSoft}
                  border={palette.border}
                  accent={palette.primary}
                  panel={palette.backgroundSoft}
                />
              </View>
            </>
          ) : (
            <EmptyState
              title="没有可阅读的文档"
              body="先在最近文件里选中一份文档。"
              palette={palette}
            />
          )}
        </ScrollView>
      ) : null}

      {activeTab === "settings" ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>主题模式</Text>
            <View style={styles.themeGrid}>
              {([
                ["light", "浅色", "白天整理与快速浏览"],
                ["dark", "夜间", "深底浅字，适合长时间阅读"],
                ["sepia", "Sepia", "更接近纸感的暖色底"],
              ] as const).map(([mode, label, body]) => {
                const active = themeMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setThemeMode(mode);
                    }}
                    style={[styles.themeCard, active && styles.themeCardActive]}
                  >
                    <Text style={[styles.themeCardTitle, active && styles.themeCardTitleActive]}>
                      {label}
                    </Text>
                    <Text style={[styles.themeCardText, active && styles.themeCardTextActive]}>{body}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>更新日志</Text>
            <Text style={styles.versionText}>TinyMD {APP_VERSION}</Text>
            <View style={styles.changelogList}>
              {CHANGELOG_ITEMS.map((item) => (
                <View key={item} style={styles.changelogItem}>
                  <Text style={styles.changelogBullet}>•</Text>
                  <Text style={styles.changelogText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : null}
      <Modal
        transparent
        visible={manageOpen}
        animationType="fade"
        onRequestClose={() => setManageOpen(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.actionSheetCard}>
            <Text style={styles.modalTitle}>{manageDocTitle}</Text>
            <Text style={styles.modalSubtitle}>选择操作</Text>
            <View style={styles.actionSheetActions}>
              <Pressable
                style={[styles.actionSheetButton, styles.actionSheetButtonPrimary]}
                onPress={() => {
                  setRenameValue(stripExtension(manageDocTitle));
                  setManageOpen(false);
                  setRenameOpen(true);
                }}
              >
                <Text style={styles.actionSheetButtonPrimaryText}>重命名</Text>
              </Pressable>
              <Pressable
                style={styles.actionSheetButton}
                onPress={() => deleteDocument(manageDocId)}
              >
                <Text style={styles.actionSheetButtonDangerText}>删除</Text>
              </Pressable>
              <Pressable
                style={styles.actionSheetButton}
                onPress={() => setManageOpen(false)}
              >
                <Text style={styles.actionSheetButtonText}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={renameOpen}
        animationType="fade"
        onRequestClose={() => setRenameOpen(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>重命名文件</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="输入新的文件名"
              placeholderTextColor={palette.textSoft}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <ActionButton label="取消" onPress={() => setRenameOpen(false)} palette={palette} />
              <ActionButton label="保存" onPress={renameDocument} palette={palette} primary />
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function ActionButton({
  label,
  onPress,
  palette,
  primary = false,
  prominence = "inline",
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  primary?: boolean;
  prominence?: "toolbar" | "inline";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        prominence === "toolbar" ? localStyles.toolbarActionButton : localStyles.actionButton,
        {
          borderColor: primary ? palette.primary : palette.border,
          backgroundColor: primary ? palette.primary : prominence === "toolbar" ? palette.backgroundSoft : palette.panel,
        },
      ]}
    >
      <Text
        style={[
          localStyles.actionButtonText,
          { color: primary ? palette.primaryText : palette.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MiniToggle({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        localStyles.miniToggle,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? palette.primary : palette.panel,
        },
      ]}
    >
      <Text
        style={[
          localStyles.miniToggleText,
          { color: active ? palette.primaryText : palette.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  title,
  body,
  palette,
}: {
  title: string;
  body: string;
  palette: Palette;
}) {
  return (
    <View style={[localStyles.emptyState, { borderColor: palette.border, backgroundColor: palette.panel }]}>
      <Text style={[localStyles.emptyStateTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[localStyles.emptyStateBody, { color: palette.textSoft }]}>{body}</Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  actionButton: {
    minHeight: 40,
    minWidth: 72,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 2,
  },
  toolbarActionButton: {
    minHeight: 52,
    minWidth: 108,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 3,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  miniToggle: {
    minHeight: 34,
    minWidth: 56,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 2,
  },
  miniToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 16,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyStateBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});

function createStyles(palette: Palette, topInset: number) {
  return StyleSheet.create({
    app: {
      flex: 1,
      backgroundColor: palette.background,
      paddingHorizontal: 14,
      paddingTop: topInset,
    },
    centered: {
      justifyContent: "center",
      alignItems: "center",
    },
    loadingTitle: {
      color: palette.text,
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 10,
    },
    loadingText: {
      color: palette.textSoft,
      fontSize: 14,
    },
    header: {
      gap: 10,
      marginBottom: 12,
    },
    headerTitle: {
      color: palette.text,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    headerSubtitle: {
      color: palette.textSoft,
      fontSize: 12,
      marginTop: 4,
    },
    headerActions: {
      flexDirection: "row",
      gap: 8,
      alignSelf: "flex-start",
      marginTop: 4,
    },
    tabRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    tabButton: {
      flex: 1,
      minHeight: 38,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
    },
    tabButtonActive: {
      borderColor: palette.primary,
      backgroundColor: palette.primary,
    },
    tabButtonText: {
      color: palette.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    tabButtonTextActive: {
      color: palette.primaryText,
    },
    screen: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
      gap: 12,
    },
    toolbarRow: {
      gap: 10,
    },
    searchInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      color: palette.text,
      borderRadius: 2,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    modeSwitch: {
      flexDirection: "row",
      gap: 8,
      alignSelf: "flex-start",
    },
    listColumn: {
      gap: 8,
    },
    docRow: {
      flexDirection: "row",
      gap: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      padding: 12,
      alignItems: "flex-start",
    },
    docRowSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.backgroundSoft,
    },
    docMark: {
      width: 42,
      height: 42,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.chip,
      borderRadius: 2,
      justifyContent: "center",
      alignItems: "center",
    },
    docMarkText: {
      color: palette.primaryStrong,
      fontSize: 12,
      fontWeight: "800",
    },
    docCopy: {
      flex: 1,
      gap: 4,
    },
    docTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: "700",
    },
    docExcerpt: {
      color: palette.textSoft,
      fontSize: 13,
      lineHeight: 19,
    },
    docTime: {
      color: palette.textSoft,
      fontSize: 11,
      marginTop: 2,
    },
    previewGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    previewCard: {
      width: "48.8%",
      minHeight: 132,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      padding: 12,
      justifyContent: "space-between",
    },
    previewCardSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.backgroundSoft,
    },
    previewCardTitle: {
      color: palette.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
    },
    previewCardText: {
      color: palette.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    previewCardTime: {
      color: palette.textSoft,
      fontSize: 11,
    },
    docHeader: {
      gap: 10,
    },
    docHeaderCopy: {
      gap: 6,
    },
    editorTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: "800",
    },
    editorMeta: {
      color: palette.textSoft,
      fontSize: 12,
    },
    docHeaderActions: {
      flexDirection: "row",
      gap: 8,
      alignSelf: "flex-start",
    },
    editorSurface: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.editorSurface,
      borderRadius: 2,
      padding: 14,
      minHeight: 420,
    },
    editorInput: {
      minHeight: 420,
      color: palette.text,
      fontSize: 15,
      lineHeight: 24,
      padding: 0,
      backgroundColor: "transparent",
    },
    footerActions: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    exportCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      padding: 14,
      gap: 12,
    },
    exportTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: "800",
    },
    exportInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      color: palette.text,
      borderRadius: 2,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    exportFormatRow: {
      flexDirection: "row",
      gap: 8,
    },
    exportActions: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    formatRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    formatButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      justifyContent: "center",
      alignItems: "center",
    },
    formatButtonText: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    readerSurface: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      padding: 16,
      gap: 14,
    },
    readerHeader: {
      gap: 4,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    readerTitle: {
      color: palette.text,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
    },
    readerMetaTitle: {
      color: palette.textSoft,
      fontSize: 12,
    },
    settingsCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 2,
      padding: 14,
      gap: 12,
    },
    settingsTitle: {
      color: palette.text,
      fontSize: 18,
      fontWeight: "800",
    },
    settingsBody: {
      color: palette.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    themeGrid: {
      gap: 8,
    },
    themeCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      borderRadius: 2,
      padding: 12,
      gap: 6,
    },
    themeCardActive: {
      borderColor: palette.primary,
      backgroundColor: palette.backgroundSoft,
    },
    themeCardTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: "700",
    },
    themeCardTitleActive: {
      color: palette.primaryStrong,
    },
    themeCardText: {
      color: palette.textSoft,
      fontSize: 13,
      lineHeight: 20,
    },
    themeCardTextActive: {
      color: palette.textMuted,
    },
    versionText: {
      color: palette.textSoft,
      fontSize: 12,
      marginTop: -4,
    },
    changelogList: {
      gap: 8,
    },
    changelogItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    changelogBullet: {
      color: palette.primary,
      fontSize: 14,
      lineHeight: 20,
    },
    changelogText: {
      flex: 1,
      color: palette.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.18)",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 3,
      padding: 16,
      gap: 12,
    },
    actionSheetCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      borderRadius: 3,
      padding: 18,
      gap: 14,
    },
    modalTitle: {
      color: palette.text,
      fontSize: 18,
      fontWeight: "800",
    },
    modalSubtitle: {
      color: palette.textSoft,
      fontSize: 14,
    },
    modalInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      color: palette.text,
      borderRadius: 2,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    modalActions: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    actionSheetActions: {
      gap: 10,
      marginTop: 6,
    },
    actionSheetButton: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      borderRadius: 3,
      justifyContent: "center",
      alignItems: "center",
    },
    actionSheetButtonPrimary: {
      borderColor: palette.primary,
      backgroundColor: palette.backgroundSoft,
    },
    actionSheetButtonText: {
      color: palette.text,
      fontSize: 15,
      fontWeight: "700",
    },
    actionSheetButtonPrimaryText: {
      color: palette.primaryStrong,
      fontSize: 15,
      fontWeight: "800",
    },
    actionSheetButtonDangerText: {
      color: palette.primary,
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
