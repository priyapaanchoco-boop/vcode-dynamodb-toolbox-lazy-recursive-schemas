import type { AnyOfSchema } from '../anyOf/index.js'
import type { ItemSchema } from '../item/index.js'
import type { ListSchema } from '../list/index.js'
import type { MapSchema } from '../map/index.js'
import type { RecordSchema } from '../record/index.js'
import type { SetSchema } from '../set/index.js'
import type { Schema } from '../types/index.js'
import type { LazySchema } from './schema.js'

/**
 * Schema returned by a LazySchema getter
 */
export type ResolvedLazySchema<SCHEMA extends LazySchema> =
  SCHEMA extends LazySchema<infer RESOLVED> ? RESOLVED : Schema

/**
 * Whether or not a schema contains a lazy schema (does not traverse lazy schemas, so terminates on recursive schemas)
 */
export type ContainsLazySchema<SCHEMA extends Schema> = Schema extends SCHEMA
  ? boolean
  : SCHEMA extends LazySchema
    ? true
    : SCHEMA extends ListSchema | SetSchema | RecordSchema
      ? ContainsLazySchema<SCHEMA['elements']>
      : SCHEMA extends MapSchema | ItemSchema
        ? true extends {
            [KEY in keyof SCHEMA['attributes']]: ContainsLazySchema<SCHEMA['attributes'][KEY]>
          }[keyof SCHEMA['attributes']]
          ? true
          : false
        : SCHEMA extends AnyOfSchema
          ? true extends ContainsLazySchema<SCHEMA['elements'][number]>
            ? true
            : false
          : false
