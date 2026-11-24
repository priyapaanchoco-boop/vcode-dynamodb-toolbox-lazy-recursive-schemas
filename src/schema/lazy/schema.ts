import { DynamoDBToolboxError } from '~/errors/index.js'
import { isFunction } from '~/utils/validation/isFunction.js'
import { isObject } from '~/utils/validation/isObject.js'

import type { Schema, SchemaProps } from '../types/index.js'
import { checkSchemaProps } from '../utils/checkSchemaProps.js'
import { $resolution } from './constants.js'

interface LazyResolution<TARGET extends Schema> {
  resolved: boolean
  schema?: TARGET
  // Prevents infinite loops when checking recursive schemas
  checking: boolean
}

const schemaTypes = new Set<string>([
  'any',
  'null',
  'boolean',
  'number',
  'string',
  'binary',
  'set',
  'list',
  'map',
  'record',
  'anyOf',
  'lazy',
  'item'
])

const isSchema = (candidate: unknown): candidate is Schema =>
  isObject(candidate) &&
  schemaTypes.has((candidate as { type?: unknown }).type as string) &&
  isObject((candidate as { props?: unknown }).props) &&
  isFunction((candidate as { check?: unknown }).check)

export class LazySchema<TARGET extends Schema = Schema, PROPS extends SchemaProps = SchemaProps> {
  type: 'lazy'
  getter: () => TARGET
  props: PROPS;

  // Mutable holder: The schema itself can get frozen by parent `check` calls
  [$resolution]: LazyResolution<TARGET>

  constructor(getter: () => TARGET, props: PROPS) {
    this.type = 'lazy'
    this.getter = getter
    this.props = props

    this[$resolution] = { resolved: false, checking: false }
  }

  /**
   * Run the getter (only once) and return the resulting schema
   */
  resolve(): TARGET {
    const resolution = this[$resolution]

    if (!resolution.resolved) {
      resolution.schema = this.getter()
      resolution.resolved = true
    }

    return resolution.schema as TARGET
  }

  get checked(): boolean {
    return Object.isFrozen(this.props)
  }

  check(path?: string): void {
    const resolution = this[$resolution]

    if (this.checked || resolution.checking) {
      return
    }

    checkSchemaProps(this.props, path)

    // Validate the whole chain of lazy schemas (lazy(() => lazy(() => ...)))
    const visitedLazySchemas = new Set<LazySchema>([this])
    let resolved: unknown = this.resolve()

    for (;;) {
      if (!isSchema(resolved)) {
        throw new DynamoDBToolboxError('schema.lazy.invalidResolution', {
          message: `Invalid lazy schema${
            path !== undefined ? ` at path '${path}'` : ''
          }: Getter must return a schema.`,
          path,
          payload: { received: resolved }
        })
      }

      if (resolved.type !== 'lazy') {
        break
      }

      if (visitedLazySchemas.has(resolved)) {
        throw new DynamoDBToolboxError('schema.lazy.invalidResolution', {
          message: `Invalid lazy schema${
            path !== undefined ? ` at path '${path}'` : ''
          }: Getter cannot resolve to itself.`,
          path,
          payload: { received: resolved }
        })
      }

      visitedLazySchemas.add(resolved)
      resolved = resolved.resolve()
    }

    resolution.checking = true
    try {
      this.resolve().check(path)
    } finally {
      resolution.checking = false
    }

    Object.freeze(this.props)
  }
}
