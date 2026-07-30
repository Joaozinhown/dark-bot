import { expect, test } from '@playwright/test';

test('renders the authenticated operational workspace without overflow', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page).toHaveTitle('DTA Admin');
  await expect(page.getByRole('heading', { name: /vis.o geral/i })).toBeVisible();
  await expect(page.locator('nav:visible').first()).toBeVisible();

  const logo = page.locator('img:visible').first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/dta-symbol.png');
  await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const brandName = page.getByText('Dark Trials Arena', { exact: true }).first();
  if ((page.viewportSize()?.width ?? 0) > 1100) await expect(brandName).toBeVisible();
  else await expect(brandName).toBeHidden();

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.body.scrollWidth,
    rootOverflow: getComputedStyle(document.documentElement).overflowX,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.rootOverflow).toBe('hidden');

  if ((page.viewportSize()?.width ?? 0) <= 720) {
    await expect(page.locator('.overview-active-mobile')).toBeVisible();
    await expect(page.locator('.overview-pools-mobile')).toBeVisible();
    await expect(page.locator('.overview-active-table')).toBeHidden();
    await expect(page.locator('.overview-pools-table')).toBeHidden();
  }

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
  expect(boxes.every(box => box.width >= 44 && box.height >= 44)).toBe(true);

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.body.scrollWidth,
    rootOverflow: getComputedStyle(document.documentElement).overflowX,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.rootOverflow).toBe('hidden');

  await page.screenshot({ path: testInfo.outputPath('confrontations-mobile.png'), fullPage: true });
});

test('uses readable mobile records for every data-heavy administration page', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 720, 'Mobile-only behavior.');
  const routes = [
    { path: '/equipes', mobile: '.teams-mobile-list', desktop: '.teams-table' },
    { path: '/comandos', mobile: '.commands-mobile-list', desktop: '.commands-table' },
    { path: '/ranking', mobile: '.ranking-mobile-list', desktop: '.ranking-table-wrap' },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator(route.mobile)).toBeVisible();
    await expect(page.locator(route.desktop)).toBeHidden();
  }
});

test('applies the DTA visual system without shifting the operational HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.summary-strip')).toBeVisible();

  const visualTokens = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const summary = document.querySelector<HTMLElement>('.summary-strip');
    return {
      fontFamily: body.fontFamily,
      background: body.backgroundColor,
      primaryBackground: root.getPropertyValue('--color-accent').trim(),
      summaryColumns: summary ? getComputedStyle(summary).gridTemplateColumns.split(' ').length : null,
    };
  });

  expect(visualTokens.fontFamily).toContain('JetBrains Mono');
  expect(visualTokens.background).toBe('rgb(7, 7, 8)');
  expect(visualTokens.primaryBackground).toBe('#df172c');
  if ((page.viewportSize()?.width ?? 0) <= 900) expect(visualTokens.summaryColumns).toBe(2);
  else expect(visualTokens.summaryColumns).toBe(4);

  const summaryFits = await page.locator('.summary-item').evaluateAll(items => items.every(item => {
    const parent = item.getBoundingClientRect();
    return [...item.children].every(child => {
      const box = child.getBoundingClientRect();
      return box.left >= parent.left && box.right <= parent.right;
    });
  }));
  expect(summaryFits).toBe(true);
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

test('shows veto actors and choices in the audit history', async ({ page }, testInfo) => {
  await page.goto('/auditoria');

  await expect(page.getByRole('heading', { name: /auditoria/i })).toBeVisible();
  await expect(page.locator('.audit-action__badge:visible').filter({ hasText: /^Pick$/ }).first()).toBeVisible();
  await expect(page.locator('.audit-action__badge:visible').filter({ hasText: /^Ban$/ }).first()).toBeVisible();
  await expect(page.locator('.audit-actor:visible').filter({ hasText: 'Player One' }).first()).toBeVisible();
  await expect(page.locator('.audit-actor:visible').filter({ hasText: '329183750129385710' }).first()).toBeVisible();
  await expect(page.locator('.audit-choice:visible').filter({ hasText: 'Nurse' }).first()).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) <= 1100) {
    await expect(page.locator('.audit-mobile-list')).toBeVisible();
    await expect(page.locator('.audit-table')).toBeHidden();
  } else {
    await expect(page.locator('.audit-table')).toBeVisible();
    await expect(page.locator('.audit-mobile-list')).toBeHidden();
  }

  await page.screenshot({ path: testInfo.outputPath('audit-veto-history.png'), fullPage: true });
});
