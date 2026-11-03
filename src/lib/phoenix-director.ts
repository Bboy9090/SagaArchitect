export type PhoenixDirectorStudio =
  | 'write'
  | 'book'
  | 'design'
  | 'image'
  | 'illustrate'
  | 'comic'
  | 'storyboard'
  | 'video'
  | 'motion'
  | 'audio'
  | 'publish';

export interface PhoenixDirectorAction {
  id: string;
  studio: PhoenixDirectorStudio;
  title: string;
  objective: string;
  instructions: string[];
  canon_refs: string[];
  depends_on: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  completion_signal: string;
}

export interface PhoenixDirectorPlan {
  project_summary: string;
  creative_strategy: string;
  risks: string[];
  actions: PhoenixDirectorAction[];
}

export const DIRECTOR_STUDIO_ROUTES: Record<PhoenixDirectorStudio, (projectId: string) => string> = {
  write: id => `/universe/${id}/stories`,
  book: id => `/universe/${id}/book`,
  design: id => `/universe/${id}/design`,
  image: id => `/universe/${id}/image`,
  illustrate: id => `/universe/${id}/illustrate`,
  comic: id => `/universe/${id}/comic`,
  storyboard: id => `/universe/${id}/storyboard`,
  video: id => `/universe/${id}/video`,
  motion: id => `/universe/${id}/motion`,
  audio: id => `/universe/${id}/audio`,
  publish: id => `/universe/${id}/export`,
};

export function normalizeDirectorPlan(value: unknown): PhoenixDirectorPlan {
  if (!value || typeof value !== 'object') throw new Error('Director returned an invalid plan.');
  const source = value as Partial<PhoenixDirectorPlan>;
  if (typeof source.project_summary !== 'string' || typeof source.creative_strategy !== 'string' || !Array.isArray(source.actions)) {
    throw new Error('Director returned an incomplete plan.');
  }
  const actions = source.actions.slice(0, 24).map((action, index) => {
    if (!action || typeof action !== 'object') throw new Error('Director returned an invalid action.');
    const item = action as Partial<PhoenixDirectorAction>;
    const studio = item.studio;
    if (!studio || !(studio in DIRECTOR_STUDIO_ROUTES)) throw new Error('Director returned an unsupported studio.');
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `action-${index + 1}`,
      studio,
      title: typeof item.title === 'string' ? item.title.slice(0, 160) : 'Untitled action',
      objective: typeof item.objective === 'string' ? item.objective.slice(0, 2000) : '',
      instructions: Array.isArray(item.instructions) ? item.instructions.filter(value => typeof value === 'string').slice(0, 12) : [],
      canon_refs: Array.isArray(item.canon_refs) ? item.canon_refs.filter(value => typeof value === 'string').slice(0, 20) : [],
      depends_on: Array.isArray(item.depends_on) ? item.depends_on.filter(value => typeof value === 'string').slice(0, 20) : [],
      priority: ['critical','high','medium','low'].includes(item.priority || '') ? item.priority as PhoenixDirectorAction['priority'] : 'medium',
      completion_signal: typeof item.completion_signal === 'string' ? item.completion_signal.slice(0, 1000) : '',
    };
  });
  return {
    project_summary: source.project_summary.slice(0, 4000),
    creative_strategy: source.creative_strategy.slice(0, 6000),
    risks: Array.isArray(source.risks) ? source.risks.filter(value => typeof value === 'string').slice(0, 20) : [],
    actions,
  };
}


export type PhoenixDirectorActionStatus = 'pending' | 'in_progress' | 'done';

export interface PhoenixDirectorExecutionState {
  plan: PhoenixDirectorPlan;
  action_status: Record<string, PhoenixDirectorActionStatus>;
  updated_at: string;
}

export function createDirectorActionStatus(plan: PhoenixDirectorPlan): Record<string, PhoenixDirectorActionStatus> {
  return Object.fromEntries(plan.actions.map(action => [action.id, 'pending'])) as Record<string, PhoenixDirectorActionStatus>;
}

export function isDirectorActionReady(
  action: PhoenixDirectorAction,
  statuses: Record<string, PhoenixDirectorActionStatus>,
): boolean {
  return action.depends_on.every(id => statuses[id] === 'done');
}

export function directorExecutionProgress(
  plan: PhoenixDirectorPlan,
  statuses: Record<string, PhoenixDirectorActionStatus>,
): { complete: number; total: number; percent: number } {
  const total = plan.actions.length;
  const complete = plan.actions.filter(action => statuses[action.id] === 'done').length;
  return { complete, total, percent: total === 0 ? 0 : Math.round((complete / total) * 100) };
}

function directorExecutionStorageKey(projectId: string): string {
  return `phoenix:director:${projectId}:execution`;
}

export function loadDirectorExecutionState(projectId: string): PhoenixDirectorExecutionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(directorExecutionStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhoenixDirectorExecutionState>;
    const plan = normalizeDirectorPlan(parsed.plan);
    const sourceStatuses = parsed.action_status && typeof parsed.action_status === 'object' ? parsed.action_status : {};
    const action_status = Object.fromEntries(plan.actions.map(action => {
      const value = (sourceStatuses as Record<string, unknown>)[action.id];
      return [action.id, value === 'in_progress' || value === 'done' ? value : 'pending'];
    })) as Record<string, PhoenixDirectorActionStatus>;
    return {
      plan,
      action_status,
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDirectorExecutionState(
  projectId: string,
  plan: PhoenixDirectorPlan,
  actionStatus: Record<string, PhoenixDirectorActionStatus>,
): void {
  if (typeof window === 'undefined') return;
  const state: PhoenixDirectorExecutionState = {
    plan,
    action_status: Object.fromEntries(plan.actions.map(action => [
      action.id,
      actionStatus[action.id] === 'in_progress' || actionStatus[action.id] === 'done'
        ? actionStatus[action.id]
        : 'pending',
    ])) as Record<string, PhoenixDirectorActionStatus>,
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(directorExecutionStorageKey(projectId), JSON.stringify(state));
}
