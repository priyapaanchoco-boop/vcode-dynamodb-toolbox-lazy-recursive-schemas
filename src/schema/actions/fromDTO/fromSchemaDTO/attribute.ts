import type { ISchemaDTO } from '~/schema/actions/dto/index.js'
import type { Schema } from '~/schema/index.js'

import { fromAnySchemaDTO } from './any.js'
import { fromAnyOfSchemaDTO } from './anyOf.js'
import type { FromSchemaDTOContext } from './context.js'
import { createFromSchemaDTOContext } from './context.js'
import { fromItemSchemaDTO } from './item.js'
import { fromLazySchemaRefDTO } from './lazy.js'
import { fromListSchemaDTO } from './list.js'
import { fromMapSchemaDTO } from './map.js'
import { fromPrimitiveSchemaDTO } from './primitive.js'
import { fromRecordSchemaDTO } from './record.js'
import { fromSetSchemaDTO } from './set.js'

export const fromSchemaDTO = (
  schemaDTO: ISchemaDTO,
  context: FromSchemaDTOContext = createFromSchemaDTOContext()
): Schema => {
  if ('$ref' in schemaDTO) {
    return fromLazySchemaRefDTO(schemaDTO, context)
  }

  switch (schemaDTO.type) {
    case 'any':
      return fromAnySchemaDTO(schemaDTO)
    case 'null':
    case 'boolean':
    case 'number':
    case 'string':
    case 'binary':
      return fromPrimitiveSchemaDTO(schemaDTO)
    case 'set':
      return fromSetSchemaDTO(schemaDTO, context)
    case 'list':
      return fromListSchemaDTO(schemaDTO, context)
    case 'map':
      return fromMapSchemaDTO(schemaDTO, context)
    case 'record':
      return fromRecordSchemaDTO(schemaDTO, context)
    case 'anyOf':
      return fromAnyOfSchemaDTO(schemaDTO, context)
    case 'item':
      return fromItemSchemaDTO(schemaDTO, context)
  }
}
