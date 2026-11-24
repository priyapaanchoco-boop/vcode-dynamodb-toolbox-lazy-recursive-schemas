import type { Schema } from '~/schema/index.js'

/**
 * Shared state while building a JSON schema: Lazy schemas are output as `{ $ref }`,
 * their definitions being collected in `defs` (once per resolved schema).
 */
export interface JSONSchemerContext {
  defs: Record<string, Record<string, unknown>>
  refs: Map<Schema, string>
}

export const createJSONSchemerContext = (): JSONSchemerContext => ({ defs: {}, refs: new Map() })
