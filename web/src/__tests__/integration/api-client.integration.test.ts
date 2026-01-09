/**
 * Integration tests for the API client.
 * These tests verify the API client works correctly with MSW mocked endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { z } from 'zod'
import { api, ApiError } from '@/api/client'

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
})

type User = z.infer<typeof UserSchema>

const mockUser: User = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
}

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())
beforeEach(() => server.resetHandlers())

describe('API Client Integration', () => {
  describe('GET requests', () => {
    it('fetches data successfully', async () => {
      server.use(
        http.get('/api/users/123', () => {
          return HttpResponse.json(mockUser)
        })
      )

      const result = await api.get<User>('/api/users/123')

      expect(result).toEqual(mockUser)
    })

    it('validates response with schema', async () => {
      server.use(
        http.get('/api/users/123', () => {
          return HttpResponse.json(mockUser)
        })
      )

      const result = await api.get('/api/users/123', {}, UserSchema)

      expect(result).toEqual(mockUser)
    })

    it('throws on schema validation failure', async () => {
      server.use(
        http.get('/api/users/123', () => {
          return HttpResponse.json({ id: 'user-123', name: 'Test' }) // missing email
        })
      )

      await expect(api.get('/api/users/123', {}, UserSchema)).rejects.toThrow()
    })

    it('handles query parameters', async () => {
      server.use(
        http.get('/api/users', ({ request }) => {
          const url = new URL(request.url)
          const status = url.searchParams.get('status')
          const limit = url.searchParams.get('limit')

          return HttpResponse.json({
            params: { status, limit },
          })
        })
      )

      const result = await api.get<{ params: { status: string; limit: string } }>(
        '/api/users',
        { params: { status: 'active', limit: '10' } }
      )

      expect(result.params.status).toBe('active')
      expect(result.params.limit).toBe('10')
    })

    it('throws ApiError on 404', async () => {
      server.use(
        http.get('/api/users/not-found', () => {
          return new HttpResponse('User not found', { status: 404 })
        })
      )

      try {
        await api.get('/api/users/not-found')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).message).toBe('User not found')
      }
    })

    it('throws ApiError on 500', async () => {
      server.use(
        http.get('/api/users/error', () => {
          return new HttpResponse('Internal server error', { status: 500 })
        })
      )

      try {
        await api.get('/api/users/error')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
      }
    })
  })

  describe('POST requests', () => {
    it('sends data and receives response', async () => {
      server.use(
        http.post('/api/users', async ({ request }) => {
          const body = (await request.json()) as { name: string; email: string }
          return HttpResponse.json({
            id: 'new-user-123',
            ...body,
          })
        })
      )

      const result = await api.post<User>('/api/users', {
        name: 'New User',
        email: 'new@example.com',
      })

      expect(result.id).toBe('new-user-123')
      expect(result.name).toBe('New User')
      expect(result.email).toBe('new@example.com')
    })

    it('validates POST response with schema', async () => {
      server.use(
        http.post('/api/users', async ({ request }) => {
          const body = (await request.json()) as { name: string; email: string }
          return HttpResponse.json({
            id: 'new-user-123',
            ...body,
          })
        })
      )

      const result = await api.post(
        '/api/users',
        { name: 'Schema User', email: 'schema@example.com' },
        {},
        UserSchema
      )

      expect(result.id).toBe('new-user-123')
    })

    it('sends correct content-type header', async () => {
      let receivedContentType: string | null = null

      server.use(
        http.post('/api/users', async ({ request }) => {
          receivedContentType = request.headers.get('content-type')
          return HttpResponse.json(mockUser)
        })
      )

      await api.post('/api/users', { name: 'Test' })

      expect(receivedContentType).toBe('application/json')
    })

    it('throws on POST errors', async () => {
      server.use(
        http.post('/api/users', () => {
          return new HttpResponse('Validation failed', { status: 400 })
        })
      )

      try {
        await api.post('/api/users', { invalid: 'data' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(400)
      }
    })
  })

  describe('PUT requests', () => {
    it('sends update data and receives response', async () => {
      server.use(
        http.put('/api/users/123', async ({ request }) => {
          const body = (await request.json()) as { name: string }
          return HttpResponse.json({
            ...mockUser,
            ...body,
          })
        })
      )

      const result = await api.put<User>('/api/users/123', {
        name: 'Updated Name',
      })

      expect(result.name).toBe('Updated Name')
    })

    it('validates PUT response with schema', async () => {
      server.use(
        http.put('/api/users/123', () => {
          return HttpResponse.json(mockUser)
        })
      )

      const result = await api.put(
        '/api/users/123',
        { name: 'Updated' },
        {},
        UserSchema
      )

      expect(result).toEqual(mockUser)
    })
  })

  describe('DELETE requests', () => {
    it('sends delete request successfully', async () => {
      server.use(
        http.delete('/api/users/123', () => {
          return HttpResponse.json({ success: true })
        })
      )

      const result = await api.delete<{ success: boolean }>('/api/users/123')

      expect(result.success).toBe(true)
    })

    it('throws on delete errors', async () => {
      server.use(
        http.delete('/api/users/123', () => {
          return new HttpResponse('Forbidden', { status: 403 })
        })
      )

      try {
        await api.delete('/api/users/123')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(403)
      }
    })
  })

  describe('Custom Headers', () => {
    it('allows custom headers', async () => {
      let receivedAuth: string | null = null

      server.use(
        http.get('/api/protected', async ({ request }) => {
          receivedAuth = request.headers.get('authorization')
          return HttpResponse.json({ data: 'protected' })
        })
      )

      await api.get('/api/protected', {
        headers: { Authorization: 'Bearer token123' },
      })

      expect(receivedAuth).toBe('Bearer token123')
    })
  })

  describe('Error Response Handling', () => {
    it('handles empty error body', async () => {
      server.use(
        http.get('/api/error', () => {
          return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' })
        })
      )

      try {
        await api.get('/api/error')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
      }
    })

    it('handles JSON error response', async () => {
      server.use(
        http.get('/api/error', () => {
          return HttpResponse.json(
            { error: 'Something went wrong' },
            { status: 400 }
          )
        })
      )

      try {
        await api.get('/api/error')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(400)
      }
    })
  })
})

describe('API Client with React Query Integration', () => {
  it('works correctly with setup queries', async () => {
    const TenantSchema = z.object({
      id: z.string(),
      name: z.string(),
      slackWorkspaceId: z.string().nullable(),
      asanaWorkspaceId: z.string().nullable(),
      adminSlackUserId: z.string().nullable(),
      createdAt: z.string(),
    })

    server.use(
      http.post('/api/tenants', async ({ request }) => {
        const body = (await request.json()) as { name: string; adminEmail: string }
        return HttpResponse.json({
          id: 'tenant-new',
          name: body.name,
          slackWorkspaceId: null,
          asanaWorkspaceId: null,
          adminSlackUserId: null,
          createdAt: new Date().toISOString(),
        })
      })
    )

    const result = await api.post(
      '/api/tenants',
      { name: 'New Tenant', adminEmail: 'admin@test.com' },
      {},
      TenantSchema
    )

    expect(result.id).toBe('tenant-new')
    expect(result.name).toBe('New Tenant')
  })

  it('handles OAuth URL response', async () => {
    server.use(
      http.post('/api/oauth/slack/authorize', () => {
        return HttpResponse.json({
          redirectUrl: 'https://slack.com/oauth/authorize?client_id=123&scope=chat:write',
        })
      })
    )

    const result = await api.post<{ redirectUrl: string }>(
      '/api/oauth/slack/authorize',
      { tenantId: 'tenant-123' }
    )

    expect(result.redirectUrl).toContain('slack.com/oauth')
    expect(result.redirectUrl).toContain('client_id')
  })
})
