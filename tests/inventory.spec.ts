import { test, expect } from '../fixtures/app';

test.describe('Product list', () => {
  test('shows all six products with a name and a price', async ({ loggedIn }) => {
    const { inventory } = loggedIn;
    await expect(inventory.items).toHaveCount(6);
    await expect(inventory.itemNames.first()).not.toBeEmpty();
    await expect(inventory.itemPrices.first()).toContainText('$');
  });

  test('sorting by price low to high orders the list correctly', async ({ loggedIn }) => {
    const { inventory } = loggedIn;
    await inventory.sortBy('lohi');
    // Poll until the page has re-sorted, instead of waiting a fixed time
    await expect
      .poll(async () => {
        const prices = await inventory.prices();
        return prices.join(',') === [...prices].sort((a, b) => a - b).join(',');
      })
      .toBe(true);
  });

  test('opening a product shows its detail page and can go back', async ({ page, loggedIn }) => {
    const { inventory } = loggedIn;
    const name = (await inventory.itemNames.first().textContent()) ?? '';
    await inventory.itemNames.first().click();
    await expect(page).toHaveURL(/inventory-item\.html/);
    // The URL changes before the page content does. Wait for an element that only exists
    // on the detail page, otherwise 'inventory-item-name' still matches the 6 list items.
    const back = page.getByTestId('back-to-products');
    await expect(back).toBeVisible();
    await expect(page.getByTestId('inventory-item-name')).toHaveText(name);
    await back.click();
    await inventory.expectLoaded();
  });
});
