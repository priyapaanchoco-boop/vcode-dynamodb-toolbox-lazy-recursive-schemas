import type { ItemSchema } from '~/schema/index.js'
import { SchemaAction } from '~/schema/index.js'

import { createSchemaDTOContext, getSchemaDTO } from './getSchemaDTO/index.js'
import type { ItemSchemaDTO, SchemaDefsDTO } from './types.js'

export class SchemaDTO<SCHEMA extends ItemSchema = ItemSchema>
  extends SchemaAction<SCHEMA>
  implements ItemSchemaDTO
{
  static override actionName = 'dto' as const

  type: ItemSchemaDTO['type']
  attributes: ItemSchemaDTO['attributes']
  $schema_defs?: SchemaDefsDTO

  constructor(schema: SCHEMA) {
    super(schema)
    this.type = 'item'

    const context = createSchemaDTOContext()
    this.attributes = Object.fromEntries(
      Object.entries(this.schema.attributes).map(([attributeName, attribute]) => [
        attributeName,
        getSchemaDTO(attribute, context)
      ])
    ) as ItemSchemaDTO['attributes']

    if (Object.keys(context.defs).length > 0) {
      this.$schema_defs = context.defs
    }
  }

  toJSON(): ItemSchemaDTO {
    return {
      type: this.type,
      attributes: this.attributes,
      ...(this.$schema_defs !== undefined ? { $schema_defs: this.$schema_defs } : {})
    }
  }
}
