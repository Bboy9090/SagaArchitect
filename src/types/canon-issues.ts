export type CanonIssueSeverity = 'info' | 'warning' | 'error';

export type CanonIssueCategory =
  | 'orphan_scene'
  | 'orphan_storyboard_panel'
  | 'duplicate_scene_order'
  | 'duplicate_storyboard_panel_number'
  | 'empty_required_field'
  | 'broken_asset_reference'
  | 'missing_local_asset_file'
  | 'asset_file_validation_deferred'
  | 'timeline_ordering_conflict'
  | 'missing_character_reference'
  | 'duplicate_lore_rule'
  | 'conflicting_lore_definition'
  | 'contradictory_lore_deferred';

export type CanonIssueEntityType =
  | 'project'
  | 'character'
  | 'faction'
  | 'location'
  | 'timeline_event'
  | 'story_arc'
  | 'lore_rule'
  | 'generated_story'
  | 'scene'
  | 'asset'
  | 'storyboard_panel';

export interface CanonIssue {
  id: string; // Deterministic: e.g., category-entity-entityId-details
  projectId: string;
  category: CanonIssueCategory;
  severity: CanonIssueSeverity;
  title: string;
  explanation: string;
  entityType: CanonIssueEntityType;
  entityId: string;
  suggestedFix?: string;
  metadata?: Record<string, unknown>;
}

export interface CanonScanResult {
  projectId: string;
  scannedAt: string;
  totalIssues: number;
  countsBySeverity: {
    info: number;
    warning: number;
    error: number;
  };
  countsByCategory: Record<CanonIssueCategory, number>;
  issues: CanonIssue[];
}
