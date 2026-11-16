import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertPermission, UnauthorizedError } from '@/lib/auth/admin-guard';
import { isValidIsoDate } from '@/lib/utils/validation';
import {
  generateWeeklyFacts,
  formatFactsMarkdown,
  formatFactsBrief
} from '@/lib/facts/weekly-facts-core.mjs';
import {
  generateWeeklyPreview,
  formatPreviewMarkdown,
  formatPreviewBrief
} from '@/lib/facts/weekly-preview-core.mjs';

const VALID_MODES = new Set(['recap', 'preview']);
const VALID_FORMATS = new Set(['json', 'markdown', 'brief']);

function parseStrictIntParam(val: string, label: string, min: number, max: number): number {
  if (!/^\d+$/.test(val.trim())) {
    throw new RangeError(`Invalid ${label}.`);
  }
  const parsed = Number(val.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`Invalid ${label}.`);
  }
  return parsed;
}

function getFactsClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    await assertPermission('facts');
    const supabase = getFactsClient();

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || (searchParams.get('preview') === 'true' ? 'preview' : 'recap');
    const weekParam = searchParams.get('week');
    const seasonParam = searchParams.get('season');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const format = searchParams.get('format') || 'json';
    const pastWeekParam = searchParams.get('past_week');
    const upcomingWeekParam = searchParams.get('upcoming_week');

    if (!VALID_MODES.has(mode)) {
      return NextResponse.json({ error: 'Invalid mode parameter.' }, { status: 400 });
    }
    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json({ error: 'Invalid format parameter.' }, { status: 400 });
    }

    if ((startParam && !endParam) || (!startParam && endParam)) {
      return NextResponse.json({ error: 'Both start and end dates are required.' }, { status: 400 });
    }
    if (startParam && endParam) {
      if (!isValidIsoDate(startParam) || !isValidIsoDate(endParam) || startParam.trim() > endParam.trim()) {
        return NextResponse.json({ error: 'Invalid start or end date range.' }, { status: 400 });
      }
    }

    const isPastWeek = pastWeekParam === 'true' || pastWeekParam === '1' || (!weekParam && !startParam && !endParam && mode === 'recap');
    const isUpcomingWeek = upcomingWeekParam === 'true' || upcomingWeekParam === '1' || (!weekParam && !startParam && !endParam && mode === 'preview');

    const options = {
      week: weekParam ? parseStrictIntParam(weekParam, 'week', 1, 25) : undefined,
      season: seasonParam ? parseStrictIntParam(seasonParam, 'season', 1980, 2100) : undefined,
      startDate: startParam?.trim() || undefined,
      endDate: endParam?.trim() || undefined,
      pastWeek: isPastWeek,
      upcomingWeek: isUpcomingWeek
    };

    if (mode === 'preview') {
      const preview = await generateWeeklyPreview(supabase, options);

      if (format === 'markdown') {
        const markdown = formatPreviewMarkdown(preview);
        return new NextResponse(markdown, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
        });
      }

      if (format === 'brief') {
        const brief = formatPreviewBrief(preview);
        return NextResponse.json({ brief, preview });
      }

      return NextResponse.json(preview);
    }

    const facts = await generateWeeklyFacts(supabase, options);

    if (format === 'markdown') {
      const markdown = formatFactsMarkdown(facts);
      return new NextResponse(markdown, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
      });
    }

    if (format === 'brief') {
      const brief = formatFactsBrief(facts);
      return NextResponse.json({ brief, facts });
    }

    return NextResponse.json(facts);
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.startsWith('Forbidden') ? 403 : 401 }
      );
    }
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('/api/facts error:', error);
    return NextResponse.json(
      { error: 'Failed to generate weekly intelligence' },
      { status: 500 }
    );
  }
}
