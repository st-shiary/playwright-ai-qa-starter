import { expect, type Locator, type Page } from '@playwright/test';

export interface Customer {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export class CheckoutPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly error: Locator;
  readonly subtotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly finishButton: Locator;
  readonly completeHeader: Locator;

  constructor(private readonly page: Page) {
    this.firstName = page.getByTestId('firstName');
    this.lastName = page.getByTestId('lastName');
    this.postalCode = page.getByTestId('postalCode');
    this.continueButton = page.getByTestId('continue');
    this.error = page.getByTestId('error');
    this.subtotal = page.getByTestId('subtotal-label');
    this.tax = page.getByTestId('tax-label');
    this.total = page.getByTestId('total-label');
    this.finishButton = page.getByTestId('finish');
    this.completeHeader = page.getByTestId('complete-header');
  }

  async fillDetails(customer: Partial<Customer>) {
    if (customer.firstName !== undefined) await this.firstName.fill(customer.firstName);
    if (customer.lastName !== undefined) await this.lastName.fill(customer.lastName);
    if (customer.postalCode !== undefined) await this.postalCode.fill(customer.postalCode);
    await this.continueButton.click();
  }

  async expectOnOverview() {
    await expect(this.page).toHaveURL(/checkout-step-two\.html/);
  }

  /** Reads a label such as "Item total: $29.99" and returns 29.99. */
  async amount(label: Locator): Promise<number> {
    const text = (await label.textContent()) ?? '';
    const match = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (!match) throw new Error(`No amount found in "${text}"`);
    return Number(match[1]);
  }

  async finish() {
    await this.finishButton.click();
  }
}
