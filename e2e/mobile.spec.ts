import { expect, test } from '@playwright/test';

test('touch controls play a round without horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Let’s play' }).tap();
  await expect(page.locator('.game-status')).toHaveText('LIVE');
  const controls = page.getByRole('group');
  // Buttons remain individually accessible on touch and keyboard devices.
  await page.locator('.touch-controls').getByRole('button', { name: 'Left', exact: true }).tap();
  await page.locator('.touch-controls').getByRole('button', { name: 'Rotate', exact: true }).tap();
  await page.locator('.touch-controls').getByRole('button', { name: 'Hold', exact: true }).tap();
  await expect(page.locator('.hold-preview [role="img"]')).toBeVisible();
  await page.locator('.touch-controls').getByRole('button', { name: 'Drop', exact: true }).tap();
  await expect(page.locator('.playfield .block-cube')).toHaveCount(8);
  await page.getByRole('button', { name: 'Pause game' }).tap();
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).tap();
  await expect(page.locator('.game-status')).toHaveText('LIVE');
  expect(errors).toEqual([]);
  await page.screenshot({ path: '/tmp/blockshift-mobile.png', fullPage: true });
  void controls;
});
