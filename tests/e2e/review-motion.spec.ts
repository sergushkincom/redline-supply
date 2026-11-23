import { expect, test, type Locator, type Page } from '@playwright/test';

async function openReview(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('redline-supply'));
  await page.goto('/requests/cmp_rohs/review');
  await expect(page.getByTestId('approve-change').first()).toBeVisible();
}

function row(page: Page, field: string): Locator {
  return page.locator(`[data-testid="review-row"][data-field="${field}"]`).first();
}

test('approve draws the old value and flashes the new one', async ({ page }) => {
  await openReview(page);
  const terms = row(page, 'paymentTermsDays');
  const oldValue = terms.getByTestId('old-value');
  await expect(oldValue).toHaveClass(/review-old/);
  await expect(oldValue).not.toHaveClass(/review-strike/);
  await expect(terms.getByTestId('approval-progress')).toHaveCount(0);

  const motion = await terms.evaluate(async (row) => {
    const button = row.querySelector<HTMLButtonElement>('[data-testid="approve-change"]');
    button?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const read = () => {
      const old = row.querySelector('[data-testid="old-value"]');
      const flash = row.querySelector('[data-testid="value-flash"]');
      const raw = old ? getComputedStyle(old, '::after').transform : 'none';
      const match = raw.match(/matrix\(([-0-9.]+)/);
      return {
        scale: match ? Number(match[1]) : null,
        opacity: flash ? Number(getComputedStyle(flash).opacity) : null,
      };
    };
    const early = read();
    await new Promise((resolve) => setTimeout(resolve, 160));
    const mid = read();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const end = read();
    return { early, mid, end };
  });

  expect(motion.early.scale).not.toBeNull();
  expect(motion.early.scale!).toBeLessThan(0.95);
  expect(motion.mid.scale!).toBeGreaterThan(motion.early.scale!);
  expect(motion.end.scale!).toBeGreaterThan(0.95);
  expect(motion.mid.opacity).not.toBeNull();
  expect(motion.mid.opacity!).toBeGreaterThan(0.35);
  expect(motion.end.opacity!).toBeLessThan(0.2);
  await expect(terms.getByTestId('approval-progress')).toHaveCount(0);
  await expect(terms).toHaveAttribute('data-motion-tick', '1');
});

test('a sensitive field shows one of two approvals', async ({ page }) => {
  await openReview(page);
  const iban = row(page, 'iban');
  await expect(iban.getByTestId('approval-progress')).toHaveCount(0);

  await iban.getByTestId('approve-change').click();

  const progress = iban.getByTestId('approval-progress');
  await expect(progress).toHaveAttribute('data-done', '1');
  await expect(progress).toHaveAttribute('data-need', '2');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(progress).toHaveAttribute('aria-valuemax', '2');
  await expect(iban.getByTestId('old-value')).toHaveClass(/review-strike/);
  await expect(iban.getByTestId('value-flash')).toBeAttached();

  await page.getByRole('radio', { name: 'Head of procurement' }).click();
  await iban.getByTestId('approve-change').click();
  await expect(progress).toHaveAttribute('data-done', '2');
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await expect(iban.getByTestId('proposed-value')).toHaveClass(/bg-ready-bg/);
  await expect(iban).toHaveAttribute('data-motion-tick', '2');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the settled approval immediately', async ({ page }) => {
    await openReview(page);
    const iban = row(page, 'iban');
    await iban.getByTestId('approve-change').click();

    const oldValue = iban.getByTestId('old-value');
    await expect(oldValue).toHaveClass(/review-strike/);
    const strike = await oldValue.evaluate((element) => {
      const style = getComputedStyle(element, '::after');
      return { animationName: style.animationName, transform: style.transform };
    });
    expect(strike.animationName).toBe('none');
    expect(strike.transform === 'none' || strike.transform.startsWith('matrix(1,')).toBe(true);

    const flash = iban.getByTestId('value-flash');
    await expect(flash).toBeAttached();
    await expect.poll(async () => flash.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');

    await expect(iban.getByTestId('approval-fill')).toHaveAttribute('style', /width:\s*50%/);
  });
});
