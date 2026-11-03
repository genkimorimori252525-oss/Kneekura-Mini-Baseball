import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = pathToFileURL(join(process.cwd(), 'dist/native-tbd-lad-offline.html')).href;
const errors = [];
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-first-run'] });
try {
  for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    const ready = await page.evaluate(() => ({
      globalSource: !!window.KneekuraNativeMatchCore?.createNativeSinglePaSession,
      probeReady: !!window.nativePitchProof,
      initial: window.nativePitchProof?.inspect(),
    }));
    if (!ready.globalSource || !ready.probeReady || ready.initial?.pitches !== 0) {
      throw new Error('Browser could not load actual Native source: ' + JSON.stringify(ready));
    }
    await page.locator('#issue').click();
    await page.waitForFunction(() => window.nativePitchProof?.inspect()?.pitches === 1
      && window.nativePitchProof?.inspect()?.running === false, { timeout: 15000 });
    const first = await page.evaluate(() => window.nativePitchProof.inspect());
    if (first.source !== 'NATIVE_CORE_PHYSICAL_PITCH' || first.samples < 5
      || !first.acceptedEvents.includes('PitchAdjudicated')) {
      throw new Error('Native physical first pitch failed: ' + JSON.stringify(first));
    }
    await page.locator('#zone').selectOption('inside');
    await page.locator('#issue').click();
    await page.waitForFunction(() => window.nativePitchProof?.inspect()?.pitches === 2
      && window.nativePitchProof?.inspect()?.running === false, { timeout: 15000 });
    const second = await page.evaluate(() => window.nativePitchProof.inspect());
    if (second.source !== 'NATIVE_CORE_PHYSICAL_PITCH' || second.samples < 5) {
      throw new Error('Native next-pitch issuance failed: ' + JSON.stringify(second));
    }
    const screenshotPath = join(process.cwd(), 'dist', 'native-proof-' + viewport.width + 'px.png');
    await mkdir(join(process.cwd(), 'dist'), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(JSON.stringify({ viewport: viewport.width, result: 'PASS',
      firstEvents: first.acceptedEvents, secondEvents: second.acceptedEvents,
      afterTwoPitches: second, screenshotPath }));
    await page.close();
  }
  if (errors.length) throw new Error('Browser JS exceptions: ' + errors.join('; '));
  console.log('NATIVE_BROWSER_DESKTOP_AND_MOBILE_VIEWPORT_PASS; pageErrors=0');
} finally {
  await browser.close();
}
