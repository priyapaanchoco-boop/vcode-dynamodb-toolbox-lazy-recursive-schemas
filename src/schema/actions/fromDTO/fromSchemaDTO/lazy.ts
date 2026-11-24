import { DynamoDBToolboxError } from '~/errors/index.js'
import type { LazySchemaRefDTO } from '~/schema/actions/dto/index.js'
import type { Schema, SchemaProps } from '~/schema/index.js'
import type { LazySchema } from '~/schema/lazy/index.js'
import { lazy } from '~/schema/lazy/index.js'

import type { FromSchemaDTOContext } from './context.js'
import { createFromSchemaDTOContext } from './context.js'

/**
 * @debt feature "handle defaults, links & validators"
 */
export const fromLazySchemaRefDTO = (
  { $ref }: LazySchemaRefDTO,
  context: FromSchemaDTOContext = createFromSchemaDTOContext()
): LazySchema => {
  if (!Object.prototype.hasOwnProperty.call(context.defs, $ref)) {
    throw new DynamoDBToolboxError('actions.fromDTO.unknownSchemaRef', {
      message: `Unknown schema reference in DTO: '${$ref}'.`,
      payload: { ref: $ref }
    })
  }

  const existingLazySchema = context.lazySchemas.get($ref)
  if (existingLazySchema !== undefined) {
    return existingLazySchema
  }

  // Lazy props are stored in the definition
  const { required, hidden, key, savedAs } = context.defs[$ref] as SchemaProps
  const props: SchemaProps = {
    ...(required !== undefined && required !== 'atLeastOnce' ? { required } : {}),
    ...(hidden !== undefined && hidden ? { hidden } : {}),
    ...(key !== undefined && key ? { key } : {}),
    ...(savedAs !== undefined ? { savedAs } : {})
  }

  const lazySchema = lazy(() => context.schemas.get($ref) as Schema, props)
  context.lazySchemas.set($ref, lazySchema)

  return lazySchema
}
