"use server";

import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/admin-guard";
import {
  generateWeeklyFacts,
  formatFactsMarkdown,
  formatFactsBrief
} from "@/lib/facts/weekly-facts-core.mjs";
import {
  generateWeeklyPreview,
  formatPreviewMarkdown,
  formatPreviewBrief
} from "@/lib/facts/weekly-preview-core.mjs";
import { execFile } from "child_process";
import util from "util";
import path from "path";
import fs from "fs";

const execFilePromise = util.promisify(execFile);

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

    const rawWeek = options?.week !== undefined ? Number(options.week) : 2;
    const rawSeason = options?.season !== undefined ? Number(options.season) : 2026;

    if (!Number.isInteger(rawWeek) || rawWeek < 1 || rawWeek > 25) {
      throw new Error("Invalid week number.");
    }
    if (!Number.isInteger(rawSeason) || rawSeason < 1980 || rawSeason > 2100) {
      throw new Error("Invalid season year.");
    }

    const week = rawWeek;
    const season = rawSeason;
    const filename = `BUCS_${season}_Week_${week}_Insights.pdf`;
    const reportsDir = path.resolve(process.cwd(), "public/reports");
    const outputPath = path.resolve(reportsDir, filename);

    if (!outputPath.startsWith(reportsDir + path.sep)) {
      throw new Error("Invalid output file path.");
    }

    // Make sure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const scriptPath = path.resolve(process.cwd(), "scripts/generate_weekly_pdf.mjs");
    await execFilePromise(
      process.execPath,
      [
        scriptPath,
        "--week",
        String(week),
        "--season",
        String(season),
        "--output",
        outputPath,
      ],
      { cwd: process.cwd() }
    );

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

export async function fetchWeeklyPreviewAction(options: {
  week?: number;
  season?: number;
}) {
  try {
    await assertPermission("facts");

    const supabase = getAdminClient();
    const preview = await generateWeeklyPreview(supabase, {
      week: options.week,
      season: options.season
    });

    const markdown = formatPreviewMarkdown(preview);
    const brief = formatPreviewBrief(preview);

    return {
      success: true,
      preview,
      markdown,
      brief
    };
  } catch (err: any) {
    console.error("fetchWeeklyPreviewAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to generate weekly preview."
    };
  }
}

export async function generateWeeklyPreviewPdfAction(options: {
  week?: number;
  season?: number;
}) {
  try {
    await assertPermission("facts");

    const rawWeek = options?.week !== undefined ? Number(options.week) : 3;
    const rawSeason = options?.season !== undefined ? Number(options.season) : 2026;

    if (!Number.isInteger(rawWeek) || rawWeek < 1 || rawWeek > 25) {
      throw new Error("Invalid week number.");
    }
    if (!Number.isInteger(rawSeason) || rawSeason < 1980 || rawSeason > 2100) {
      throw new Error("Invalid season year.");
    }

    const week = rawWeek;
    const season = rawSeason;
    const filename = `BUCS_${season}_Week_${week}_Preview.pdf`;
    const reportsDir = path.resolve(process.cwd(), "public/reports");
    const outputPath = path.resolve(reportsDir, filename);

    if (!outputPath.startsWith(reportsDir + path.sep)) {
      throw new Error("Invalid output file path.");
    }

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const scriptPath = path.resolve(process.cwd(), "scripts/generate_weekly_preview_pdf.mjs");
    await execFilePromise(
      process.execPath,
      [
        scriptPath,
        "--week",
        String(week),
        "--season",
        String(season),
        "--output",
        outputPath,
      ],
      { cwd: process.cwd() }
    );

    return {
      success: true,
      filename,
      pdfUrl: `/reports/${filename}`
    };
  } catch (err: any) {
    console.error("generateWeeklyPreviewPdfAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to generate weekly preview PDF report."
    };
  }
}
