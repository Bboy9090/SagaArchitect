/**
 * pdf-export-service.ts
 *
 * Server-only module. Do NOT import from client components.
 *
 * Responsibilities:
 *  1. Load all project data from the DB (project, characters, scenes, panels, assets).
 *  2. Resolve storyboard panel asset files → base64 data URIs (embedded in HTML so
 *     Puppeteer never needs to make HTTP requests back to the server).
 *  3. Render the existing exportProjectToPrintableHtml() template.
 *  4. Launch Puppeteer-core with a locally detected Chrome/Edge browser.
 *  5. Return a PDF Buffer.
 */

import fs from 'fs';
import { db } from '@/db';
import {
  projects,
  characters as charactersTable,
  scenes as scenesTable,
  storyboardPanels as storyboardPanelsTable,
  assets as assetsTable,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readFileLocal } from '@/lib/storage-driver';
import { exportProjectToPrintableHtml } from '@/lib/pdf-exporter';
import type { Project, Character, Scene, StoryboardPanel } from '@/lib/types';

// ─── Browser Detection ────────────────────────────────────────────────────────

const BROWSER_CANDIDATES: string[] = [
  // Chrome – Windows typical install paths
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  // Edge – Windows typical install paths
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
];

function detectBrowserExecutable(): string | null {
  for (const candidate of BROWSER_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // existsSync can throw on permission errors — keep searching
    }
  }
  return null;
}

// ─── Asset Resolution ─────────────────────────────────────────────────────────

async function resolveAssetToDataUrl(filePath: string, mimeType: string): Promise<string> {
  try {
    const buf = await readFileLocal(filePath);
    const b64 = buf.toString('base64');
    return `data:${mimeType};base64,${b64}`;
  } catch (err) {
    console.warn('[pdf-export-service] Could not read asset file:', filePath, err);
    return ''; // caller will fall back to placeholder
  }
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function generateProjectPdf(projectId: string): Promise<Uint8Array> {
  if (!db) throw new Error('Database not initialized');

  // ── 1. Load project ──────────────────────────────────────────────────────
  const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!projectRow) throw new Error(`Project not found: ${projectId}`);

  // ── 2. Load associated data ──────────────────────────────────────────────
  const [characterRows, sceneRows, assetRows] = await Promise.all([
    db.select().from(charactersTable).where(eq(charactersTable.projectId, projectId)),
    db.select().from(scenesTable).where(eq(scenesTable.projectId, projectId)),
    db.select().from(assetsTable).where(eq(assetsTable.projectId, projectId)),
  ]);

  // Sort scenes by order
  sceneRows.sort((a, b) => a.order - b.order);

  // ── 3. Load storyboard panels for all scenes ─────────────────────────────
  const allPanelRows: (typeof storyboardPanelsTable.$inferSelect)[] = [];
  for (const scene of sceneRows) {
    const rows = await db
      .select()
      .from(storyboardPanelsTable)
      .where(eq(storyboardPanelsTable.sceneId, scene.id));
    rows.sort((a, b) => a.panelNumber - b.panelNumber);
    allPanelRows.push(...rows);
  }

  // Cap at 200 panels to keep PDF manageable
  const cappedPanels = allPanelRows.slice(0, 200);

  // ── 4. Build asset lookup map: assetId → data URI ────────────────────────
  const assetDataMap = new Map<string, string>();
  for (const asset of assetRows) {
    if (asset.filePath && asset.mimeType) {
      const dataUrl = await resolveAssetToDataUrl(asset.filePath, asset.mimeType);
      if (dataUrl) assetDataMap.set(asset.id, dataUrl);
    }
  }

  // ── 5. Map DB rows → typed objects for pdf-exporter ──────────────────────
  const project: Project = {
    id: projectRow.id,
    name: projectRow.name,
    concept: projectRow.concept || '',
    genre: projectRow.genre || '',
    tone: projectRow.tone || '',
    era: projectRow.era || '',
    tech_level: projectRow.techLevel || '',
    magic_system: projectRow.magicSystem || '',
    world_overview: projectRow.worldOverview || '',
    creation_myth: projectRow.creationMyth || '',
    themes: projectRow.themes || [],
    current_conflict: projectRow.currentConflict || '',
    prophecy_hooks: projectRow.prophecyHooks || [],
    created_at: projectRow.createdAt.toISOString(),
    updated_at: projectRow.updatedAt.toISOString(),
  };

  const characters: Character[] = characterRows.map((c) => ({
    id: c.id,
    universe_id: projectId,
    faction_id: c.factionId || undefined,
    name: c.name,
    title: c.title || '',
    role: c.role || '',
    motivations: c.motivations || '',
    fears: c.fears || '',
    powers: c.powers || '',
    weaknesses: c.weaknesses || '',
    relationships: (c.relationships as Character['relationships']) || [],
    arc_potential: c.arcPotential || '',
    status: (c.status as Character['status']) || 'alive',
    canon_status: (c.canonStatus as Character['canon_status']) || 'draft',
    appearance: c.appearance || undefined,
    speech_style: c.speechStyle || undefined,
  }));

  const scenes: Scene[] = sceneRows.map((s) => ({
    id: s.id,
    project_id: projectId,
    title: s.title,
    summary: s.summary || '',
    order: s.order,
    location_id: s.locationId || undefined,
    canon_status: (s.canonStatus as Scene['canon_status']) || 'draft',
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }));

  // Panels: pre-populate image_base64 from asset data URLs where available
  const storyboardPanels: StoryboardPanel[] = cappedPanels.map((p) => {
    const resolvedImage = p.assetId ? (assetDataMap.get(p.assetId) || '') : '';
    return {
      id: p.id,
      scene_id: p.sceneId,
      panel_number: p.panelNumber,
      visual_prompt: p.visualPrompt,
      action_description: p.actionDescription,
      dialogue: p.dialogue || undefined,
      camera_shot: p.cameraShot,
      // If a valid asset data URL was resolved, use it; otherwise fall back to stored base64
      image_base64: resolvedImage || undefined,
      asset_id: p.assetId || undefined,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    };
  });

  // ── 6. Render HTML ────────────────────────────────────────────────────────
  const html = exportProjectToPrintableHtml({ project, characters, scenes, storyboardPanels });

  // ── 7. Launch Puppeteer-core and render PDF ───────────────────────────────
  // Dynamic import is required: puppeteer-core is ESM-only and must not be
  // statically bundled by Turbopack. serverExternalPackages in next.config.ts
  // keeps it external; dynamic import() here satisfies the ESM constraint.
  const puppeteerModule = await import('puppeteer-core');
  const puppeteer = puppeteerModule.default ?? puppeteerModule;

  const executablePath = detectBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      'No local Chrome or Edge browser found. ' +
      'Please install Google Chrome or Microsoft Edge to enable server-side PDF export.'
    );
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set content — base64 data URIs are already embedded so no external requests needed
    await page.setContent(html, { timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-size:9px; font-family:monospace; color:#aaa; width:100%; text-align:center; padding:0 20px;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    });

    // Convert Node Buffer to Uint8Array for Response
    return new Uint8Array(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// ─── Filename Helper (exported for use in the route) ─────────────────────────

/**
 * Returns a safe PDF filename: "sanitized-project-name-YYYYMMDD.pdf"
 * Strips everything that isn't alphanumeric, space, or hyphen, then slugifies.
 */
export function buildPdfFilename(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60); // cap length

  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  return `${slug || 'project'}-${date}.pdf`;
}

