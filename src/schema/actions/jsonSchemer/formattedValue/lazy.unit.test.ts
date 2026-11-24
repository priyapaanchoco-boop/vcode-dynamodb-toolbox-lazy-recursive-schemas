import type { A } from 'ts-toolbelt'

import type { MapSchema } from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'

import { JSONSchemer } from '../jsonSchemer.js'

const node = map({
  value: number(),
  children: list(lazy((): MapSchema => node))
})

describe('jsonSchemer - formattedLazy', () => {
  test('outputs refs & root $defs for recursive schemas', () => {
    const schema = item({
      id: string(),
      tree: lazy((): MapSchema => node).optional(),
      hidden: lazy((): MapSchema => node).hidden()
    })

    const JSONSchema = schema.build(JSONSchemer).formattedValueSchema()

    const assertDefs: A.Equals<
      (typeof JSONSchema)['$defs'],
      Record<string, Record<string, unknown>>
    > = 1
    assertDefs

    expect(JSONSchema).toStrictEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        // Lazy props decide required & hidden
        tree: { $ref: '#/$defs/lazy_1' }
      },
      required: ['id'],
      $defs: {
        // One definition per resolved schema
        lazy_1: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            children: { type: 'array', items: { $ref: '#/$defs/lazy_1' } }
          },
          required: ['value', 'children']
        }
      }
    })
  })

  test('does not add $defs if there are no lazy schemas', () => {
    const JSONSchema = item({ id: string() }).build(JSONSchemer).formattedValueSchema()

    const assertJSONSchema: A.Equals<
      typeof JSONSchema,
      { type: 'object'; properties: { id: { type: 'string' } }; required: 'id'[] }
    > = 1
    assertJSONSchema

    expect(JSONSchema).toStrictEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    })
  })

  test('works on mutually recursive schemas & lazy root schemas', () => {
    const author = map({ name: string(), books: list(lazy((): MapSchema => book)) })
    const book = map({ title: string(), author: lazy((): MapSchema => author).optional() })

    expect(
      lazy(() => book)
        .build(JSONSchemer)
        .formattedValueSchema()
    ).toStrictEqual({
      $ref: '#/$defs/lazy_1',
      $defs: {
        lazy_1: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            author: { $ref: '#/$defs/lazy_2' }
          },
          required: ['title']
        },
        lazy_2: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            books: { type: 'array', items: { $ref: '#/$defs/lazy_1' } }
          },
          required: ['name', 'books']
        }
      }
    })
  })
})
