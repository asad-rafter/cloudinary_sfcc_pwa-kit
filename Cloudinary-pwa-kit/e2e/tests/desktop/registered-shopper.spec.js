/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const {test, expect} = require('@playwright/test')
const config = require('../../config')
const {
  addProductToCart,
  registerShopper,
  validateOrderHistory,
  validateWishlist,
  loginShopper,
  navigateToPDPDesktop,
  navigateToPDPDesktopSocial,
  socialLoginShopper,
} = require("../../scripts/pageHelpers")
const {generateUserCredentials, getCreditCardExpiry} = require('../../scripts/utils.js')
let registeredUserCredentials = {}

test.beforeAll(async () => {
    // Generate credentials once and use throughout tests to avoid creating a new account
    registeredUserCredentials = generateUserCredentials()
})

/**
 * Test that registered shoppers can add a product to cart and go through the entire checkout process,
 * validating that shopper is able to get to the order summary section,
 * and that order shows up in order history
 */
test('Registered shopper can checkout items', async ({page}) => {
    // Since we're re-using the same account, we need to check if the user is already registered.
    // This ensures the tests are independent and not dependent on the order they are run in.
    const isLoggedIn = await loginShopper({
        page,
        userCredentials: registeredUserCredentials
    })

    if (!isLoggedIn) {
        await registerShopper({
            page,
            userCredentials: registeredUserCredentials
        })
    }

    await expect(page.getByRole('heading', {name: /Account Details/i})).toBeVisible()

    // Shop for items as registered user
    await addProductToCart({page})

    // cart
    await page.getByLabel(/My cart/i).click()

    await expect(page.getByRole('link', {name: /Cotton Turtleneck Sweater/i})).toBeVisible()

    await page.getByRole('link', {name: 'Proceed to Checkout'}).click()

    // Confirm the email input toggles to show sign out button on clicking "Checkout as guest"
    const step0Card = page.locator("div[data-testid='sf-toggle-card-step-0']")

    await expect(step0Card.getByRole('button', {name: /Sign Out/i})).toBeVisible()

    await expect(page.getByRole('heading', {name: /Shipping Address/i})).toBeVisible()

    await page.locator('input#firstName').fill(registeredUserCredentials.firstName)
    await page.locator('input#lastName').fill(registeredUserCredentials.lastName)
    await page.locator('input#phone').fill(registeredUserCredentials.phone)
    await page.locator('input#address1').fill(registeredUserCredentials.address.street)
    await page.locator('input#city').fill(registeredUserCredentials.address.city)
    await page.locator('select#stateCode').selectOption(registeredUserCredentials.address.state)
    await page.locator('input#postalCode').fill(registeredUserCredentials.address.zipcode)

    await page.getByRole('button', {name: /Continue to Shipping Method/i}).click()

    // Confirm the shipping details form toggles to show edit button on clicking "Checkout as guest"
    const step1Card = page.locator("div[data-testid='sf-toggle-card-step-1']")

    await expect(step1Card.getByRole('button', {name: /Edit/i})).toBeVisible()

    await expect(page.getByRole('heading', {name: /Shipping & Gift Options/i})).toBeVisible()
    await page.waitForLoadState()

    const continueToPayment = page.getByRole('button', {
        name: /Continue to Payment/i
    })

    if (continueToPayment.isEnabled()) {
        await continueToPayment.click()
    }

    // Confirm the shipping options form toggles to show edit button on clicking "Checkout as guest"
    const step2Card = page.locator("div[data-testid='sf-toggle-card-step-2']")

    await expect(step2Card.getByRole('button', {name: /Edit/i})).toBeVisible()

    await expect(page.getByRole('heading', {name: /Payment/i})).toBeVisible()

    const creditCardExpiry = getCreditCardExpiry()

    await page.locator('input#number').fill('4111111111111111')
    await page.locator('input#holder').fill('John Doe')
    await page.locator('input#expiry').fill(creditCardExpiry)
    await page.locator('input#securityCode').fill('213')

    await page.getByRole('button', {name: /Review Order/i}).click()

    // Confirm the shipping options form toggles to show edit button on clicking "Checkout as guest"
    const step3Card = page.locator("div[data-testid='sf-toggle-card-step-3']")

    await expect(step3Card.getByRole('button', {name: /Edit/i})).toBeVisible()
    page.getByRole('button', {name: /Place Order/i})
        .first()
        .click()

    const orderConfirmationHeading = page.getByRole('heading', {
        name: /Thank you for your order!/i
    })
    await orderConfirmationHeading.waitFor()

    await expect(page.getByRole('heading', {name: /Order Summary/i})).toBeVisible()
    await expect(page.getByText(/2 Items/i)).toBeVisible()
    await expect(page.getByRole('link', {name: /Cotton Turtleneck Sweater/i})).toBeVisible()

    // order history
    await validateOrderHistory({page})
})

/**
 * Test that registered shoppers can navigate to PDP and add a product to wishlist
 */
test('Registered shopper can add item to wishlist', async ({page}) => {
    const isLoggedIn = await loginShopper({
        page,
        userCredentials: registeredUserCredentials
    })

    if (!isLoggedIn) {
        await registerShopper({
            page,
            userCredentials: registeredUserCredentials
        })
    }

    await expect(page.getByRole('heading', {name: /Account Details/i})).toBeVisible()

    // Navigate to PDP
    await navigateToPDPDesktop({page})

    // add product to wishlist
    await expect(page.getByRole('heading', {name: /Cotton Turtleneck Sweater/i})).toBeVisible()

    await page.getByRole('radio', {name: 'L', exact: true}).click()
    await page.getByRole('button', {name: /Add to Wishlist/i}).click()

    // wishlist
    await validateWishlist({page})
})

/**
 * Test that social login persists a user's shopping cart
 * TODO: Fix flaky test
 * Skipping this test for now because Google login requires 2FA, which Playwright cannot get past.
 */
test.skip("Registered shopper logged in through social retains persisted cart", async ({ page }) => {
  navigateToPDPDesktopSocial({page, productName: "Floral Ruffle Top", productColor: "Cardinal Red Multi", productPrice: "£35.19"})

  // Add to Cart
  await expect(
    page.getByRole("heading", { name: /Floral Ruffle Top/i })
  ).toBeVisible({timeout: 15000})
  await page.getByRole("radio", { name: "L", exact: true }).click()

  await page.locator("button[data-testid='quantity-increment']").click()

  // Selected Size and Color texts are broken into multiple elements on the page.
  // So we need to look at the page URL to verify selected variants
  const updatedPageURL = await page.url()
  const params = updatedPageURL.split("?")[1]
  expect(params).toMatch(/size=9LG/i)
  expect(params).toMatch(/color=JJ9DFXX/i)
  await page.getByRole("button", { name: /Add to Cart/i }).click()

  const addedToCartModal = page.getByText(/2 items added to cart/i)

  await addedToCartModal.waitFor()

  await page.getByLabel("Close", { exact: true }).click()

  // Social Login
  await socialLoginShopper({
    page
  })

  // Check Items in Cart
  await page.getByLabel(/My cart/i).click()
  await page.waitForLoadState()
  await expect(
    page.getByRole("link", { name: /Floral Ruffle Top/i })
  ).toBeVisible()
})
