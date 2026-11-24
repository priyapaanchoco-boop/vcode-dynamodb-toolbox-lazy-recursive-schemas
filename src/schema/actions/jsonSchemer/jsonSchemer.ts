import type { ContainsLazySchema, Schema } from '~/schema/index.js'
import { SchemaAction } from '~/schema/index.js'
import type { ComputeObject } from '~/types/computeObject.js'

import { createJSONSchemerContext, getFormattedValueJSONSchema } from './formattedValue/index.js'
import type { FormattedValueJSONSchema } from './formattedValue/index.js'

/**
 * Lazy schemas are output as `{ $ref: '#/$defs/...' }`: Definitions are added at the root of the JSON schema
 */
export type FormattedValueRootJSONSchema<SCHEMA extends Schema> =
  ContainsLazySchema<SCHEMA> extends true
    ? ComputeObject<
        FormattedValueJSONSchema<SCHEMA> & { $defs: Record<string, Record<string, unknown>> }
      >
    : FormattedValueJSONSchema<SCHEMA>

export class JSONSchemer<SCHEMA extends Schema = Schema> extends SchemaAction<SCHEMA> {
  static override actionName = 'jsonSchemer' as const

  formattedValueSchema(): FormattedValueRootJSONSchema<SCHEMA> {
    const context = createJSONSchemerContext()
    const jsonSchema = getFormattedValueJSONSchema(this.schema, context)

    if (Object.keys(context.defs).length === 0) {
      return jsonSchema as FormattedValueRootJSONSchema<SCHEMA>
    }

    return { ...jsonSchema, $defs: context.defs } as FormattedValueRootJSONSchema<SCHEMA>
  }
}
