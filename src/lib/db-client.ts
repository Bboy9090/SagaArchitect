import type { Universe as Project, Character, Scene, StoryboardPanel } from './types';

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
