import type { z } from 'zod'

import type { ItemSchema, MapSchema, Schema, Validator } from '~/schema/index.js'
import type { Extends, If, Or } from '~/types/index.js'

export type SavedAsAttributes<SCHEMA extends MapSchema | ItemSchema> = {
  [KEY in keyof SCHEMA['attributes']]: SCHEMA['attributes'][KEY]['props'] extends {
    savedAs: string
  }
    ? KEY
    : never
}[keyof SCHEMA['attributes']]

export type WithValidate<SCHEMA extends Schema, ZOD_SCHEMA extends z.ZodTypeAny> = If<
  Or<
    Extends<SCHEMA['props'], { key: true; keyValidator: Validator }>,
    Extends<SCHEMA['props'], { key?: false; putValidator: Validator }>
  >,
  z.ZodEffects<ZOD_SCHEMA, z.output<ZOD_SCHEMA>, z.input<ZOD_SCHEMA>>,
  ZOD_SCHEMA
>

export const withValidate = (schema: Schema, zodSchema: z.ZodTypeAny): z.ZodTypeAny => {
  const { key = false, keyValidator, putValidator } = schema.props

  if (key && keyValidator !== undefined) {
    return zodSchema.refine(input => keyValidator(input, schema))
  }

  if (!key && putValidator !== undefined) {
    return zodSchema.refine(input => putValidator(input, schema))
  }

  return zodSchema
}

const defaultPropKeys = ['keyDefault', 'putDefault', 'updateDefault'] as const

/**
 * Lazy props take precedence over the resolved schema ones: Returns a shallow copy of the schema without defaults
 */
export const withoutDefaults = <SCHEMA extends Schema>(schema: SCHEMA): SCHEMA => {
  if (defaultPropKeys.every(propKey => schema.props[propKey] === undefined)) {
    return schema
  }

  const props: Record<string, unknown> = { ...schema.props }
  for (const propKey of defaultPropKeys) {
    delete props[propKey]
  }

  return Object.assign(Object.create(Object.getPrototypeOf(schema) as object) as SCHEMA, schema, {
    props
  })
}

/**
 * Caches zod schemas by lazy schema & options: Recursive references re-use the same zod schema
 */
export const getZodSchemaCache = () => {
  const cache = new WeakMap<Schema, Map<string, z.ZodTypeAny>>()

  return {
    get: (schema: Schema, options: object): z.ZodTypeAny | undefined =>
      cache.get(schema)?.get(JSON.stringify(options)),
    set: (schema: Schema, options: object, zodSchema: z.ZodTypeAny): void => {
      let schemaCache = cache.get(schema)
      if (schemaCache === undefined) {
        schemaCache = new Map()
        cache.set(schema, schemaCache)
      }
      schemaCache.set(JSON.stringify(options), zodSchema)
    }
  }
}
