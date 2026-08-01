import type { Universe as Project, Character, Scene, StoryboardPanel, WritingDocument, WritingDocumentRevision } from './types';

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

export async function dbCreateProject(data: Partial<Project>): Promise<Project> {
  const res = await fetch('/api/db/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(res);
}

export async function dbGetProject(id: string): Promise<Project> {
  const res = await fetch(`/api/db/projects/${id}`);
  return handleResponse<Project>(res);
}

export async function dbUpdateProject(id: string, data: Partial<Project>): Promise<Project> {
  const res = await fetch(`/api/db/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(res);
}

export async function dbDeleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/db/projects/${id}`, {
    method: 'DELETE',
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
    // Try to extract a JSON error message; if the body isn't JSON, fall back
    let errMsg = 'PDF export failed';
    try {
      const json = await res.json();
      errMsg = json.error || errMsg;
    } catch {
      // non-JSON body — keep generic message
    }
    throw new Error(errMsg);
  }
  return res.blob();
}
