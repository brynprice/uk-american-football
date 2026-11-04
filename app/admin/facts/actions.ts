"use server";

import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/admin-guard";
import {
  generateWeeklyFacts,
  formatFactsMarkdown,
  formatFactsBrief
} from "@/lib/facts/weekly-facts-core.mjs";
import { exec } from "child_process";
import util from "util";
import path from "path";
import fs from "fs";

const execPromise = util.promisify(exec);

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function fetchWeeklyFactsAction(options: {
  week?: number;
  season?: number;
  pastWeek?: boolean;
}) {
  try {
    await assertPermission("facts");

    const supabase = getAdminClient();
    const facts = await generateWeeklyFacts(supabase, {
      week: options.week,
      season: options.season,
      pastWeek: options.pastWeek
    });

    const markdown = formatFactsMarkdown(facts);
    const brief = formatFactsBrief(facts);

    return {
      success: true,
      facts,
      markdown,
      brief
    };
  } catch (err: any) {
    console.error("fetchWeeklyFactsAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to generate weekly facts."
    };
  }
}

export async function generateWeeklyPdfAction(options: {
  week?: number;
  season?: number;
}) {
  try {
    await assertPermission("facts");

    const week = options.week || 2;
    const season = options.season || 2026;
    const filename = `BUCS_${season}_Week_${week}_Insights.pdf`;
    const outputPath = path.resolve(process.cwd(), "public/reports", filename);

    // Make sure reports directory exists
    const reportsDir = path.dirname(outputPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const cmd = `node scripts/generate_weekly_pdf.mjs --week ${week} --season ${season} --output "${outputPath}"`;
    await execPromise(cmd, { cwd: process.cwd() });

    return {
      success: true,
      filename,
      pdfUrl: `/reports/${filename}`
    };
  } catch (err: any) {
    console.error("generateWeeklyPdfAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to generate weekly PDF report."
    };
  }
}
