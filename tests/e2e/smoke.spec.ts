import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.beforeAll(async () => {
  await mkdir('docs/screenshots', { recursive: true });
});

async function approveOpenRows(page: import('@playwright/test').Page) {
  const count = await page.getByTestId('approve-change').count();
  for (let index = 0; index < count; index += 1) {
    const approve = page.getByTestId('approve-change').nth(index);
    const reject = page.getByTestId('reject-change').nth(index);
    if ((await reject.getAttribute('aria-pressed')) === 'true') continue;
    if ((await approve.getAttribute('aria-pressed')) === 'true') continue;
    if (await approve.isDisabled()) continue;
    await approve.click();
  }
}

test('walks the seven screens and finishes a review', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('redline-supply'));
  await page.reload();
  await expect(page.getByRole('heading', { name: /What needs you/i })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/home.png' });

  await page.getByRole('link', { name: 'Suppliers' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/suppliers.png' });

  await page.getByRole('link', { name: 'Articles' }).first().click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/articles.png' });

  await page.goto('/suppliers/s01?tab=details');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/supplier.png' });

  await page.goto('/requests');
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/requests.png' });

  await page.goto('/requests/cmp_reach');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/campaign.png' });

  await page.goto('/requests/cmp_reach/responses');
  await expect(page.getByRole('tab', { name: /Responses/ })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/responses.png' });
  await page.getByRole('button', { name: 'Scenarios' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/scenarios.png' });

  await page.goto('/requests/cmp_rohs/review');
  await expect(page.getByTestId('finish-review')).toBeDisabled();
  await page.getByRole('button', { name: 'DE', exact: true }).click();
  await expect(page.getByTestId('finish-review')).toHaveText(/Prüfung/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByTestId('reject-change').nth(5).click();
  await expect(page.getByText('Rejected').first()).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/review.png' });
  await approveOpenRows(page);
  await page.getByRole('radio', { name: 'Head of procurement' }).click();
  await approveOpenRows(page);
  await expect(page.getByTestId('finish-review')).toBeEnabled();
  await page.getByTestId('finish-review').click();
  await expect(page.getByRole('status')).toContainText(/master data/i);
  await page.goto('/suppliers/s01?tab=details');
  await page.getByRole('button', { name: 'History' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/history.png' });

  await page.goto('/reports/cbam');
  await expect(page.getByRole('heading', { name: 'CBAM' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/report.png' });
  await page.getByTestId('request-status').click({ noWaitAfter: true });
  await page.waitForURL(/compose=1/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/request-sheet.png' });
});
