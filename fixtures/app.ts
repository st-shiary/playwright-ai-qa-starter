import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';

/**
 * Credentials published by the sample shop for testing.
 * In a real client project these come from environment variables or a secrets
 * manager, never from the repo.
 */
export const USERS = {
  standard: { username: 'standard_user', password: 'secret_sauce' },
  lockedOut: { username: 'locked_out_user', password: 'secret_sauce' },
} as const;

type Fixtures = {
  loginPage: LoginPage;
  inventory: InventoryPage;
  cart: CartPage;
  checkout: CheckoutPage;
  /** A page object set that is already logged in as the standard user. */
  loggedIn: { inventory: InventoryPage; cart: CartPage; checkout: CheckoutPage };
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventory: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  cart: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkout: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  loggedIn: async ({ page }, use) => {
    // Every test logs in itself: slower than sharing state, but tests never
    // depend on each other, which is what keeps a suite from going flaky.
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USERS.standard.username, USERS.standard.password);
    const inventory = new InventoryPage(page);
    await inventory.expectLoaded();
    await use({ inventory, cart: new CartPage(page), checkout: new CheckoutPage(page) });
  },
});

export { expect } from '@playwright/test';
