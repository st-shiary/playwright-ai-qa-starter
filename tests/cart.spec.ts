import { test, expect } from '../fixtures/app';
import { PRODUCTS } from '../pages/InventoryPage';

test.describe('Cart', () => {
  test('adding a product updates the cart badge', async ({ loggedIn }) => {
    const { inventory } = loggedIn;
    await expect(inventory.cartBadge).toBeHidden();
    await inventory.addToCart(PRODUCTS.backpack);
    await expect(inventory.cartBadge).toHaveText('1');
    await inventory.addToCart(PRODUCTS.bikeLight);
    await expect(inventory.cartBadge).toHaveText('2');
  });

  test('the cart page lists exactly what was added', async ({ loggedIn }) => {
    const { inventory, cart } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.addToCart(PRODUCTS.boltTShirt);
    await inventory.openCart();
    await cart.expectLoaded();
    await expect(cart.items).toHaveCount(2);
    await expect(cart.itemNames).toContainText(['Sauce Labs Backpack', 'Sauce Labs Bolt T-Shirt']);
  });

  test('removing a product from the cart empties it', async ({ loggedIn }) => {
    const { inventory, cart } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.openCart();
    await cart.remove(PRODUCTS.backpack);
    await expect(cart.items).toHaveCount(0);
    await expect(inventory.cartBadge).toBeHidden();
  });
});
