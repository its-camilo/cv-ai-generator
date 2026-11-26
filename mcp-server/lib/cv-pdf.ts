import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function htmlToPdfBuffer(html: string): Promise<Uint8Array> {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 816, height: 1056 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}