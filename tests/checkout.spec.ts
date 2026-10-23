import { test, expect } from '../fixtures/app';
import { PRODUCTS } from '../pages/InventoryPage';

const CUSTOMER = { firstName: 'Test', lastName: 'Buyer', postalCode: '1207' };

test.describe('Checkout', () => {
  test('a customer can complete a purchase', async ({ loggedIn }) => {
    const { inventory, cart, checkout } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.openCart();
    await cart.startCheckout();
    await checkout.fillDetails(CUSTOMER);
    await checkout.expectOnOverview();
    await checkout.finish();
    await expect(checkout.completeHeader).toHaveText('Thank you for your order!');
  });

  test('first name is required', async ({ loggedIn }) => {
    const { inventory, cart, checkout } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.openCart();
    await cart.startCheckout();
    await checkout.fillDetails({ lastName: CUSTOMER.lastName, postalCode: CUSTOMER.postalCode });
    await expect(checkout.error).toContainText('First Name is required');
  });

  test('postal code is required', async ({ loggedIn }) => {
    const { inventory, cart, checkout } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.openCart();
    await cart.startCheckout();
    await checkout.fillDetails({ firstName: CUSTOMER.firstName, lastName: CUSTOMER.lastName });
    await expect(checkout.error).toContainText('Postal Code is required');
  });

  test('order total equals item total plus tax', async ({ loggedIn }) => {
    const { inventory, cart, checkout } = loggedIn;
    await inventory.addToCart(PRODUCTS.backpack);
    await inventory.addToCart(PRODUCTS.bikeLight);
    await inventory.openCart();
    await cart.startCheckout();
    await checkout.fillDetails(CUSTOMER);
    await checkout.expectOnOverview();

    const subtotal = await checkout.amount(checkout.subtotal);
    const tax = await checkout.amount(checkout.tax);
    const total = await checkout.amount(checkout.total);
    // Money maths: compare in cents to avoid floating-point surprises
    expect(Math.round(total * 100)).toBe(Math.round(subtotal * 100) + Math.round(tax * 100));
  });
});
