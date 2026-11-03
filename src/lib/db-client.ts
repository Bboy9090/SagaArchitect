import type { Universe as Project, Character, Scene, StoryboardPanel, WritingDocument, WritingDocumentRevision } from './types';
import type { PhoenixMediaDocument, PhoenixMediaDocumentKind } from './media-composition';

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Database operation failed');
  }
  return json.data as T;
}

// PROJECTS
export async function dbGetProjects(): Promise<Project[]> {
  const res = await fetch('/api/db/projects');
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.data || []) as Project[];
}

export async function dbCreateProject(data: Partial<Project>, idempotencyKey = crypto.randomUUID()): Promise<Project> {
  const res = await fetch('/api/db/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(res);
}

export async function dbGetProject(id: string): Promise<Project> {
  const res = await fetch(`/api/db/projects/${id}`);
  return handleResponse<Project>(res);
}

export async function dbUpdateProject(id: string, data: Partial<Project>): Promise<Project> {
  const expectedVersion = typeof data.version === 'number' ? data.version : (await dbGetProject(id)).version ?? 1;
  const res = await fetch(`/api/db/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': `"${expectedVersion}"` },
    body: JSON.stringify({ ...data, expected_version: expectedVersion }),
  });
  return handleResponse<Project>(res);
}

export async function dbDeleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/db/projects/${id}`, {
    method: 'DELETE',
    headers: { 'X-Confirm-Project-Id': id },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to delete project');
  }
}

// CHARACTERS
export async function dbGetCharacters(projectId: string): Promise<Character[]> {
  const res = await fetch(`/api/db/projects/${projectId}/characters`);
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.data || []) as Character[];
}

export async function dbSaveCharacter(projectId: string, character: Character): Promise<Character> {
  const res = await fetch(`/api/db/projects/${projectId}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(character),
  });
  return handleResponse<Character>(res);
}

export async function dbDeleteCharacter(characterId: string): Promise<void> {
  const res = await fetch(`/api/db/characters/${characterId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to delete character');
  }
}

// SCENES
export async function dbGetScenes(projectId: string): Promise<Scene[]> {
  const res = await fetch(`/api/db/projects/${projectId}/scenes`);
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.data || []) as Scene[];
}

export async function dbSaveScene(projectId: string, scene: Scene): Promise<Scene> {
  const res = await fetch(`/api/db/projects/${projectId}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scene),
  });
  return handleResponse<Scene>(res);
}

export async function dbDeleteScene(sceneId: string): Promise<void> {
  const res = await fetch(`/api/db/scenes/${sceneId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to delete scene');
  }
}

// WRITING DOCUMENTS
export async function dbGetWritingDocuments(projectId: string): Promise<WritingDocument[]> {
  const res = await fetch(`/api/db/projects/${projectId}/writing-documents`);
  return handleResponse<WritingDocument[]>(res);
}

export async function dbSaveWritingDocument(projectId: string, document: WritingDocument): Promise<WritingDocument> {
  const res = await fetch(`/api/db/projects/${projectId}/writing-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  return handleResponse<WritingDocument>(res);
}

export async function dbReorderWritingDocuments(projectId: string, documents: WritingDocument[]): Promise<WritingDocument[]> {
  const payload = documents.map(document => ({ id: document.id, parent_id: document.parent_id, order: document.order, version: document.version }));
  const res = await fetch(`/api/db/projects/${projectId}/writing-documents/reorder`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return handleResponse<WritingDocument[]>(res);
}

export async function dbDeleteWritingDocument(documentId: string): Promise<void> {
  const res = await fetch(`/api/db/writing-documents/${documentId}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to delete writing document');
}

export async function dbGetWritingDocumentRevisions(documentId: string): Promise<WritingDocumentRevision[]> {
  const res = await fetch(`/api/db/writing-documents/${documentId}/revisions`);
  return handleResponse<WritingDocumentRevision[]>(res);
}

export async function dbRestoreWritingDocument(documentId: string, revisionId: string): Promise<WritingDocument> {
  const res = await fetch(`/api/db/writing-documents/${documentId}/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision_id: revisionId }),
  });
  return handleResponse<WritingDocument>(res);
}

// STORYBOARD PANELS
export async function dbGetStoryboardPanels(sceneId: string): Promise<StoryboardPanel[]> {
  const res = await fetch(`/api/db/scenes/${sceneId}/storyboard`);
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.data || []) as StoryboardPanel[];
}

export async function dbSaveStoryboardPanel(sceneId: string, panel: StoryboardPanel): Promise<StoryboardPanel> {
  const res = await fetch(`/api/db/scenes/${sceneId}/storyboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(panel),
  });
  return handleResponse<StoryboardPanel>(res);
}

export async function dbDeleteStoryboardPanel(panelId: string): Promise<void> {
  const res = await fetch(`/api/db/storyboard/${panelId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to delete panel');
  }
}

export async function dbAttachAssetToStoryboardPanel(panelId: string, assetId: string): Promise<void> {
  const res = await fetch(`/api/db/storyboard/${panelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to attach asset to panel');
  }
}

export async function dbClearStoryboardPanelAsset(panelId: string): Promise<void> {
  const res = await fetch(`/api/db/storyboard/${panelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: null }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to clear panel asset');
  }
}

// ASSETS
export interface ProjectAsset {
  id: string;
  project_id: string;
  name: string;
  file_size: number;
  mime_type: string;
  storage_provider: string;
  created_at: string;
  updated_at: string;
  serve_url: string;
}

export async function dbGetAssets(projectId: string): Promise<ProjectAsset[]> {
  const res = await fetch(`/api/db/projects/${projectId}/assets`);
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.data || []) as ProjectAsset[];
}

export async function dbUploadAsset(projectId: string, file: File): Promise<ProjectAsset> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);

  const res = await fetch('/api/db/assets/upload', {
    method: 'POST',
    body: formData,
  });
  return handleResponse<ProjectAsset>(res);
}

export async function dbDeleteAsset(assetId: string): Promise<void> {
  const res = await fetch(`/api/db/assets/${assetId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to delete asset');
  }
}

// PDF EXPORT
export async function dbExportProjectPdf(projectId: string): Promise<Blob> {
  const res = await fetch(`/api/db/projects/${projectId}/export/pdf`, {
    method: 'POST',
  });
  if (!res.ok) {
    let errMsg = 'PDF export failed';
    try {
      const json = await res.json();
      errMsg = json.error || errMsg;
    } catch {
      // Non-JSON body — keep generic message.
    }
    throw new Error(errMsg);
  }
  return res.blob();
}


// MEDIA DOCUMENTS
const mediaDocumentVersions = new Map<string, number>();
const mediaDocumentSaveQueues = new Map<string, Promise<PhoenixMediaDocument>>();

function mediaDocumentKey(projectId: string, kind: PhoenixMediaDocumentKind): string {
  return `${projectId}:${kind}`;
}

export async function dbGetMediaDocument(projectId: string, kind: PhoenixMediaDocumentKind): Promise<PhoenixMediaDocument | null> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents?kind=${encodeURIComponent(kind)}`);
  const document = await handleResponse<PhoenixMediaDocument | null>(res);
  if (document) mediaDocumentVersions.set(mediaDocumentKey(projectId, kind), document.version || 1);
  return document;
}

export async function dbGetComicPages(projectId: string): Promise<PhoenixMediaDocument[]> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents?prefix=comic_page`);
  const documents = await handleResponse<PhoenixMediaDocument[]>(res);
  for (const document of documents) {
    mediaDocumentVersions.set(mediaDocumentKey(projectId, document.kind), document.version || 1);
  }
  return documents;
}

export function dbSaveMediaDocument(projectId: string, document: PhoenixMediaDocument): Promise<PhoenixMediaDocument> {
  const key = mediaDocumentKey(projectId, document.kind);
  const previous = mediaDocumentSaveQueues.get(key) || Promise.resolve(document);
  const next = previous.catch(() => document).then(async () => {
    const expectedVersion = mediaDocumentVersions.get(key) ?? document.version ?? 1;
    const res = await fetch(`/api/db/projects/${projectId}/media-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: document.kind, document: { ...document, version: expectedVersion } }),
    });
    const saved = await handleResponse<PhoenixMediaDocument>(res);
    mediaDocumentVersions.set(key, saved.version || expectedVersion);
    return saved;
  });
  mediaDocumentSaveQueues.set(key, next);
  void next.finally(() => {
    if (mediaDocumentSaveQueues.get(key) === next) mediaDocumentSaveQueues.delete(key);
  });
  return next;
}


export interface MediaDocumentRevisionSummary {
  id: string;
  action: string;
  version: number;
  label: string | null;
  reason: string | null;
  created_at: string;
}

export async function dbGetMediaDocumentHistory(
  projectId: string,
  kind: PhoenixMediaDocumentKind,
): Promise<MediaDocumentRevisionSummary[]> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents/history?kind=${encodeURIComponent(kind)}`);
  return handleResponse<MediaDocumentRevisionSummary[]>(res);
}

export async function dbCreateMediaDocumentSnapshot(
  projectId: string,
  kind: PhoenixMediaDocumentKind,
  label?: string,
): Promise<MediaDocumentRevisionSummary> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, label }),
  });
  return handleResponse<MediaDocumentRevisionSummary>(res);
}

export async function dbRestoreMediaDocument(
  projectId: string,
  kind: PhoenixMediaDocumentKind,
  historyId: string,
  expectedVersion: number,
): Promise<PhoenixMediaDocument> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, history_id: historyId, expected_version: expectedVersion }),
  });
  const restored = await handleResponse<PhoenixMediaDocument>(res);
  mediaDocumentVersions.set(mediaDocumentKey(projectId, kind), restored.version || expectedVersion + 1);
  return restored;
}

export async function dbDeleteComicPage(projectId: string, kind: PhoenixMediaDocumentKind): Promise<void> {
  const res = await fetch(`/api/db/projects/${projectId}/media-documents?kind=${encodeURIComponent(kind)}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to delete comic page');
  const key = mediaDocumentKey(projectId, kind);
  mediaDocumentVersions.delete(key);
  mediaDocumentSaveQueues.delete(key);
}
}
