import type { Project, Character, Scene, StoryboardPanel } from './types';

interface ExportParams {
  project: Project;
  characters: Character[];
  scenes: Scene[];
  storyboardPanels: StoryboardPanel[];
}

export function exportProjectToPrintableHtml({
  project,
  characters,
  scenes,
  storyboardPanels,
}: ExportParams): string {
  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Helper to map canon status to color badges in PDF
  const getCanonBadgeHtml = (status: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      canon: { bg: '#c9a84c15', text: '#c9a84c', border: '#c9a84c40' },
      draft: { bg: '#94a3b815', text: '#94a3b8', border: '#94a3b830' },
      alternate: { bg: '#a855f715', text: '#a855f7', border: '#a855f730' },
      deprecated: { bg: '#ef444415', text: '#ef4444', border: '#ef444430' },
      mystery: { bg: '#06b6d415', text: '#06b6d4', border: '#06b6d430' },
    };

    const c = colors[status] || colors.draft;
    return `
      <span style="
        display: inline-block;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background-color: ${c.bg};
        color: ${c.text};
        border: 1px solid ${c.border};
        padding: 2px 8px;
        border-radius: 4px;
        font-family: monospace;
      ">${status}</span>
    `;
  };

  // Generate Character profile cards
  const charactersHtml = characters.map(char => {
    const relationshipsList = char.relationships && char.relationships.length > 0
      ? char.relationships.map(r => `<li><strong>${r.character_name}</strong> (${r.type})</li>`).join('')
      : '<li>No recorded relationships</li>';

    return `
      <div class="character-card">
        <div class="card-header">
          <h3>${char.name}</h3>
          <div>
            ${getCanonBadgeHtml(char.canon_status)}
            <span class="status-pill status-${char.status}">${char.status}</span>
          </div>
        </div>
        <div class="card-grid">
          <div><strong>Title/Role:</strong> ${char.title || 'N/A'} - ${char.role || 'N/A'}</div>
          <div><strong>Motivations:</strong> ${char.motivations || 'N/A'}</div>
          <div><strong>Fears:</strong> ${char.fears || 'N/A'}</div>
          <div><strong>Powers/Skills:</strong> ${char.powers || 'N/A'}</div>
          <div><strong>Weaknesses:</strong> ${char.weaknesses || 'N/A'}</div>
          <div><strong>Arc Potential:</strong> ${char.arc_potential || 'N/A'}</div>
        </div>
        ${char.appearance ? `<div style="margin-top: 10px; font-size: 13px;"><strong>Appearance:</strong> ${char.appearance}</div>` : ''}
        ${char.speech_style ? `<div style="margin-top: 5px; font-size: 13px;"><strong>Speech Style:</strong> ${char.speech_style}</div>` : ''}
        <div class="relationships-section">
          <h4>Relationships</h4>
          <ul>${relationshipsList}</ul>
        </div>
      </div>
    `;
  }).join('');

  // Generate Scene beat items
  const scenesHtml = scenes.map(scene => {
    const scenePanels = storyboardPanels.filter(p => p.scene_id === scene.id);

    return `
      <div class="scene-item">
        <div class="scene-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="scene-order">#${scene.order}</span>
            <span class="scene-title">${scene.title}</span>
          </div>
          ${getCanonBadgeHtml(scene.canon_status)}
        </div>
        <p class="scene-summary">${scene.summary || 'No summary details provided.'}</p>
        ${scenePanels.length > 0 ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">Linked Storyboard Panels: ${scenePanels.length}</p>` : ''}
      </div>
    `;
  }).join('');

  // Generate Storyboard grid panels
  const storyboardHtml = scenes.map(scene => {
    const scenePanels = storyboardPanels.filter(p => p.scene_id === scene.id);
    if (scenePanels.length === 0) return '';

    const panelsGrid = scenePanels.map(panel => {
      const sketchHtml = panel.image_base64
        ? `<img src="${panel.image_base64}" alt="Panel ${panel.panel_number}" class="panel-img"/>`
        : `<div class="panel-img-placeholder">NO SKETCH</div>`;

      return `
        <div class="storyboard-panel">
          <div class="panel-header">
            <span>PANEL ${panel.panel_number}</span>
            <span class="panel-shot">${panel.camera_shot || 'Medium Shot'}</span>
          </div>
          <div class="panel-content">
            ${sketchHtml}
          </div>
          <div class="panel-body">
            <div style="margin-bottom: 8px;">
              <span class="field-label">Visual Details:</span>
              <p class="field-text">${panel.visual_prompt}</p>
            </div>
            <div style="margin-bottom: 8px;">
              <span class="field-label">Action/Directions:</span>
              <p class="field-text">${panel.action_description}</p>
            </div>
            ${panel.dialogue ? `
              <div class="panel-dialogue">
                <span class="field-label">Dialogue:</span>
                <p class="dialogue-text">"${panel.dialogue}"</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="scene-storyboard-block" style="page-break-inside: avoid; margin-bottom: 40px;">
        <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #111; margin-bottom: 15px;">
          Scene #${scene.order}: ${scene.title}
        </h3>
        <div class="storyboard-grid">
          ${panelsGrid}
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Production Packet</title>
  <style>
    /* CSS System Design for High-Fidelity PDF and Print Export */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Playfair+Display:ital,wght@0,600;0,800;1,400&display=swap');

    :root {
      --primary-color: #c9a84c;
      --text-color: #222;
      --bg-color: #fff;
      --border-color: #ddd;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', sans-serif;
      color: var(--text-color);
      background-color: var(--bg-color);
      line-height: 1.5;
      margin: 0;
      padding: 0;
      font-size: 14px;
    }

    h1, h2, h3, h4 {
      font-family: 'Playfair Display', serif;
      margin-top: 0;
      color: #111;
    }

    /* Print Break Utilities */
    .page-break {
      page-break-before: always;
    }

    /* Cover Page */
    .cover-container {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 100vh;
      padding: 80px 60px;
      page-break-after: always;
    }

    .cover-brand {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-size: 12px;
      color: var(--primary-color);
      border-bottom: 2px solid var(--primary-color);
      padding-bottom: 15px;
      width: fit-content;
    }

    .cover-main {
      margin-top: auto;
      margin-bottom: auto;
    }

    .cover-title {
      font-size: 48px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 20px;
    }

    .cover-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 18px;
      color: #666;
      font-weight: 300;
      max-width: 600px;
    }

    .cover-meta {
      border-top: 1px solid var(--border-color);
      padding-top: 30px;
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 20px;
      font-size: 12px;
      color: #555;
    }

    /* Inner Page Layout */
    .page-container {
      padding: 60px;
      max-width: 900px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 28px;
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
      margin-bottom: 25px;
      margin-top: 40px;
      page-break-after: avoid;
    }

    /* Project Overview Table/Grid */
    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }

    .overview-item {
      border: 1px solid var(--border-color);
      padding: 15px;
      border-radius: 6px;
    }

    .overview-item strong {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #777;
      margin-bottom: 4px;
    }

    .overview-full {
      grid-column: span 2;
    }

    /* Characters List */
    .character-card {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 20px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 13px;
    }

    .status-pill {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 12px;
      margin-left: 5px;
    }

    .status-alive { background-color: #def7ec; color: #03543f; }
    .status-dead { background-color: #fde8e8; color: #9b1c1c; }
    .status-missing { background-color: #fef08a; color: #713f12; }
    .status-legendary { background-color: #e1effe; color: #1e40af; }
    .status-unknown { background-color: #f3f4f6; color: #374151; }

    .relationships-section {
      margin-top: 15px;
      border-top: 1px dashed var(--border-color);
      padding-top: 10px;
    }

    .relationships-section h4 {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
    }

    .relationships-section ul {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;
    }

    /* Scenes List */
    .scene-item {
      border-left: 3px solid var(--primary-color);
      padding-left: 15px;
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .scene-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .scene-order {
      font-weight: 800;
      color: var(--primary-color);
      font-size: 16px;
    }

    .scene-title {
      font-size: 16px;
      font-weight: 600;
      color: #111;
    }

    .scene-summary {
      font-size: 13px;
      color: #444;
      margin: 0;
    }

    /* Storyboard Grid */
    .storyboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .storyboard-panel {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      page-break-inside: avoid;
      background: #fafafa;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      background: #eee;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: bold;
      border-bottom: 1px solid var(--border-color);
      font-family: monospace;
    }

    .panel-shot {
      color: #555;
    }

    .panel-content {
      aspect-ratio: 4/3;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .panel-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .panel-img-placeholder {
      font-family: monospace;
      color: #444;
      font-size: 11px;
      letter-spacing: 0.1em;
    }

    .panel-body {
      padding: 12px;
      font-size: 12px;
      flex-grow: 1;
    }

    .field-label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: bold;
      color: #777;
      margin-bottom: 2px;
    }

    .field-text {
      margin: 0;
      color: #111;
      line-height: 1.4;
    }

    .panel-dialogue {
      margin-top: 10px;
      border-left: 2px solid var(--primary-color);
      padding-left: 8px;
      background: rgba(201, 168, 76, 0.05);
      padding-top: 4px;
      padding-bottom: 4px;
    }

    .dialogue-text {
      font-family: monospace;
      font-style: italic;
      margin: 0;
      color: #333;
    }

    /* Print Settings Override */
    @media print {
      body {
        font-size: 12px;
      }
      
      .page-container {
        padding: 0;
        max-width: 100%;
      }

      .cover-container {
        min-height: 100%;
        height: 100vh;
        padding: 40px;
      }

      .storyboard-grid {
        grid-template-columns: 1fr 1fr;
      }

      .section-title {
        margin-top: 25px;
      }
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-container">
    <div class="cover-brand">Phoenix Creator Studio</div>
    <div class="cover-main">
      <h1 class="cover-title">${project.name}</h1>
      <div class="cover-subtitle">${project.concept || 'No concept description.'}</div>
    </div>
    <div class="cover-meta">
      <div>
        <strong>Created By</strong>
        <span>Bobby's World Creator System</span>
      </div>
      <div>
        <strong>Export Date</strong>
        <span>${exportDate}</span>
      </div>
    </div>
  </div>

  <div class="page-container">

    <!-- Section 1: Project Overview -->
    <h2 class="section-title">Project Overview</h2>
    <div class="overview-grid">
      <div class="overview-item">
        <strong>Genre</strong>
        <span>${project.genre || 'N/A'}</span>
      </div>
      <div class="overview-item">
        <strong>Tone</strong>
        <span>${project.tone || 'N/A'}</span>
      </div>
      <div class="overview-item">
        <strong>Era</strong>
        <span>${project.era || 'N/A'}</span>
      </div>
      <div class="overview-item">
        <strong>Technology Level</strong>
        <span>${project.tech_level || 'N/A'}</span>
      </div>
      <div class="overview-item overview-full">
        <strong>Themes</strong>
        <span>${project.themes && project.themes.length > 0 ? project.themes.join(', ') : 'None specified.'}</span>
      </div>
      <div class="overview-item overview-full">
        <strong>Current Core Conflict</strong>
        <span>${project.current_conflict || 'N/A'}</span>
      </div>
      <div class="overview-item overview-full">
        <strong>World Overview & Rules</strong>
        <span>${project.world_overview || 'N/A'}</span>
      </div>
      <div class="overview-item overview-full">
        <strong>Magic & Lore Mechanics</strong>
        <span>${project.magic_system || 'N/A'}</span>
      </div>
      <div class="overview-item overview-full">
        <strong>Creation Myth / Origin</strong>
        <span>${project.creation_myth || 'N/A'}</span>
      </div>
    </div>

    <!-- Section 2: Characters -->
    <div class="page-break"></div>
    <h2 class="section-title">Character Profiles</h2>
    ${charactersHtml.length > 0 ? charactersHtml : '<p>No character profiles added to this project.</p>'}

    <!-- Section 3: Scenes -->
    <div class="page-break"></div>
    <h2 class="section-title">Narrative Scene Beats</h2>
    <div style="margin-top: 20px;">
      ${scenesHtml.length > 0 ? scenesHtml : '<p>No scene beats mapped out for this project.</p>'}
    </div>

    <!-- Section 4: Storyboards -->
    <div class="page-break"></div>
    <h2 class="section-title">Storyboard Boards</h2>
    <div style="margin-top: 20px;">
      ${storyboardHtml.length > 0 ? storyboardHtml : '<p>No storyboards panels created for this project.</p>'}
    </div>

  </div>

</body>
</html>
  `;
}
