import { z } from 'zod'

import type { DecodedValue, FormattedValue, LazySchema, TransformedValue } from '~/schema/index.js'
import type { Extends, If } from '~/types/index.js'

import type { WithValidate } from '../utils.js'
import { getZodSchemaCache, withValidate } from '../utils.js'
import { schemaZodFormatter } from './schema.js'
import type { ZodFormatterOptions } from './types.js'
import type { WithOptional } from './utils.js'
import { withOptional } from './utils.js'

type LazyFormatterInput<SCHEMA extends LazySchema, OPTIONS extends ZodFormatterOptions> = If<
  Extends<OPTIONS, { transform: false }>,
  Exclude<DecodedValue<SCHEMA>, undefined>,
  TransformedValue<SCHEMA, { defined: true }>
>

type LazyFormattedValue<SCHEMA extends LazySchema, OPTIONS extends ZodFormatterOptions> = If<
  Extends<OPTIONS, { format: false }>,
  Exclude<DecodedValue<SCHEMA>, undefined>,
  Exclude<FormattedValue<SCHEMA>, undefined>
>

// NOTE: Lazy schemas can be recursive, so the zod schema is typed from the value types (not structurally)
export type LazyZodFormatter<
  SCHEMA extends LazySchema,
  OPTIONS extends ZodFormatterOptions = {}
> = LazySchema extends SCHEMA
  ? z.ZodTypeAny
  : WithOptional<
      SCHEMA,
      OPTIONS,
      WithValidate<
        SCHEMA,
        z.ZodType<
          LazyFormattedValue<SCHEMA, OPTIONS>,
          z.ZodTypeDef,
          LazyFormatterInput<SCHEMA, OPTIONS>
        >
      >
    >

const cache = getZodSchemaCache()

export const lazyZodFormatter = (
  schema: LazySchema,
  options: ZodFormatterOptions = {}
): z.ZodTypeAny => {
  const cachedZodFormatter = cache.get(schema, options)
  if (cachedZodFormatter !== undefined) {
    return cachedZodFormatter
  }

  let resolvedZodFormatter: z.ZodTypeAny | undefined

  const zodFormatter = withOptional(
    schema,
    options,
    withValidate(
      schema,
      z.lazy(
        () =>
          (resolvedZodFormatter ??= schemaZodFormatter(schema.resolve(), {
            ...options,
            defined: true
          }))
      )
    )
  )

  cache.set(schema, options, zodFormatter)
  return zodFormatter
}
