export type StudioCapabilityStatus = 'live' | 'foundation' | 'planned';

export type PhoenixStudioId =
  | 'write'
  | 'design'
  | 'image'
  | 'illustrate'
  | 'comic'
  | 'storyboard'
  | 'video'
  | 'motion'
  | 'audio'
  | 'world'
  | 'assets'
  | 'publish';

export interface PhoenixStudioCapability {
  id: PhoenixStudioId;
  label: string;
  icon: string;
  status: StudioCapabilityStatus;
  summary: string;
  capabilities: string[];
  route?: (projectId: string) => string;
  productionTypes: string[];
}

export const PHOENIX_STUDIOS: PhoenixStudioCapability[] = [
  {
    id: 'write',
    label: 'Write',
    icon: '✎',
    status: 'live',
    summary: 'Manuscripts, scripts, scenes, story development, and canon-aware writing.',
    capabilities: ['Writing room', 'Scenes', 'Story generation', 'Project canon'],
    route: id => `/universe/${id}/stories`,
    productionTypes: ['book', 'script', 'short_story'],
  },
  {
    id: 'design',
    label: 'Design',
    icon: '▦',
    status: 'foundation',
    summary: 'Page, cover, poster, thumbnail, and promotional layout workspace.',
    capabilities: ['Layout presets', 'Guides and safe zones', 'Undo/redo', 'Snapping', 'SVG export'],
    route: id => `/universe/${id}/design`,
    productionTypes: ['design', 'book', 'comic'],
  },
  {
    id: 'image',
    label: 'Image',
    icon: '◫',
    status: 'foundation',
    summary: 'Layered raster editing, selections, masks, adjustments, and generative edits.',
    capabilities: ['Persistent layers', 'Text and shapes', 'Transforms', 'Blend modes', 'Asset Library images'],
    route: id => `/universe/${id}/image`,
    productionTypes: ['design', 'illustration'],
  },
  {
    id: 'illustrate',
    label: 'Illustrate',
    icon: '✦',
    status: 'foundation',
    summary: 'Drawing and painting workspace for characters, environments, covers, and pages.',
    capabilities: ['Canvas drawing foundation', 'Asset library', 'Canon-linked characters'],
    route: id => `/universe/${id}/storyboard`,
    productionTypes: ['illustration', 'comic', 'children_book'],
  },
  {
    id: 'comic',
    label: 'Comic',
    icon: '▤',
    status: 'foundation',
    summary: 'Script-to-panel production with page composition, lettering, and motion-comic handoff.',
    capabilities: ['Panel templates', 'Panel art placement', 'Speech balloons', 'Captions', 'Direct transforms', 'Raster export'],
    route: id => `/universe/${id}/comic`,
    productionTypes: ['comic', 'motion_comic'],
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    icon: '▥',
    status: 'live',
    summary: 'Shot and panel planning with camera framing, dialogue, sketches, and project assets.',
    capabilities: ['Scene selection', 'Panel CRUD', 'Camera shots', 'Drawing canvas', 'Asset attachment'],
    route: id => `/universe/${id}/storyboard`,
    productionTypes: ['film', 'comic', 'video', 'motion_comic'],
  },
  {
    id: 'video',
    label: 'Video',
    icon: '▷',
    status: 'foundation',
    summary: 'Non-linear video and short-form editing with canon-aware project media.',
    capabilities: ['Non-linear timeline', 'Trim and split', 'Media preview', 'Playback speed', 'Volume', 'Vertical video presets'],
    route: id => `/universe/${id}/video`,
    productionTypes: ['film', 'video', 'short_video'],
  },
  {
    id: 'motion',
    label: 'Motion',
    icon: '⌁',
    status: 'foundation',
    summary: 'Motion graphics, animatics, panel animation, parallax, and motion comics.',
    capabilities: ['Storyboard import', 'Panel timing', 'Ken Burns keyframes', 'Dialogue captions', 'Fade transitions'],
    route: id => `/universe/${id}/motion`,
    productionTypes: ['motion_comic', 'video', 'film'],
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '♫',
    status: 'foundation',
    summary: 'Voice, music, SFX, waveform editing, and timeline audio production.',
    capabilities: ['WAV/MP3 ingest', 'Decoded waveforms', 'Voice/Music/SFX buses', 'Trim and timing', 'Gain/pan/fades', 'Mute/solo'],
    route: id => `/universe/${id}/audio`,
    productionTypes: ['audio', 'video', 'film', 'motion_comic'],
  },
  {
    id: 'world',
    label: 'World',
    icon: '◇',
    status: 'live',
    summary: 'Canon, characters, factions, locations, timeline, arcs, and continuity.',
    capabilities: ['Project bible', 'Characters', 'Factions', 'Timeline', 'Lore rules'],
    route: id => `/universe/${id}`,
    productionTypes: ['world_bible'],
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: '◉',
    status: 'live',
    summary: 'Project media library with validated uploads and reusable production references.',
    capabilities: ['Image uploads', 'Validated file signatures', 'Project asset serving', 'Storyboard reuse'],
    route: id => `/universe/${id}#assets`,
    productionTypes: ['design', 'illustration', 'video', 'audio'],
  },
  {
    id: 'publish',
    label: 'Publish',
    icon: '⇩',
    status: 'live',
    summary: 'Production packets, server-rendered PDFs, backups, and release outputs.',
    capabilities: ['Server PDF', 'Printable PDF', 'JSON backup', 'Asset-aware export'],
    route: id => `/universe/${id}/export`,
    productionTypes: ['book', 'comic', 'film', 'world_bible'],
  },
];

export const STUDIO_STATUS_LABELS: Record<StudioCapabilityStatus, string> = {
  live: 'Live',
  foundation: 'Foundation',
  planned: 'Planned',
};
