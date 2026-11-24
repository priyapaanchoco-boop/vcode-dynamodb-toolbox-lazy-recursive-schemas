import { DynamoDBToolboxError } from '~/errors/index.js'
import type { Schema } from '~/schema/index.js'
import type { LazySchema } from '~/schema/lazy/index.js'

import type { LazySchemaRefDTO, NonRefSchemaDTO } from '../types.js'
import type { SchemaDTOContext } from './context.js'
import { createSchemaDTOContext } from './context.js'
import { getSchemaDTO } from './schema.js'
import { getDefaultsDTO } from './utils.js'

// Props decided by the lazy schema (they take precedence over the resolved schema ones)
const lazyPropKeys = [
  'required',
  'hidden',
  'key',
  'savedAs',
  'keyDefault',
  'putDefault',
  'updateDefault',
  'keyLink',
  'putLink',
  'updateLink'
] as const

/**
 * Lazy schemas are serialized as references: `{ $ref }`
 * The definition (resolved schema DTO with lazy props) is stored in `context.defs`
 */
export const getLazySchemaDTO = (
  schema: LazySchema,
  context: SchemaDTOContext = createSchemaDTOContext()
): LazySchemaRefDTO => {
  const existingRef = context.refs.get(schema)
  if (existingRef !== undefined) {
    return { $ref: existingRef }
  }

  const ref = `lazy_${context.refs.size + 1}`
  // Registered BEFORE serializing the resolved schema so recursive references re-use it
  context.refs.set(schema, ref)

  const resolvedDTO = getSchemaDTO(getTargetSchema(schema), context) as NonRefSchemaDTO

  const defDTO: Record<string, unknown> = { ...resolvedDTO }
  for (const propKey of lazyPropKeys) {
    delete defDTO[propKey]
  }

  const { required, hidden, key, savedAs } = schema.props
  Object.assign(defDTO, {
    ...(required !== undefined && required !== 'atLeastOnce' ? { required } : {}),
    ...(hidden !== undefined && hidden ? { hidden } : {}),
    ...(key !== undefined && key ? { key } : {}),
    ...(savedAs !== undefined ? { savedAs } : {}),
    ...getDefaultsDTO(schema)
  })

  context.defs[ref] = defDTO as unknown as NonRefSchemaDTO

  return { $ref: ref }
}

/**
 * Follows lazy chains (lazy(() => lazy(() => ...))) until a non-lazy schema is found
 */
const getTargetSchema = (schema: LazySchema): Exclude<Schema, LazySchema> => {
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

  return target
}
