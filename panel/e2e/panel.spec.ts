import { expect, test } from '@playwright/test';

test('renders the authenticated operational workspace without overflow', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page).toHaveTitle('DTA Admin');
  await expect(page.getByRole('heading', { name: /vis.o geral/i })).toBeVisible();
  await expect(page.locator('nav:visible').first()).toBeVisible();

  const logo = page.locator('img:visible').first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);

  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
});

test('keeps primary navigation usable on a mobile viewport', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) > 720, 'Mobile-only behavior.');
  await page.goto('/confrontos');

  await expect(page.getByRole('heading', { name: /confrontos/i })).toBeVisible();
  const navigation = page.locator('.mobile-navigation');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByText('Confrontos', { exact: true })).toBeVisible();

  const boxes = await navigation.locator('a, button').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(boxes.every(box => box.width >= 40 && box.height >= 40)).toBe(true);

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);

  await page.screenshot({ path: testInfo.outputPath('confrontations-mobile.png'), fullPage: true });
});
