import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertPermission, UnauthorizedError } from '@/lib/auth/admin-guard';
import {
  generateWeeklyFacts,
  formatFactsMarkdown,
  formatFactsBrief
} from '@/lib/facts/weekly-facts-core.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    await assertPermission('facts');

    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    const seasonParam = searchParams.get('season');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const format = searchParams.get('format') || 'json';
    const pastWeekParam = searchParams.get('past_week');

    const isPastWeek = pastWeekParam === 'true' || pastWeekParam === '1' || (!weekParam && !startParam && !endParam);

    const options = {
      week: weekParam ? parseInt(weekParam, 10) : undefined,
      season: seasonParam ? parseInt(seasonParam, 10) : undefined,
      startDate: startParam || undefined,
      endDate: endParam || undefined,
      pastWeek: isPastWeek
    };

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
      { error: error?.message || 'Failed to generate weekly facts' },
      { status: 500 }
    );
  }
}
