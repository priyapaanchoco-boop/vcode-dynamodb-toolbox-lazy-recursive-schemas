import type { ErrorBlueprint } from '~/errors/blueprint.js'

type UnknownSchemaRefErrorBlueprint = ErrorBlueprint<{
  code: 'actions.fromDTO.unknownSchemaRef'
  hasPath: false
  payload: { ref: string }
}>

export type FromDTOErrorBlueprints = UnknownSchemaRefErrorBlueprint
