import type { SetSchema } from '~/schema/set/index.js'

import type { SetSchemaDTO } from '../types.js'
import type { SchemaDTOContext } from './context.js'
import { createSchemaDTOContext } from './context.js'
import { getSchemaDTO } from './schema.js'
import { getDefaultsDTO } from './utils.js'

/**
 * @debt feature "handle defaults, links & validators DTOs"
 */
export const getSetSchemaDTO = (
  schema: SetSchema,
  context: SchemaDTOContext = createSchemaDTOContext()
): SetSchemaDTO => {
  const defaultsDTO = getDefaultsDTO(schema)
  const { required, hidden, key, savedAs } = schema.props

  return {
    type: schema.type,
    elements: getSchemaDTO(schema.elements, context) as SetSchemaDTO['elements'],
    ...(required !== undefined && required !== 'atLeastOnce' ? { required } : {}),
    ...(hidden !== undefined && hidden ? { hidden } : {}),
    ...(key !== undefined && key ? { key } : {}),
    ...(savedAs !== undefined ? { savedAs } : {}),
    ...defaultsDTO
  }
}
