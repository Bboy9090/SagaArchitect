import type { PhoenixMediaDocument, PhoenixMediaLayer } from './media-composition';
import { renderPhoenixMediaDocument } from './media-renderer';
import type { StoryboardPanel } from './types';

export interface ComicMotionPanelRender {
  panel: StoryboardPanel;
  blob: Blob;
  filename: string;
  pageKind: string;
  panelId: string;
}

function isPanelFrame(layer: PhoenixMediaLayer): boolean {
  return layer.type === 'shape' && layer.name.startsWith('Panel ') && Boolean(layer.panelId);
}

function panelDialogue(page: PhoenixMediaDocument, panelId: string): string {
  return page.layers
    .filter(layer => layer.panelId === panelId && layer.type === 'text' && layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(layer => layer.type === 'text' ? layer.text.trim() : '')
    .filter(Boolean)
    .join(' ');
}

function inferredCameraShot(layer: PhoenixMediaLayer): string {
  const ratio = layer.transform.width / Math.max(1, layer.transform.height);
  if (ratio >= 1.45) return 'wide';
  if (ratio <= 0.72) return 'close';
  return 'medium';
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'comic';
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Failed to encode comic panel for Motion Comic handoff.')),
      'image/jpeg',
      quality,
    );
  });
}

export async function renderComicIssueForMotion(
  pages: PhoenixMediaDocument[],
  options?: { maxPanels?: number; maxDimension?: number; quality?: number },
): Promise<ComicMotionPanelRender[]> {
  const orderedPages = [...pages].sort((a, b) =>
    (a.pageOrder ?? Number.MAX_SAFE_INTEGER) - (b.pageOrder ?? Number.MAX_SAFE_INTEGER)
    || a.createdAt.localeCompare(b.createdAt)
  );
  const maxPanels = Math.max(1, options?.maxPanels ?? 120);
  const maxDimension = Math.max(320, options?.maxDimension ?? 1600);
  const quality = Math.max(0.5, Math.min(0.95, options?.quality ?? 0.88));
  const output: ComicMotionPanelRender[] = [];
  let globalPanel = 0;

  for (let pageIndex = 0; pageIndex < orderedPages.length; pageIndex += 1) {
    const page = orderedPages[pageIndex];
    const frames = page.layers
      .filter(isPanelFrame)
      .sort((a, b) => {
        const row = a.transform.y - b.transform.y;
        return Math.abs(row) > Math.max(20, Math.min(a.transform.height, b.transform.height) * 0.25)
          ? row
          : a.transform.x - b.transform.x;
      });
    if (output.length + frames.length > maxPanels) {
      throw new Error(`Comic issue exceeds the ${maxPanels}-panel Motion Comic handoff limit.`);
    }
    if (frames.length === 0) continue;

    const pageCanvas = await renderPhoenixMediaDocument(page);
    for (let panelIndex = 0; panelIndex < frames.length; panelIndex += 1) {
      const frame = frames[panelIndex];
      const { x, y, width, height } = frame.transform;
      const sourceWidth = Math.max(1, Math.min(pageCanvas.width - Math.max(0, Math.floor(x)), Math.round(width)));
      const sourceHeight = Math.max(1, Math.min(pageCanvas.height - Math.max(0, Math.floor(y)), Math.round(height)));
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
      const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
      const crop = document.createElement('canvas');
      crop.width = targetWidth;
      crop.height = targetHeight;
      const ctx = crop.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering is unavailable for comic motion handoff.');
      ctx.drawImage(
        pageCanvas,
        Math.max(0, Math.round(x)),
        Math.max(0, Math.round(y)),
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      );
      const blob = await canvasToJpeg(crop, quality);
      globalPanel += 1;
      const panelId = frame.panelId || frame.id;
      const dialogue = panelDialogue(page, panelId);
      const filename = `${safePart(page.title || `page-${pageIndex + 1}`)}-panel-${String(panelIndex + 1).padStart(2, '0')}.jpg`;
      output.push({
        blob,
        filename,
        pageKind: page.kind,
        panelId,
        panel: {
          id: `comic:${page.kind}:${panelId}`,
          scene_id: `comic:${page.kind}`,
          panel_number: globalPanel,
          visual_prompt: `${page.title || `Page ${pageIndex + 1}`} · ${frame.name || `Panel ${panelIndex + 1}`}`,
          action_description: `${page.title || `Page ${pageIndex + 1}`} · ${frame.name || `Panel ${panelIndex + 1}`}`,
          dialogue: dialogue || undefined,
          camera_shot: inferredCameraShot(frame),
        },
      });
    }
  }

  if (output.length === 0) {
    throw new Error('No linked comic panel frames were found. Apply a Comic page template before sending the issue to Motion Comic Studio.');
  }
  return output;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Failed to read comic panel image.'));
    reader.onerror = () => reject(new Error('Failed to read comic panel image.'));
    reader.readAsDataURL(blob);
  });
}
