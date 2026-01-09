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
  test('displays workspace form', async ({ page }) => {
    await page.goto('/setup')

    // Check for form elements
    await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible()
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="adminEmail"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  })

  test('shows progress indicator', async ({ page }) => {
    await page.goto('/setup')

    // Check progress steps are visible (use the progress indicator section)
    const progressSteps = page.locator('[class*="flex"][class*="justify-between"]').first()
    await expect(progressSteps.getByText('Workspace')).toBeVisible()
    await expect(progressSteps.getByText('Slack')).toBeVisible()
    await expect(progressSteps.getByText('Asana')).toBeVisible()
    await expect(progressSteps.getByText('Complete')).toBeVisible()
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/setup')

    // Click continue without filling in fields
    await page.getByRole('button', { name: 'Continue' }).click()

    // Should show validation error
    await expect(page.getByText('Workspace name is required')).toBeVisible()
  })
})
