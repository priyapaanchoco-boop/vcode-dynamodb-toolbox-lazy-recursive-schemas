import type { Schema } from '../types/index.js'
import type { LazySchema } from './schema.js'

/**
 * Schema returned by a LazySchema getter
 */
export type ResolvedLazySchema<SCHEMA extends LazySchema> =
  SCHEMA extends LazySchema<infer RESOLVED> ? RESOLVED : Schema
