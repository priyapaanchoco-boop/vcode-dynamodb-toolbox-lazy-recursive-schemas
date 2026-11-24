import type { LazySchema } from '~/schema/index.js'

import type { ParseAttrValueOptions } from './options.js'
import type { ParserReturn, ParserYield } from './parser.js'
import { schemaParser } from './schema.js'
import { applyCustomValidation } from './utils.js'

/**
 * Defaults, links & `required` checks have already been applied with the lazy props (in `schemaParser`).
 * We delegate the rest to the resolved schema, and apply the lazy custom validators on top.
 */
export function* lazySchemaParser<OPTIONS extends ParseAttrValueOptions = {}>(
  schema: LazySchema,
  inputValue: unknown,
  options: OPTIONS = {} as OPTIONS
): Generator<ParserYield<LazySchema, OPTIONS>, ParserReturn<LazySchema, OPTIONS>> {
  const { fill = true, transform = true } = options

  const parser: Generator<any, any> = schemaParser(schema.resolve(), inputValue, options)

  if (fill) {
    const defaultedValue = parser.next().value
    const itemInput = yield defaultedValue

    const linkedValue = parser.next(itemInput).value
    yield linkedValue
  }

  const parsedValue = parser.next().value
  applyCustomValidation(schema, parsedValue, options)

  if (transform) {
    yield parsedValue
  } else {
    return parsedValue
  }

  const transformedValue = parser.next().value
  return transformedValue
}
