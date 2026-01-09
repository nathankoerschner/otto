import { z } from 'zod'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  schema?: z.ZodSchema<T>
): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = endpoint
  if (params) {
    const searchParams = new URLSearchParams(params)
    url = `${endpoint}?${searchParams.toString()}`
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ApiError(response.status, errorBody || response.statusText)
  }

  const data: unknown = await response.json()

  if (schema) {
    return schema.parse(data)
  }

  return data as T
}

export const api = {
  get<T>(endpoint: string, options?: RequestOptions, schema?: z.ZodSchema<T>) {
    return request<T>(endpoint, { ...options, method: 'GET' }, schema)
  },

  post<T>(
    endpoint: string,
    body: unknown,
    options?: RequestOptions,
    schema?: z.ZodSchema<T>
  ) {
    return request<T>(
      endpoint,
      { ...options, method: 'POST', body: JSON.stringify(body) },
      schema
    )
  },

  put<T>(
    endpoint: string,
    body: unknown,
    options?: RequestOptions,
    schema?: z.ZodSchema<T>
  ) {
    return request<T>(
      endpoint,
      { ...options, method: 'PUT', body: JSON.stringify(body) },
      schema
    )
  },

  delete<T>(
    endpoint: string,
    options?: RequestOptions,
    schema?: z.ZodSchema<T>
  ) {
    return request<T>(endpoint, { ...options, method: 'DELETE' }, schema)
  },
}
