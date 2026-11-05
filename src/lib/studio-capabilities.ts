export type StudioCapabilityStatus = 'live' | 'foundation' | 'planned';

export type PhoenixStudioId =
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
  | 'world'
  | 'storymap'
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
    id: 'book',
    label: 'Book Production',
    icon: '▥',
    status: 'foundation',
    summary: 'Trim-aware manuscript packaging, publishing preflight, metadata, DOCX, EPUB, and print-layout proofing.',
    capabilities: ['Publishing preflight', 'Trim presets', 'Bleed/gutter/margins', 'DOCX', 'EPUB', 'Print-layout PDF'],
    route: id => `/universe/${id}/book`,
    productionTypes: ['book', 'children_book', 'short_story'],
  },
  {
    id: 'design',
    label: 'Design',
    icon: '▦',
    status: 'foundation',
    summary: 'Page, cover, poster, thumbnail, and promotional layout workspace with shared professional media primitives.',
    capabilities: ['Layout presets', 'Guides and safe zones', 'Vector paths', 'Bezier editing', 'Gradients', 'Layer groups', 'Advanced typography controls', 'Cloud autosave', 'SVG/raster export'],
    route: id => `/universe/${id}/design`,
    productionTypes: ['design', 'book', 'comic'],
  },
  {
    id: 'image',
    label: 'Image',
    icon: '◫',
    status: 'foundation',
    summary: 'Layered raster/vector editing with masks, adjustments, reusable structure, and cloud-safe documents.',
    capabilities: ['Persistent cloud layers', 'Raster paint', 'Text/shapes/vector paths', 'Bezier handles', 'Editable masks', 'Blend modes/gradients', 'Layer groups', 'PNG/JPEG/WebP export'],
    route: id => `/universe/${id}/image`,
    productionTypes: ['design', 'illustration'],
  },
  {
    id: 'illustrate',
    label: 'Illustrate',
    icon: '✦',
    status: 'foundation',
    summary: 'Drawing, painting, and vector-ink workspace for characters, environments, covers, and pages.',
    capabilities: ['Pressure-aware raster painting', 'Smooth/marker/chalk/spray brushes', 'Reusable brush presets', 'Persistent vector ink', 'Per-stroke style editing', 'Pressure-tapered vector ink', 'Stabilization', 'Symmetry', 'Perspective guides', 'Color harmony palettes', 'Pose construction guides', 'Reference layers', 'Cloud autosave', 'Vector-preserving SVG export', 'PNG export', 'JPEG export', 'WebP export'],
    route: id => `/universe/${id}/illustrate`,
    productionTypes: ['illustration', 'comic', 'children_book'],
  },
  {
    id: 'comic',
    label: 'Comic',
    icon: '▤',
    status: 'foundation',
    summary: 'Issue-scale comic production with linked panel stacks, advanced lettering, cloud pages, and motion-comic handoff.',
    capabilities: ['Multi-page issues', 'Linked panel stacks', 'Panel art placement', 'Speech/thought/burst balloons', 'Editable speech tails', 'Captions', 'Cloud page persistence', 'Comic-to-Motion handoff', 'Raster/CBZ export'],
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
    summary: 'Multitrack non-linear video and short-form editing with compositing, automation, recovery, and real WebM rendering.',
    capabilities: ['Multitrack compositing', 'Drag/trim/split/ripple edits', 'Snapping and markers', 'Work area/loop', 'Track mute/solo/lock', 'Speed ramps', 'Transform/easing keyframes', 'Blend/crop/color/blur effects', 'Title graphics', 'Audio automation/ducking', 'Cloud recovery', 'WebM export'],
    route: id => `/universe/${id}/video`,
    productionTypes: ['film', 'video', 'short_video'],
  },
  {
    id: 'motion',
    label: 'Motion',
    icon: '⌁',
    status: 'foundation',
    summary: 'Layered motion-comic and animatic production with parallax, source swaps, synchronized audio, and Video handoff.',
    capabilities: ['Storyboard/Comic import', 'Layered overlay tracks', 'Transform keyframes/easing', 'Depth-assisted parallax', 'Pose/mouth source swaps', 'Dialogue captions', 'Synced Audio Studio mixes', 'Cloud timeline recovery', 'Video Studio promotion'],
    route: id => `/universe/${id}/motion`,
    productionTypes: ['motion_comic', 'video', 'film'],
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '♫',
    status: 'foundation',
    summary: 'Voice, music, SFX, waveform editing, mix rendering, and synchronized timeline audio production.',
    capabilities: ['WAV/MP3 ingest', 'Decoded waveforms', 'Voice/Music/SFX tracks', 'Trim/timing/rate', 'Gain/pan/fades', 'Mute/solo', 'Real WAV mix render', 'Sync to Video/Motion', 'Cloud timeline recovery'],
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
    id: 'storymap',
    label: 'StoryMap',
    icon: '⌘',
    status: 'foundation',
    summary: 'Read-only canon graph connecting character arcs, relationships, factions, locations, story arcs, and timeline participation without inventing unresolved links.',
    capabilities: ['Character relationships', 'Character arc timeline lines', 'Faction ally/enemy graph', 'Locations', 'Story arc relationships', 'Timeline participation', 'Reference-integrity warnings', 'Node filters'],
    route: id => `/universe/${id}/storymap`,
    productionTypes: ['world_bible', 'book', 'comic', 'film', 'game'],
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: '◉',
    status: 'live',
    summary: 'Project media library with validated uploads, cross-device organization, and reusable production references.',
    capabilities: ['Validated image/video/audio uploads', 'Bounded multi-file upload', 'Search/filter/sort', 'Metadata rename', 'Folders', 'Tags', 'Favorites', 'Studio Cloud metadata sync', 'Project asset serving', 'Storyboard reuse'],
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
