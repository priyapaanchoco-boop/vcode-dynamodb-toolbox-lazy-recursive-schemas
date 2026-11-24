import type { Schema } from '~/schema/index.js'

import type { ISchemaDTO } from '../types.js'
import { getAnySchemaDTO } from './any.js'
import { getAnyOfSchemaDTO } from './anyOf.js'
import type { SchemaDTOContext } from './context.js'
import { createSchemaDTOContext } from './context.js'
import { getItemSchemaDTO } from './item.js'
import { getLazySchemaDTO } from './lazy.js'
import { getListSchemaDTO } from './list.js'
import { getMapSchemaDTO } from './map.js'
import { getPrimitiveSchemaDTO } from './primitive.js'
import { getRecordSchemaDTO } from './record.js'
import { getSetSchemaDTO } from './set.js'

export const getSchemaDTO = (
  schema: Schema,
  context: SchemaDTOContext = createSchemaDTOContext()
): ISchemaDTO => {
  /**
   * @debt feature "handle defaults, links & validators"
   */
  switch (schema.type) {
    case 'any':
      return getAnySchemaDTO(schema)
    case 'null':
    case 'boolean':
    case 'number':
    case 'string':
    case 'binary':
      return getPrimitiveSchemaDTO(schema)
    case 'set':
      return getSetSchemaDTO(schema, context)
    case 'list':
      return getListSchemaDTO(schema, context)
    case 'map':
      return getMapSchemaDTO(schema, context)
    case 'record':
      return getRecordSchemaDTO(schema, context)
    case 'anyOf':
      return getAnyOfSchemaDTO(schema, context)
    case 'lazy':
      return getLazySchemaDTO(schema, context)
    case 'item':
      return getItemSchemaDTO(schema, context)
  }
}
