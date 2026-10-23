import { expect, type Locator, type Page } from '@playwright/test';

export class CartPage {
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly checkoutButton: Locator;

  constructor(private readonly page: Page) {
    this.items = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.checkoutButton = page.getByTestId('checkout');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/cart\.html/);
  }

  async remove(slug: string) {
    await this.page.getByTestId(`remove-${slug}`).click();
  }

  async startCheckout() {
    await this.checkoutButton.click();
  }
}
