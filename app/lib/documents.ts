import { editorHtmlToText } from "./editor-content";

export type DocumentVersion = {
  version: number;
  title: string;
  text: string;
  savedAt: string;
};

export type SavedDocument = {
  id: string;
  owner: string;
  workspaceId?: string;
  dueDate?: string;
  approvalId?: string;
  deletedAt?: string;
  shares?: { email: string; permission: "viewer" | "commenter" | "editor" }[];
  groupShares?: { groupId: string; permission: "viewer" | "commenter" | "editor" }[];
  comments?: { id: string; author: string; text: string; createdAt: string; clause?: string; version?: number }[];
  organization?: Record<string, { folder: string; tags: string[]; favorite: boolean }>;
  title: string;
  source: "editor" | "upload";
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersion[];
};

export type DocumentSummary = Pick<SavedDocument, "id" | "title" | "source" | "createdAt" | "updatedAt" | "workspaceId" | "dueDate"> & {
  folder: string;
  tags: string[];
  favorite: boolean;
  version: number;
  versionCount: number;
  size: number;
  excerpt: string;
};

export type DocumentDetail = DocumentSummary & { versions: DocumentVersion[] };

export type DocumentPermission = "owner" | "editor" | "commenter" | "viewer" | "none";

export function summarizeDocument(document: SavedDocument, userId?: string): DocumentSummary {
  const latest = document.versions[document.versions.length - 1];
  return {
    folder: userId ? document.organization?.[userId]?.folder || "" : "",
    tags: userId ? document.organization?.[userId]?.tags || [] : [],
    favorite: userId ? document.organization?.[userId]?.favorite || false : false,
    id: document.id,
    title: document.title,
    source: document.source,
    workspaceId: document.workspaceId,
    dueDate: document.dueDate,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    version: latest.version,
    versionCount: document.versions.length,
    size: new TextEncoder().encode(latest.text).length,
    excerpt: editorHtmlToText(latest.text).replace(/\s+/g, " ").slice(0, 160),
  };
}

export type DocumentDeadlineStatus = "overdue" | "today" | "soon" | "later";

export function getDocumentDeadlineStatus(dueDate?: string, today = new Date().toISOString().slice(0, 10)): DocumentDeadlineStatus | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(current) || new Date(due).toISOString().slice(0, 10) !== dueDate) return null;
  const days = Math.round((due - current) / 86_400_000);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 30 ? "soon" : "later";
}
