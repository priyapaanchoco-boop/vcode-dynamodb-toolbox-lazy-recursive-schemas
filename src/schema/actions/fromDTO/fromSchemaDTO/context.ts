import type { SchemaDefsDTO } from '~/schema/actions/dto/index.js'
import type { Schema } from '~/schema/index.js'
import type { LazySchema } from '~/schema/lazy/index.js'

/**
 * Shared state while building a schema from a DTO:
 * - `defs`: Lazy schemas definitions (by reference)
 * - `schemas`: Built definitions (by reference), read by lazy schema getters
 * - `lazySchemas`: Lazy schemas (by reference): One instance per reference
 */
export interface FromSchemaDTOContext {
  defs: SchemaDefsDTO
  schemas: Map<string, Schema>
  lazySchemas: Map<string, LazySchema>
}

export const createFromSchemaDTOContext = (defs: SchemaDefsDTO = {}): FromSchemaDTOContext => ({
  defs,
  schemas: new Map(),
  lazySchemas: new Map()
})
