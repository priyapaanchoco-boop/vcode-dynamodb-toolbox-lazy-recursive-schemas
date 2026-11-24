import { DynamoDBToolboxError } from '~/errors/index.js'
import { SchemaDTO } from '~/schema/actions/dto/index.js'
import type { ItemSchemaDTO } from '~/schema/actions/dto/index.js'
import { Formatter } from '~/schema/actions/format/index.js'
import { Parser } from '~/schema/actions/parse/index.js'
import type { AnyOfSchema, ItemSchema, MapSchema } from '~/schema/index.js'
import { anyOf, item, lazy, list, map, number, string } from '~/schema/index.js'

import { fromSchemaDTO } from './fromSchemaDTO.js'

const node = map({
  value: number().savedAs('v'),
  children: list(lazy((): MapSchema => node))
})

const treeItem = item({
  id: string().key(),
  tree: lazy((): MapSchema => node)
    .savedAs('t')
    .optional()
})

const toJSONDTO = <SCHEMA extends ItemSchema>(schema: SCHEMA): ItemSchemaDTO =>
  JSON.parse(JSON.stringify(new SchemaDTO(schema))) as ItemSchemaDTO

/**
 * Collects every object containing a `$ref` key in a DTO
 */
const collectRefs = (value: unknown, refs: Record<string, unknown>[] = []) => {
  if (typeof value === 'object' && value !== null) {
    if ('$ref' in value) {
      refs.push(value as Record<string, unknown>)
    }

    Object.values(value).forEach(child => collectRefs(child, refs))
  }

  return refs
}

describe('DTO - lazy schemas', () => {
  describe('serialization', () => {
    test('serializes lazy schemas as bare refs & stores definitions in $schema_defs', () => {
      expect(toJSONDTO(treeItem)).toStrictEqual({
        type: 'item',
        attributes: {
          id: { type: 'string', key: true, required: 'always' },
          tree: { $ref: 'lazy_1' }
        },
        $schema_defs: {
          // Lazy props (savedAs, required) are stored in the definition
          lazy_1: {
            type: 'map',
            attributes: {
              value: { type: 'number', savedAs: 'v' },
              children: { type: 'list', elements: { $ref: 'lazy_2' } }
            },
            required: 'never',
            savedAs: 't'
          },
          lazy_2: {
            type: 'map',
            attributes: {
              value: { type: 'number', savedAs: 'v' },
              children: { type: 'list', elements: { $ref: 'lazy_2' } }
            }
          }
        }
      })
    })

    test('refs are bare objects (only a $ref key, no type)', () => {
      const refs = collectRefs(toJSONDTO(treeItem))

      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) {
        expect(Object.keys(ref)).toStrictEqual(['$ref'])
      }
    })

    test('does not add $schema_defs if there are no lazy schemas', () => {
      expect(toJSONDTO(item({ id: string() }))).toStrictEqual({
        type: 'item',
        attributes: { id: { type: 'string' } }
      })
    })

    test('lazy props override resolved schema props', () => {
      const renamedStr = string().savedAs('resolvedSavedAs').optional()

      expect(toJSONDTO(item({ str: lazy(() => renamedStr).hidden() }))).toStrictEqual({
        type: 'item',
        attributes: { str: { $ref: 'lazy_1' } },
        $schema_defs: { lazy_1: { type: 'string', hidden: true } }
      })
    })
  })

  describe('deserialization', () => {
    test('parses & formats the same as the original schema', () => {
      const deserialized = fromSchemaDTO(toJSONDTO(treeItem))

      const input = {
        id: 'a',
        tree: { value: 1, children: [{ value: 2, children: [{ value: 3, children: [] }] }] }
      }
      const parsed = treeItem.build(Parser).parse(input)

      expect(new Parser(deserialized).parse(input)).toStrictEqual(parsed)
      expect(new Parser(deserialized).parse({ id: 'a' })).toStrictEqual(
        treeItem.build(Parser).parse({ id: 'a' })
      )
      expect(new Formatter(deserialized).format(parsed)).toStrictEqual(
        treeItem.build(Formatter).format(parsed)
      )

      const invalidInput = {
        id: 'a',
        tree: { value: 1, children: [{ value: 2, children: [{ value: 'three', children: [] }] }] }
      }
      const expectedError = expect.objectContaining({
        code: 'parsing.invalidAttributeInput',
        path: 'tree.children[0].children[0].value'
      })
      expect(() => treeItem.build(Parser).parse(invalidInput)).toThrow(expectedError)
      expect(() => new Parser(deserialized).parse(invalidInput)).toThrow(expectedError)
    })

    test('deserialized schema passes check & re-serializes identically', () => {
      const dto = toJSONDTO(treeItem)
      const deserialized = fromSchemaDTO(dto)

      expect(() => deserialized.check()).not.toThrow()
      expect(toJSONDTO(deserialized)).toStrictEqual(dto)
    })

    test('works on mutually recursive & discriminated anyOf schemas', () => {
      const author = map({
        name: string(),
        books: list(lazy((): MapSchema => book))
      })
      const book = map({
        title: string(),
        author: lazy((): MapSchema => author).optional()
      })
      const expr = anyOf(
        map({ kind: string().enum('num'), value: number() }),
        map({ kind: string().enum('add'), operands: list(lazy((): AnyOfSchema => expr)) })
      ).discriminate('kind')

      const schema = item({ book, expr })
      const deserialized = fromSchemaDTO(toJSONDTO(schema))

      const input = {
        book: {
          title: 'a',
          author: { name: 'b', books: [{ title: 'c', author: { name: 'd', books: [] } }] }
        },
        expr: {
          kind: 'add',
          operands: [
            { kind: 'num', value: 1 },
            { kind: 'add', operands: [{ kind: 'num', value: 2 }] }
          ]
        }
      }

      expect(new Parser(deserialized).parse(input)).toStrictEqual(schema.build(Parser).parse(input))

      const invalidInput = {
        ...input,
        expr: { kind: 'add', operands: [{ kind: 'add', operands: [{ kind: 'num', value: 'x' }] }] }
      }
      expect(() => schema.build(Parser).parse(invalidInput)).toThrow(DynamoDBToolboxError)
      expect(() => new Parser(deserialized).parse(invalidInput)).toThrow(DynamoDBToolboxError)
    })

    test('throws on unknown refs (root attribute)', () => {
      const invalidCall = () =>
        fromSchemaDTO({ type: 'item', attributes: { tree: { $ref: 'unknown' } } })

      expect(invalidCall).toThrow(DynamoDBToolboxError)
      expect(invalidCall).toThrow(
        expect.objectContaining({
          code: 'actions.fromDTO.unknownSchemaRef',
          payload: { ref: 'unknown' }
        })
      )
    })

    test('throws on unknown refs (deep, inside definitions)', () => {
      const invalidCall = () =>
        fromSchemaDTO({
          type: 'item',
          attributes: { tree: { $ref: 'lazy_1' } },
          $schema_defs: {
            lazy_1: {
              type: 'map',
              attributes: {
                children: {
                  type: 'list',
                  elements: { type: 'map', attributes: { deep: { $ref: 'unknown' } } }
                }
              }
            }
          }
        })

      expect(invalidCall).toThrow(
        expect.objectContaining({
          code: 'actions.fromDTO.unknownSchemaRef',
          payload: { ref: 'unknown' }
        })
      )
    })

    test('supports refs colliding with Object.prototype keys', () => {
      const deserialized = fromSchemaDTO({
        type: 'item',
        attributes: { str: { $ref: 'constructor' } },
        $schema_defs: { constructor: { type: 'string' as const } }
      })

      expect(new Parser(deserialized).parse({ str: 'a' })).toStrictEqual({ str: 'a' })
    })

    test('does not resolve inherited object keys as refs', () => {
      const invalidCall = () =>
        fromSchemaDTO({ type: 'item', attributes: { tree: { $ref: 'constructor' } } })

      expect(invalidCall).toThrow(
        expect.objectContaining({ code: 'actions.fromDTO.unknownSchemaRef' })
      )
    })
  })
})
