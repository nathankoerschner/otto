import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
  it('should merge single class', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('should merge multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('should handle true conditionals', () => {
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz')
  })

  it('should handle undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('should handle null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar')
  })

  it('should merge conflicting tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('should handle object syntax', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('should handle array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('should handle complex tailwind merging', () => {
    expect(cn('px-4 py-2', 'px-2')).toBe('py-2 px-2')
  })

  it('should merge text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('should handle mixed inputs', () => {
    const isActive = true
    const isDisabled = false
    expect(
      cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled',
        { conditional: true }
      )
    ).toBe('base-class active conditional')
  })
})
