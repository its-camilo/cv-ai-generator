import { expect, test } from '@playwright/test';

test.describe('CV layout — Globant AI Lead (EN)', () => {
  test('no overflow dentro de la página carta', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/e2e/cv-layout?e2e=layout');
    await page.waitForSelector('.cv-doc');

    await page.waitForFunction(() => {
      const doc = document.querySelector('.cv-doc') as HTMLElement | null;
      if (!doc) return false;
      const style = getComputedStyle(doc);
      const pt = Number.parseFloat(style.paddingTop) || 0;
      const pb = Number.parseFloat(style.paddingBottom) || 0;
      const inner = doc.clientHeight - pt - pb;
      const sheet = document.querySelector('.cv-doc__sheet') as HTMLElement | null;
      return !!sheet && sheet.scrollHeight <= inner + 1;
    });

    const metrics = await page.evaluate(() => {
      const doc = document.querySelector('.cv-doc') as HTMLElement;
      const sheet = document.querySelector('.cv-doc__sheet') as HTMLElement;
      const style = getComputedStyle(doc);
      const paddingTop = Number.parseFloat(style.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(style.paddingRight) || 0;
      const innerHeight = doc.clientHeight - paddingTop - paddingBottom;

      return {
        overflows: sheet.scrollHeight > innerHeight + 1,
        innerHeight,
        contentHeight: sheet.scrollHeight,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
        marginsEqual:
          Math.abs(paddingTop - paddingLeft) < 2 &&
          Math.abs(paddingBottom - paddingRight) < 2 &&
          Math.abs(paddingLeft - paddingRight) < 2,
      };
    });

    expect(metrics.overflows, `content ${metrics.contentHeight}px > inner ${metrics.innerHeight}px`).toBe(
      false,
    );
    expect(metrics.marginsEqual).toBe(true);
    expect(metrics.contentHeight).toBeGreaterThan(metrics.innerHeight * 0.85);
  });

  test('texto de habilidades visible dentro del documento', async ({ page }) => {
    await page.goto('/e2e/cv-layout?e2e=layout');
    await page.waitForSelector('.cv-doc__skill-line');

    const skillsInsidePage = await page.evaluate(() => {
      const doc = document.querySelector('.cv-doc') as HTMLElement;
      const docRect = doc.getBoundingClientRect();
      const lines = [...document.querySelectorAll('.cv-doc__skill-line')];
      return lines.every((line) => {
        const rect = line.getBoundingClientRect();
        return rect.bottom <= docRect.bottom + 1 && rect.top >= docRect.top - 1;
      });
    });

    expect(skillsInsidePage).toBe(true);
    await expect(page.locator('.cv-doc__section-title', { hasText: 'SKILLS' })).toBeVisible();
  });

  test('mobile mantiene proporción carta y tipografía sin comprimir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/e2e/cv-layout?e2e=layout');
    await page.waitForSelector('.cv-doc');

    await page.waitForFunction(() => {
      const wrap = document.querySelector('.cv-preview__paper-wrap') as HTMLElement | null;
      const scale = wrap?.querySelector('.cv-preview__paper-scaler') as HTMLElement | null;
      return !!scale && Number.parseFloat(getComputedStyle(scale).getPropertyValue('--paper-scale')) > 0;
    });

    const metrics = await page.evaluate(() => {
      const doc = document.querySelector('.cv-doc') as HTMLElement;
      const style = getComputedStyle(doc);
      const rect = doc.getBoundingClientRect();
      const scaler = document.querySelector('.cv-preview__paper-scaler') as HTMLElement;
      const scale = Number.parseFloat(getComputedStyle(scaler).getPropertyValue('--paper-scale')) || 1;
      const sheet = document.querySelector('.cv-doc__sheet') as HTMLElement;
      const inner = doc.clientHeight - (Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom));

      return {
        fontSizePx: Number.parseFloat(style.fontSize),
        layoutWidthPx: doc.clientWidth,
        visualWidthPx: rect.width,
        visualHeightPx: rect.height,
        aspectRatio: rect.width / rect.height,
        scale,
        overflows: (sheet?.scrollHeight ?? 0) > inner + 1,
      };
    });

    expect(metrics.fontSizePx).toBeGreaterThan(12.5);
    expect(metrics.layoutWidthPx).toBeGreaterThan(800);
    expect(metrics.aspectRatio).toBeCloseTo(8.5 / 11, 2);
    expect(metrics.scale).toBeLessThan(1);
    expect(metrics.scale).toBeGreaterThan(0.4);
    expect(metrics.visualWidthPx).toBeLessThanOrEqual(392);
    expect(metrics.overflows).toBe(false);
  });
});
