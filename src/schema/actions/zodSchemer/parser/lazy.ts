import { z } from 'zod'

import type { LazySchema, TransformedValue, ValidValue } from '~/schema/index.js'
import type { Extends, If } from '~/types/index.js'

import type { WithValidate } from '../utils.js'
import { getZodSchemaCache, withValidate, withoutDefaults } from '../utils.js'
import { schemaZodParser } from './schema.js'
import type { ZodParserOptions } from './types.js'
import type { WithDefault, WithOptional } from './utils.js'
import { withDefault, withOptional } from './utils.js'

type LazyParsedValue<SCHEMA extends LazySchema, OPTIONS extends ZodParserOptions> = If<
  Extends<OPTIONS, { transform: false }>,
  ValidValue<SCHEMA, { defined: true; mode: OPTIONS['mode'] extends 'key' ? 'key' : 'put' }>,
  TransformedValue<SCHEMA, { defined: true; mode: OPTIONS['mode'] extends 'key' ? 'key' : 'put' }>
>

type LazyParserInput<SCHEMA extends LazySchema, OPTIONS extends ZodParserOptions> = ValidValue<
  SCHEMA,
  { defined: true; mode: OPTIONS['mode'] extends 'key' ? 'key' : 'put' }
>

// NOTE: Lazy schemas can be recursive, so the zod schema is typed from the value types (not structurally)
export type LazyZodParser<
  SCHEMA extends LazySchema,
  OPTIONS extends ZodParserOptions = {}
> = LazySchema extends SCHEMA
  ? z.ZodTypeAny
  : WithDefault<
      SCHEMA,
      OPTIONS,
      WithOptional<
        SCHEMA,
        OPTIONS,
        WithValidate<
          SCHEMA,
          z.ZodType<
            LazyParsedValue<SCHEMA, OPTIONS>,
            z.ZodTypeDef,
            LazyParserInput<SCHEMA, OPTIONS>
          >
        >
      >
    >

const cache = getZodSchemaCache()

export const lazyZodParser = (schema: LazySchema, options: ZodParserOptions = {}): z.ZodTypeAny => {
  const cachedZodParser = cache.get(schema, options)
  if (cachedZodParser !== undefined) {
    return cachedZodParser
  }

  let resolvedZodParser: z.ZodTypeAny | undefined

  const zodParser = withDefault(
    schema,
    options,
    withOptional(
      schema,
      options,
      withValidate(
        schema,
        z.lazy(
          () =>
            (resolvedZodParser ??= schemaZodParser(withoutDefaults(schema.resolve()), {
              ...options,
              defined: true
            }))
        )
      )
    )
  )

  cache.set(schema, options, zodParser)
  return zodParser
}
