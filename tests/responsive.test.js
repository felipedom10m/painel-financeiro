import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const cases = [
  { name: 'mobile-320', width: 320, height: 760 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 }
];

try {
  for (const viewport of cases) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?demo=1', { waitUntil: 'networkidle' });
    await page.waitForSelector('.purpose-card');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${viewport.name} possui overflow horizontal de ${overflow}px`);
    await page.screenshot({ path: `artifacts/${viewport.name}.png`, fullPage: true });
    await page.locator('[data-action="edit-purpose"]').first().click();
    await page.waitForSelector('#app-dialog[open]');
    assert.equal(await page.locator('#dialog-title').textContent(), 'Editar propósito');
    await page.locator('[data-action="close-dialog"]').first().click();
    await page.locator('[data-action="edit-bill"]').first().click();
    assert.equal(await page.locator('#app-dialog [name="dueDate"]').getAttribute('type'), 'date');
    await page.locator('[data-action="close-dialog"]').first().click();
    await page.locator('#new-record-button').click();
    await page.locator('[data-action="choose-record"][data-type="purchase"]').click();
    await page.waitForFunction(() => document.querySelector('#dialog-title')?.textContent === 'Compra no cartão');
    assert.equal(await page.locator('#dialog-title').textContent(), 'Compra no cartão');
    await page.locator('[data-action="close-dialog"]').first().click();

    if (viewport.name === 'mobile-390') {
      await page.locator('[data-action="add-commitment"]').first().click();
      await page.locator('[name="name"]').fill('Reserva de teste');
      await page.locator('[name="amount"]').fill('500');
      await page.locator('[name="dueDate"]').fill('2026-11-01');
      await page.locator('#dialog-submit').click();
      await page.waitForSelector('text=Reserva de teste');

      await page.locator('#new-record-button').click();
      await page.locator('[data-action="choose-record"][data-type="purchase"]').click();
      await page.waitForFunction(() => document.querySelector('#dialog-title')?.textContent === 'Compra no cartão');
      await page.locator('[name="date"]').fill('2026-10-30');
      await page.locator('[name="amount"]').fill('75');
      await page.locator('#app-dialog [name="description"]').fill('Compra de teste');
      await page.locator('#dialog-submit').click();
      await page.waitForSelector('text=Compra adicionada');
      await page.locator('[data-action="view-purchases"][data-invoice="2026-12"]').click();
      await page.waitForSelector('text=Compra de teste');
    }
    await context.close();
  }
  console.log('Responsividade e cliques principais validados em 4 larguras.');
} finally {
  await browser.close();
}
