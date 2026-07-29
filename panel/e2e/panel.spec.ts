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
    page: document.body.scrollWidth,
    rootOverflow: getComputedStyle(document.documentElement).overflowX,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.rootOverflow).toBe('hidden');

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
    page: document.body.scrollWidth,
    rootOverflow: getComputedStyle(document.documentElement).overflowX,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.rootOverflow).toBe('hidden');

  await page.screenshot({ path: testInfo.outputPath('confrontations-mobile.png'), fullPage: true });
});

test('executes the safe administration controls', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 720, 'Desktop administration flow.');
  await page.goto('/comandos');

  const firstCommand = page.locator('tbody tr').first();
  await firstCommand.getByRole('checkbox').click();
  await expect(page.getByText(/atualizado neste servidor/i)).toBeVisible();

  await page.goto('/confrontos');
  await page.getByRole('button', { name: /novo confronto/i }).click();
  const dialog = page.getByRole('dialog', { name: /criar confronto/i });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('create-confrontation.png'), fullPage: true });
  await dialog.getByLabel('Pool').selectOption({ index: 1 });
  await dialog.getByLabel('Time A').selectOption({ index: 1 });
  await dialog.getByLabel('Time B').selectOption({ index: 2 });
  await dialog.getByLabel('Canal do confronto').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: /criar e iniciar/i }).click();
  await expect(page.getByText(/pick\/ban iniciado/i)).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('keeps administration dialogs inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) > 720, 'Mobile administration flow.');
  await page.goto('/pools');
  await page.getByRole('button', { name: /criar pool/i }).click();
  const dialog = page.getByRole('dialog', { name: /criar pool/i });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('create-pool-mobile.png'), fullPage: true });
});
