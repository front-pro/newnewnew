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
  shares?: { email: string; permission: "viewer" | "commenter" | "editor" }[];
  comments?: { id: string; author: string; text: string; createdAt: string }[];
  title: string;
  source: "editor" | "upload";
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersion[];
};

export type DocumentSummary = Pick<SavedDocument, "id" | "title" | "source" | "createdAt" | "updatedAt" | "workspaceId"> & {
  version: number;
  versionCount: number;
  size: number;
  excerpt: string;
};

export type DocumentDetail = DocumentSummary & { versions: DocumentVersion[] };

export type DocumentPermission = "owner" | "editor" | "commenter" | "viewer" | "none";

export function summarizeDocument(document: SavedDocument): DocumentSummary {
  const latest = document.versions[document.versions.length - 1];
  return {
    id: document.id,
    title: document.title,
    source: document.source,
    workspaceId: document.workspaceId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    version: latest.version,
    versionCount: document.versions.length,
    size: new TextEncoder().encode(latest.text).length,
    excerpt: latest.text.replace(/\s+/g, " ").slice(0, 160),
  };
}
