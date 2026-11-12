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

export type DocumentSummary = Pick<SavedDocument, "id" | "title" | "source" | "createdAt" | "updatedAt" | "workspaceId"> & {
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
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    version: latest.version,
    versionCount: document.versions.length,
    size: new TextEncoder().encode(latest.text).length,
    excerpt: editorHtmlToText(latest.text).replace(/\s+/g, " ").slice(0, 160),
  };
}
