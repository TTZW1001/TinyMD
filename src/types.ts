export type ThemeMode = "light" | "dark" | "sepia";

export type TabKey = "recent" | "editor" | "reader" | "settings";

export type RecentViewMode = "list" | "preview";

export type EditorMode = "rendered" | "source";

export type MarkdownDocument = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  excerpt: string;
  storageUri?: string;
  originalUri?: string;
  isBundled?: boolean;
};
