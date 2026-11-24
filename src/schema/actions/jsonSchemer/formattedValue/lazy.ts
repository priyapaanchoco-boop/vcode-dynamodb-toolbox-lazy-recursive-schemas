import { DynamoDBToolboxError } from '~/errors/index.js'
import type { LazySchema } from '~/schema/index.js'

import type { JSONSchemerContext } from './context.js'
import { createJSONSchemerContext } from './context.js'
import { getFormattedValueJSONSchema } from './schema.js'

export type FormattedLazyJSONSchema = { $ref: string }

/**
 * Lazy schemas are output as references to definitions (`$defs`).
 * Lazy props (required, hidden) are handled by parent schemas, so definitions are shared by resolved schema.
 */
export const getFormattedLazyJSONSchema = (
  schema: LazySchema,
  context: JSONSchemerContext = createJSONSchemerContext()
): FormattedLazyJSONSchema => {
  // Follow lazy chains (lazy(() => lazy(() => ...)))
  const visitedLazySchemas = new Set<LazySchema>([schema])
  let target = schema.resolve()
  while (target.type === 'lazy') {
    if (visitedLazySchemas.has(target)) {
      throw new DynamoDBToolboxError('schema.lazy.invalidResolution', {
        message: 'Invalid lazy schema: Getter cannot resolve to itself.',
        path: undefined,
        payload: { received: target }
      })
    }

    visitedLazySchemas.add(target)
    target = target.resolve()
  }

  let ref = context.refs.get(target)
  if (ref === undefined) {
    ref = `lazy_${context.refs.size + 1}`
    // Registered BEFORE computing the definition so recursive references re-use it
    context.refs.set(target, ref)
    context.defs[ref] = getFormattedValueJSONSchema(target, context)
  }

  return { $ref: `#/$defs/${ref}` }
}
