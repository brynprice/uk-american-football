/**
 * Escapes HTML special characters to prevent markup/script injection
 * when rendering database fields into Playwright HTML templates.
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Configures a Playwright browser context for offline/static PDF rendering
 * so untrusted or unexpected content cannot execute scripts or make outbound HTTP requests.
 */
export async function createIsolatedPdfPage(browser) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    offline: true,
  });
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url === 'about:blank') {
      return route.continue();
    }
    return route.abort();
  });
  return { context, page };
}
