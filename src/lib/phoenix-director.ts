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
