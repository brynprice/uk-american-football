import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(stealthPlugin());

async function main() {
    const targetYear = process.argv[2] || "2026";
    console.log(`Launching browser... Target Year set to: ${targetYear}`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log("Navigating to League Republic Match Hub...");
    await page.goto('https://bafanle.leaguerepublic.com/indexMatchHub.html', { waitUntil: 'networkidle', timeout: 60000 });

    console.log("Waiting for main content to render...");
    await page.waitForTimeout(5000);
    
    // Accept cookies if present
    try {
        const cookieButton = page.locator('button:has-text("Accept")');
        if (await cookieButton.count() > 0) {
            await cookieButton.first().click();
        }
    } catch (e) {}

    // Handle Season Selection
    const dropdownSelector = 'select[name="leaguePageContent.imhpc.filterOuterSeasonID"]';
    
    const targetValue = await page.evaluate((params) => {
        const select = document.querySelector(params.selector);
        if (!select) return null;
        
        const option = Array.from(select.options).find(o => o.text.includes(params.year));
        return option ? option.value : null;
    }, { selector: dropdownSelector, year: targetYear });

    if (targetValue) {
        console.log(`Found dropdown option for year ${targetYear}. Selecting it...`);
        // The selection usually triggers a form submit and page reload on League Republic
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(e => {}),
            page.selectOption(dropdownSelector, targetValue)
        ]);
        await page.waitForTimeout(5000); // Wait for dynamic content to render
    } else {
        console.log(`Warning: Could not find season dropdown option containing year ${targetYear}. Scraping default season.`);
    }

    const dates = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('.matchhub-day-button'));
        return buttons.map(b => b.value).filter(Boolean);
    });

    console.log(`Found ${dates.length} dates to scrape.`);

    let allMatches = [];

    for (let i = 0; i < dates.length; i++) {
        const dateVal = dates[i];
        console.log(`Scraping date: ${dateVal} (${i+1}/${dates.length})...`);
        
        // Find the button and click it
        // We use evaluate to click to avoid visibility issues with carousels
        await page.evaluate((val) => {
            const btn = document.querySelector(`.matchhub-day-button[value="${val}"]`);
            if (btn) btn.click();
        }, dateVal);

        // Wait for table to update
        await page.waitForTimeout(3000); // Simple wait, robust enough for a quick script

        const matchesOnDate = await page.evaluate((currentDateVal) => {
            const dateStrMatch = currentDateVal.match(/year(\d+)_month(\d+)_day(\d+)/);
            const formattedDate = dateStrMatch ? `${dateStrMatch[1]}-${dateStrMatch[2]}-${dateStrMatch[3]}` : currentDateVal;
            
            const rows = Array.from(document.querySelectorAll('.match-list-container table tr'));
            
            let currentCompetition = "";
            let currentTime = "";
            const extracted = [];

            for (const row of rows) {
                const compHeading = row.querySelector('.fg-heading');
                if (compHeading) {
                    currentCompetition = compHeading.innerText.trim();
                    continue;
                }

                const timeHeading = row.querySelector('.time-heading');
                if (timeHeading) {
                    currentTime = timeHeading.innerText.trim();
                    continue;
                }

                if (row.hasAttribute('data-match-href')) {
                    const homeTeamEl = row.querySelector('td.right.wrap a');
                    const awayTeamEl = row.querySelector('td.left.wrap a');
                    const detailsEl = row.querySelector('td.match-details');
                    
                    const homeTeam = homeTeamEl ? homeTeamEl.innerText.trim() : "";
                    const awayTeam = awayTeamEl ? awayTeamEl.innerText.trim() : "";
                    let venue = detailsEl ? detailsEl.innerText.trim() : "";
                    if (venue.startsWith("@ @ ")) {
                        venue = venue.substring(4);
                    }

                    // Extract score or VS
                    const middleCol = row.querySelector('td:nth-child(2)');
                    let scoreRaw = middleCol ? middleCol.innerText.trim() : "VS";
                    
                    let homeScore = "";
                    let awayScore = "";
                    if (scoreRaw.includes(" - ")) {
                        const parts = scoreRaw.split(" - ");
                        homeScore = parts[0].trim();
                        awayScore = parts[1].trim();
                    }

                    extracted.push({
                        Date: formattedDate,
                        Time: currentTime,
                        Phase: currentCompetition,
                        HomeTeam: homeTeam,
                        HomeScore: homeScore,
                        AwayScore: awayScore,
                        AwayTeam: awayTeam,
                        Venue: venue
                    });
                }
            }
            return extracted;
        }, dateVal);

        allMatches = allMatches.concat(matchesOnDate);
    }

    console.log(`Extracted ${allMatches.length} total matches.`);

    // Write to CSV
    if (allMatches.length > 0) {
        const headers = ["competition", "year", "phase", "date", "time", "home_team", "home_score", "away_score", "away_team", "venue"];
        const csvRows = [headers.join(",")];
        
        for (const m of allMatches) {
            const row = [
                `"BAFA National Leagues"`,
                `"${targetYear}"`,
                `"${m.Phase}"`,
                m.Date,
                m.Time,
                `"${m.HomeTeam}"`,
                `"${m.HomeScore}"`,
                `"${m.AwayScore}"`,
                `"${m.AwayTeam}"`,
                `"${m.Venue}"`
            ];
            csvRows.push(row.join(","));
        }

        fs.writeFileSync('league_republic_matches.csv', csvRows.join("\n"));
        console.log("Saved to league_republic_matches.csv");
    }

    await browser.close();
}

main().catch(console.error);
