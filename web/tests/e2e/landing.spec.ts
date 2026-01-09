import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('has title', async ({ page }) => {
    await page.goto('/')

    // Check that the page has loaded with Otto content (use first match for header)
    await expect(page.locator('header').getByText('Otto')).toBeVisible()
  })

  test('displays hero section', async ({ page }) => {
    await page.goto('/')

    // Check for the main headline
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Stop chasing task owners')).toBeVisible()
  })

  test('has Get Started button that links to setup', async ({ page }) => {
    await page.goto('/')

    // Find and verify the Get Started link
    const getStartedLink = page.locator('a', { hasText: 'Get Started' }).first()
    await expect(getStartedLink).toBeVisible()
    await expect(getStartedLink).toHaveAttribute('href', '/setup')
  })

  test('navigates to setup page', async ({ page }) => {
    await page.goto('/')

    // Click Get Started
    await page.locator('a', { hasText: 'Get Started' }).first().click()

    // Verify we're on the setup page
    await expect(page.locator('text=Create your workspace')).toBeVisible()
  })
})

test.describe('Setup Page', () => {
  test('displays registration form', async ({ page }) => {
    await page.goto('/setup')

    // Check for form elements
    await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible()
    await expect(page.getByLabel('Workspace Name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible()
  })

  test('shows progress indicator', async ({ page }) => {
    await page.goto('/setup')

    // Check progress steps are visible
    await expect(page.getByText('Register')).toBeVisible()
    await expect(page.getByText('Integrations')).toBeVisible()
    await expect(page.getByText('Complete')).toBeVisible()
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/setup')

    // Click submit without filling in fields
    await page.getByRole('button', { name: 'Create Workspace' }).click()

    // Should show validation error
    await expect(page.getByText('Workspace name is required')).toBeVisible()
  })

  test('shows Google sign-in option', async ({ page }) => {
    await page.goto('/setup')

    // Check for Google sign-in button
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  })

  test('can switch between register and login modes', async ({ page }) => {
    await page.goto('/setup')

    // Should start in register mode
    await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible()

    // Click sign in link
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should now be in login mode
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

    // Click create one link to go back
    await page.getByRole('button', { name: 'Create one' }).click()

    // Should be back in register mode
    await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible()
  })
})
