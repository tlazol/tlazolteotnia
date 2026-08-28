import { notFound } from '@tanstack/react-router'

export function requireRouteData<T>(value: T | null | undefined): T {
  if (value == null) throw notFound()
  return value
}
