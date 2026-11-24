import type { ItemSchemaDTO } from '~/schema/actions/dto/index.js'
import { item } from '~/schema/item/index.js'
import type { ItemSchema } from '~/schema/item/index.js'

import {
  fromSchemaDTO as _fromSchemaDTO,
  createFromSchemaDTOContext
} from './fromSchemaDTO/index.js'

export const fromSchemaDTO = (schemaDTO: ItemSchemaDTO): ItemSchema => {
  const context = createFromSchemaDTOContext(schemaDTO.$schema_defs)

  // Definitions are built eagerly (once each): Nested refs are lazy so this cannot loop,
  // and unknown refs (at any depth) throw right away
  for (const [ref, defDTO] of Object.entries(context.defs)) {
    context.schemas.set(ref, _fromSchemaDTO(defDTO, context))
  }

  return item(
    Object.fromEntries(
      Object.entries(schemaDTO.attributes).map(([attributeName, attributeDTO]) => [
        attributeName,
        _fromSchemaDTO(attributeDTO, context)
      ])
    )
  )
}
