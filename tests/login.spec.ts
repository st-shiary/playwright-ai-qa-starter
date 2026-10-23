import { test, expect, USERS } from '../fixtures/app';

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid user reaches the product list', async ({ loginPage, inventory }) => {
    await loginPage.login(USERS.standard.username, USERS.standard.password);
    await inventory.expectLoaded();
  });

  test('locked-out user sees a clear error and stays on the login page', async ({ page, loginPage }) => {
    await loginPage.login(USERS.lockedOut.username, USERS.lockedOut.password);
    await loginPage.expectError('this user has been locked out');
    await expect(page).not.toHaveURL(/inventory/);
  });

  test('wrong password shows a credentials error', async ({ loginPage }) => {
    await loginPage.login(USERS.standard.username, 'not-the-password');
    await loginPage.expectError('do not match any user');
  });

  test('empty username is rejected', async ({ loginPage }) => {
    await loginPage.login('', USERS.standard.password);
    await loginPage.expectError('Username is required');
  });

  test('empty password is rejected', async ({ loginPage }) => {
    await loginPage.login(USERS.standard.username, '');
    await loginPage.expectError('Password is required');
  });
});
