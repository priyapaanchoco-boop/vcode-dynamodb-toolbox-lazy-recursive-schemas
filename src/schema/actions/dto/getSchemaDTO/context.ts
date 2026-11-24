import type { LazySchema } from '~/schema/lazy/index.js'

import type { SchemaDefsDTO } from '../types.js'

/**
 * Shared state while building a schema DTO: Lazy schemas are serialized as `{ $ref }`,
 * their definitions being collected (once per lazy schema) in `defs`.
 */
export interface SchemaDTOContext {
  defs: SchemaDefsDTO
  refs: Map<LazySchema, string>
}

export const createSchemaDTOContext = (): SchemaDTOContext => ({ defs: {}, refs: new Map() })
