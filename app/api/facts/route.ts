import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertPermission, UnauthorizedError } from '@/lib/auth/admin-guard';
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    await assertPermission('facts');

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || (searchParams.get('preview') === 'true' ? 'preview' : 'recap');
    const weekParam = searchParams.get('week');
    const seasonParam = searchParams.get('season');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const format = searchParams.get('format') || 'json';
    const pastWeekParam = searchParams.get('past_week');
    const upcomingWeekParam = searchParams.get('upcoming_week');

    const isPastWeek = pastWeekParam === 'true' || pastWeekParam === '1' || (!weekParam && !startParam && !endParam && mode === 'recap');
    const isUpcomingWeek = upcomingWeekParam === 'true' || upcomingWeekParam === '1' || (!weekParam && !startParam && !endParam && mode === 'preview');

    const options = {
      week: weekParam ? parseInt(weekParam, 10) : undefined,
      season: seasonParam ? parseInt(seasonParam, 10) : undefined,
      startDate: startParam || undefined,
      endDate: endParam || undefined,
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
    return NextResponse.json(
      { error: error?.message || 'Failed to generate weekly intelligence' },
      { status: 500 }
    );
  }
}
