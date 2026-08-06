import { expect, test, type Page } from '@playwright/test';

const isMobileProject = (width: number | undefined) => (width ?? 0) <= 720;

async function makeCurrentPageLong(page: Page) {
  await page.locator('.page').evaluate(element => {
    (element as HTMLElement).style.minHeight = '2400px';
  });
}

async function navigateFromShell(page: Page, href: string) {
  if (isMobileProject(page.viewportSize()?.width)) {
    const directLink = page.locator(`.mobile-navigation a[href="${href}"]`);
    if (await directLink.count()) {
      await directLink.click();
      return;
    }

    await page.locator('.mobile-navigation button').filter({ hasText: 'Mais' }).click();
    await page.locator(`.mobile-more a[href="${href}"]`).click();
    return;
  }

  await page.locator(`.sidebar a[href="${href}"]`).click();
}

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

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

  if ((page.viewportSize()?.width ?? 0) <= 900) {
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

test('keeps native select options readable in the dark theme', async ({ page }) => {
  await page.goto('/comandos');

  const sourceFilter = page.locator('.table-toolbar .select-field select');
  await expect(sourceFilter).toBeVisible();
  const optionStyles = await sourceFilter.locator('option').evaluateAll(options => options.map(option => {
    const style = getComputedStyle(option);
    return { backgroundColor: style.backgroundColor, color: style.color };
  }));

  expect(optionStyles).toHaveLength(3);
  expect(optionStyles).toEqual(expect.arrayContaining([
    { backgroundColor: 'rgb(21, 22, 23)', color: 'rgb(244, 240, 230)' },
  ]));
  expect(optionStyles.every(style => style.backgroundColor === 'rgb(21, 22, 23)')).toBe(true);
  expect(optionStyles.every(style => style.color === 'rgb(244, 240, 230)')).toBe(true);
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
  const actor = page.locator('.audit-actor:visible').filter({ hasText: 'Player One' }).first();
  await expect(actor).toHaveAttribute('title', 'ID: 329183750129385710');
  await expect(actor).not.toContainText('329183750129385710');
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

test('keeps the command studio usable on mobile', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) > 720, 'Mobile command studio flow.');
  await page.goto('/comandos');
  await page.getByRole('button', { name: /novo comando/i }).click();
  const dialog = page.getByRole('dialog', { name: /novo comando slash/i });
  await expect(dialog).toBeVisible();
  const fits = await dialog.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= document.documentElement.clientWidth;
  });
  expect(fits).toBe(true);
  for (const button of await dialog.locator('.command-editor__actions .button').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await page.screenshot({ path: testInfo.outputPath('command-studio-mobile.png'), fullPage: true });
});

test('creates, simulates and publishes a bilingual slash command', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 720, 'Desktop command studio flow.');
  await page.goto('/comandos');
  await page.getByRole('button', { name: /novo comando/i }).click();
  const dialog = page.getByRole('dialog', { name: /novo comando slash/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome PT-BR').fill('aviso');
  await dialog.getByLabel('Name English').fill('notice');
  await dialog.getByLabel('Descrição PT-BR').fill('Envia um aviso configurável');
  await dialog.getByLabel('Description English').fill('Sends a configurable notice');
  await dialog.getByLabel('Texto PT-BR').fill('Olá, {{user.username}}');
  await dialog.getByLabel('Texto English').fill('Hello, {{user.username}}');
  await dialog.getByRole('button', { name: /simular/i }).click();
  await expect(dialog.getByText(/resultado da simulação/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('command-studio.png'), fullPage: true });
  await dialog.getByRole('button', { name: /salvar e publicar/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('/aviso publicado no Discord.')).toBeVisible();
});

test('shows live logs and keeps the guild selector in the dark visual system', async ({ page }, testInfo) => {
  await page.goto('/logs');
  await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
  await expect(page.locator('.logs-console pre')).toContainText('Bot online');
  const selectorStyle = await page.locator('.guild-selector select').first().evaluate(select => ({
    colorScheme: getComputedStyle(select).colorScheme,
    color: getComputedStyle(select).color,
  }));
  expect(selectorStyle.colorScheme).toBe('dark');
  expect(selectorStyle.color).toBe('rgb(244, 240, 230)');
  await page.screenshot({ path: testInfo.outputPath('logs.png'), fullPage: true });
});

test('honors reduced motion for route transitions and programmatic scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/auditoria');
  await makeCurrentPageLong(page);
  await page.evaluate(() => window.scrollTo(0, 760));

  await navigateFromShell(page, '/confrontos');
  const heading = page.getByRole('heading', { name: /confrontos/i, level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();

  const pageTransition = page.getByTestId('page-transition');
  await expect(pageTransition).toBeVisible();
  await expect.poll(() => pageTransition.evaluate(element => getComputedStyle(element).transform)).toBe('none');

  await makeCurrentPageLong(page);
  await page.evaluate(() => window.scrollTo(0, 760));
  const backToTop = page.getByRole('button', { name: /voltar ao topo/i });
  await expect(backToTop).toBeVisible();
  await backToTop.click();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
});

test('resets route scroll and focuses the destination heading', async ({ page }) => {
  await page.goto('/auditoria');
  await makeCurrentPageLong(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);

  await navigateFromShell(page, '/confrontos');
  await expect(page).toHaveURL(/\/confrontos$/);
  const heading = page.getByRole('heading', { name: /confrontos/i, level: 1 });
  await expect(heading).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await expect(heading).toBeFocused();
});

test('closes overlays with Escape and restores focus to their triggers', async ({ page }, testInfo) => {
  await page.goto('/pools');

  const dialogTrigger = page.getByRole('button', { name: /criar pool/i });
  await dialogTrigger.click();
  const adminDialog = page.getByRole('dialog', { name: /criar pool/i });
  await expect(adminDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(adminDialog).toBeHidden();
  await expect(dialogTrigger).toBeFocused();

  if (isMobileProject(page.viewportSize()?.width)) {
    const moreTrigger = page.locator('.mobile-navigation button').filter({ hasText: 'Mais' });
    await moreTrigger.click();
    const mobileOverlay = page.getByRole('dialog', { name: /mais .*reas/i });
    await expect(mobileOverlay).toBeVisible();
    const closeButton = mobileOverlay.locator('.mobile-more__header').getByRole('button', { name: /fechar menu/i });
    await expect(closeButton).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('mobile-more-motion.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(mobileOverlay).toBeHidden();
    await expect(moreTrigger).toBeFocused();
    return;
  }

  const userMenuTrigger = page.locator('.user-menu__trigger');
  await userMenuTrigger.click();
  const userMenu = page.getByRole('menu');
  await expect(userMenu).toBeVisible();
  await expect(userMenu.getByRole('menuitem')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('user-menu-motion.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(userMenu).toBeHidden();
  await expect(userMenuTrigger).toBeFocused();
});

test('tracks long-page progress and returns to the focused heading', async ({ page }, testInfo) => {
  await page.goto('/auditoria');
  await makeCurrentPageLong(page);

  const progress = page.getByTestId('workspace-scroll-progress');
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute('aria-hidden', 'true');
  const initialTransform = await progress.evaluate(element => getComputedStyle(element).transform);

  await page.evaluate(() => window.scrollTo(0, 720));
  const backToTop = page.getByRole('button', { name: /voltar ao topo/i });
  await expect(backToTop).toBeVisible();
  await expect.poll(() => progress.evaluate(element => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await page.screenshot({ path: testInfo.outputPath('scroll-progress-back-to-top.png'), fullPage: false });

  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: /auditoria/i, level: 1 })).toBeFocused();
  await expect(backToTop).toBeHidden();
});

test('updates horizontal table overflow states at both edges', async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 1100, 'Responsive projects expose audit records instead of the table.');
  await page.goto('/auditoria');

  const tableScroll = page.locator('.audit-table');
  await expect(tableScroll).toBeVisible();
  await tableScroll.evaluate(element => {
    const container = element as HTMLElement;
    container.style.width = '420px';
    const table = container.querySelector<HTMLElement>('table');
    if (table) table.style.minWidth = '1200px';
  });
  await expect.poll(() => tableScroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);

  await expect(tableScroll).toHaveAttribute('data-overflow-left', 'false');
  await expect(tableScroll).toHaveAttribute('data-overflow-right', 'true');

  await tableScroll.evaluate(element => {
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  });
  await expect(tableScroll).toHaveAttribute('data-overflow-left', 'true');
  await expect(tableScroll).toHaveAttribute('data-overflow-right', 'true');
  await page.screenshot({ path: testInfo.outputPath('table-overflow-edges.png'), fullPage: false });

  await tableScroll.evaluate(element => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(tableScroll).toHaveAttribute('data-overflow-left', 'true');
  await expect(tableScroll).toHaveAttribute('data-overflow-right', 'false');
});

test('keeps mobile scroll controls, navigation and sticky actions from overlapping', async ({ page }, testInfo) => {
  test.skip(!isMobileProject(page.viewportSize()?.width), 'Mobile-only overlap contract.');
  await page.goto('/auditoria');
  await makeCurrentPageLong(page);
  await page.evaluate(() => window.scrollTo(0, 720));

  const backToTop = page.getByRole('button', { name: /voltar ao topo/i });
  const mobileNavigation = page.locator('.mobile-navigation');
  await expect(backToTop).toBeVisible();
  await expect(mobileNavigation).toBeVisible();
  const backToTopBox = await backToTop.boundingBox();
  const navigationBox = await mobileNavigation.boundingBox();
  expect(backToTopBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(boxesOverlap(backToTopBox!, navigationBox!)).toBe(false);

  await page.goto('/comandos');
  await page.getByRole('button', { name: /novo comando/i }).click();
  const dialog = page.getByRole('dialog', { name: /novo comando slash/i });
  const stickyActions = dialog.locator('.command-editor__actions');
  await expect(stickyActions).toBeVisible();
  await stickyActions.scrollIntoViewIfNeeded();
  await expect(backToTop).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('command-dialog-scroll-actions.png'), fullPage: false });

  const actionsBox = await stickyActions.boundingBox();
  const currentNavigationBox = await mobileNavigation.boundingBox();
  expect(actionsBox).not.toBeNull();
  expect(currentNavigationBox).not.toBeNull();
  expect(boxesOverlap(actionsBox!, currentNavigationBox!)).toBe(false);

  const viewport = page.viewportSize()!;
  expect(actionsBox!.x).toBeGreaterThanOrEqual(0);
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(viewport.height);
});
