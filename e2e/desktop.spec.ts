import { expect, test } from '@playwright/test';

test('starts, moves, holds, drops, pauses, and resumes with keyboard controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Less noise. More play.' })).toBeVisible();
  await expect(page.locator('.board-cell')).toHaveCount(200);
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-status')).toHaveText('LIVE');
  await expect(page.locator('.playfield .block-cube')).toHaveCount(4);
  await expect(page.locator('.playfield .ghost-cube')).toHaveCount(4);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('c');
  await expect(page.locator('.hold-preview [role="img"]')).toBeVisible();
  await expect(page.locator('.hold-card')).toContainText('Available next turn');
  await page.keyboard.press('Space');
  await expect(page.locator('.playfield .block-cube')).toHaveCount(8);
  await expect(page.locator('.hold-card')).toContainText('A piece for later');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible();
  const score = await page.locator('.score-number').textContent();
  await page.keyboard.press('Space');
  await expect(page.locator('.score-number')).toHaveText(score!);
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-status')).toHaveText('LIVE');
  expect(errors).toEqual([]);
});

test('help dialog pauses the game and restores focus accessibly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.game-status')).toHaveText('PAUSED');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.locator('.game-status')).toHaveText('LIVE');
});

test('game over allows replay and personal best survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole('button', { name: 'Play again' }).isVisible()) break;
    await page.keyboard.press('Space');
  }
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  const best = await page.locator('.best-score strong').textContent();
  expect(Number(best!.replaceAll(',', ''))).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('.best-score strong')).toHaveText(best!);
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.locator('.score-number')).toHaveText('000000');
  await page.getByRole('button', { name: 'Restart game' }).click();
  await expect(page.locator('.playfield .block-cube')).toHaveCount(4);
});

test('sound preference persists and desktop layout stays inside the viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const board = await page.locator('.board-frame').boundingBox();
  expect(board!.y + board!.height).toBeLessThan(900);
  await page.screenshot({ path: '/tmp/blockshift-desktop.png', fullPage: true });
});
