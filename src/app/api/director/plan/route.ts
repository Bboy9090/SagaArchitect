import { NextRequest, NextResponse } from 'next/server';
import { getAiProvider, hasConfiguredAiProvider } from '@/lib/ai-provider';
import {
  aiProviderFailureResponse,
  isProductionLikeGenerationEnvironment,
  mockGenerationResponse,
} from '@/lib/ai-generation-policy';
import { buildCanonBlock, formatCanonBlockAsPrompt } from '@/lib/lore-engine';
import { normalizeDirectorPlan } from '@/lib/phoenix-director';
import type { CanonBlockInput } from '@/lib/lore-engine';

function mockPlan(projectName: string, brief: string) {
  return normalizeDirectorPlan({
    project_summary: `${projectName}: ${brief || 'Cross-studio production plan'}`,
    creative_strategy: 'Development-mode placeholder plan. Configure a live AI provider for production planning.',
    risks: ['Live AI provider is not configured.'],
    actions: [
      {
        id: 'action-1',
        studio: 'write',
        title: 'Define the production brief',
        objective: brief || 'Clarify the creative objective before production.',
        instructions: ['Confirm the deliverable, audience, tone, and success criteria.'],
        canon_refs: [],
        depends_on: [],
        priority: 'high',
        completion_signal: 'A concrete creative brief exists.',
      },
    ],
  });
}

function buildDirectorPrompt(canonContext: string, brief: string, targetStudios: string[]): string {
  const studioScope = targetStudios.length
    ? targetStudios.join(', ')
    : 'write, book, design, image, illustrate, comic, storyboard, video, motion, audio, publish';

  return `${canonContext}

You are Phoenix AI Director, the production director for a unified creative suite.
The user has requested this production outcome:

${brief}

Available studios for this plan:
${studioScope}

Build a practical, commercially competitive production plan that uses the project canon above.
Do not invent facts that contradict canon. Do not claim files, renders, edits, or exports already exist.
Do not recommend a studio outside the available set.

Return ONLY valid JSON with this structure:
{
  "project_summary": "short factual summary",
  "creative_strategy": "clear production strategy",
  "risks": ["specific production/canon risks"],
  "actions": [
    {
      "id": "stable-short-id",
      "studio": "write|book|design|image|illustrate|comic|storyboard|video|motion|audio|publish",
      "title": "action title",
      "objective": "why this action exists",
      "instructions": ["concrete step", "concrete step"],
      "canon_refs": ["specific canon facts/names this action must preserve"],
      "depends_on": ["ids of prerequisite actions"],
      "priority": "critical|high|medium|low",
      "completion_signal": "objective evidence that proves this action is complete"
    }
  ]
}

Prefer executable production actions over vague advice.
Use dependencies to create a coherent pipeline from source material to final deliverables.
Keep the plan to at most 18 actions.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<CanonBlockInput> & {
      brief?: unknown;
      targetStudios?: unknown;
    };

    if (!body.universe) {
      return NextResponse.json({ ok: false, error: 'universe is required' }, { status: 400 });
    }

    const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, 6000) : '';
    if (!brief) {
      return NextResponse.json({ ok: false, error: 'brief is required' }, { status: 400 });
    }

    const allowedStudios = new Set(['write','book','design','image','illustrate','comic','storyboard','video','motion','audio','publish']);
    const targetStudios = Array.isArray(body.targetStudios)
      ? body.targetStudios.filter((value): value is string => typeof value === 'string' && allowedStudios.has(value)).slice(0, 11)
      : [];

    if (!hasConfiguredAiProvider()) {
      return mockGenerationResponse({
        ok: true,
        plan: mockPlan(body.universe.name, brief),
      });
    }

    const canonBlock = buildCanonBlock(body as CanonBlockInput);
    const canonContext = formatCanonBlockAsPrompt(canonBlock);
    const { client, model } = getAiProvider();

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildDirectorPrompt(canonContext, brief, targetStudios) }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return isProductionLikeGenerationEnvironment()
        ? aiProviderFailureResponse('empty_response')
        : mockGenerationResponse({ ok: true, plan: mockPlan(body.universe.name, brief) });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return isProductionLikeGenerationEnvironment()
        ? aiProviderFailureResponse('malformed_response')
        : mockGenerationResponse({ ok: true, plan: mockPlan(body.universe.name, brief) });
    }

    const plan = normalizeDirectorPlan(parsed);
    return NextResponse.json(
      { ok: true, plan },
      { headers: { 'cache-control': 'no-store', 'x-phoenix-generation-mode': 'live' } },
    );
  } catch (error) {
    console.error('Phoenix Director error:', error);
    return isProductionLikeGenerationEnvironment()
      ? aiProviderFailureResponse('provider_error')
      : NextResponse.json(
          { ok: false, error: error instanceof Error ? error.message : 'Director planning failed.' },
          { status: 500, headers: { 'cache-control': 'no-store' } },
        );
  }
}
