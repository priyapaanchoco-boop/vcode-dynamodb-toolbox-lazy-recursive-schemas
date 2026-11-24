import type { A } from 'ts-toolbelt'
import type { z } from 'zod'

import { Formatter } from '~/schema/actions/format/index.js'
import { Parser } from '~/schema/actions/parse/index.js'
import type {
  LazySchema,
  ListSchema,
  MapSchema,
  NumberSchema,
  StringSchema
} from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'
import { prefix } from '~/transformers/prefix.js'

import { ZodSchemer } from './zodSchemer.js'

const labelPrefix = prefix('L')

type NodeSchema = MapSchema<
  {
    value: NumberSchema<{ savedAs: 'v' }>
    label: StringSchema<{ transform: typeof labelPrefix }>
    children: ListSchema<LazySchema<NodeSchema, {}>, {}>
  },
  {}
>

const node = map({
  value: number().savedAs('v'),
  label: string().transform(labelPrefix),
  children: list(lazy((): NodeSchema => node))
})

const schema = item({
  id: string(),
  tree: lazy((): NodeSchema => node)
    .savedAs('t')
    .optional()
})

const input = {
  id: 'a',
  tree: {
    value: 1,
    label: 'a',
    children: [{ value: 2, label: 'b', children: [{ value: 3, label: 'c', children: [] }] }]
  }
}

const invalidInput = {
  id: 'a',
  tree: {
    value: 1,
    label: 'a',
    children: [{ value: 2, label: 'b', children: [{ value: 'three', label: 'c', children: [] }] }]
  }
}

describe('zodSchemer > lazy', () => {
  describe('parser', () => {
    test('parses recursive values like the Parser action', () => {
      const zodParser = schema.build(ZodSchemer).parser()

      expect(zodParser.parse(input)).toStrictEqual(schema.build(Parser).parse(input))
      // NOTE: Existing zod schemer behavior: Missing optional savedAs attributes are output as undefined
      expect(zodParser.parse({ id: 'a' })).toEqual({ id: 'a' })
      expect(zodParser.safeParse(invalidInput).success).toBe(false)
    })

    test('infers recursive types', () => {
      const zodParser = schema.build(ZodSchemer).parser({ transform: false })
      type Parsed = z.infer<typeof zodParser>
      type Tree = NonNullable<Parsed['tree']>

      const assertDeep: A.Equals<Tree['children'][number]['children'][number]['value'], number> = 1
      assertDeep

      const assertOptional: A.Contains<undefined, Parsed['tree']> = 1
      assertOptional

      expect(zodParser.parse(input)).toStrictEqual(input)
    })

    test('lazy props take precedence over resolved schema props', () => {
      const optionalDefaultedStr = string().optional().putDefault('resolvedDefault')
      const lazySchema = item({ str: lazy(() => optionalDefaultedStr) })

      // Resolved schema is optional & defaulted, but lazy is required
      expect(lazySchema.build(ZodSchemer).parser().safeParse({}).success).toBe(false)
      expect(() => lazySchema.build(Parser).parse({})).toThrow()

      const defaultedZodParser = item({ str: lazy(() => string()).putDefault('lazyDefault') })
        .build(ZodSchemer)
        .parser()
      expect(defaultedZodParser.parse({})).toStrictEqual({ str: 'lazyDefault' })
    })

    test('applies lazy validators', () => {
      const zodParser = item({
        str: lazy(() => string()).putValidate(value => value !== 'forbidden')
      })
        .build(ZodSchemer)
        .parser()

      expect(zodParser.parse({ str: 'ok' })).toStrictEqual({ str: 'ok' })
      expect(zodParser.safeParse({ str: 'forbidden' }).success).toBe(false)
    })
  })

  describe('formatter', () => {
    test('formats recursive values like the Formatter action', () => {
      const transformed = schema.build(Parser).parse(input)
      const zodFormatter = schema.build(ZodSchemer).formatter()

      expect(zodFormatter.parse(transformed)).toStrictEqual(
        schema.build(Formatter).format(transformed)
      )
      expect(zodFormatter.parse(transformed)).toStrictEqual(input)
    })

    test('infers recursive types', () => {
      const zodFormatter = schema.build(ZodSchemer).formatter()
      type Formatted = z.infer<typeof zodFormatter>
      type Tree = NonNullable<Formatted['tree']>

      const assertDeep: A.Equals<Tree['children'][number]['children'][number]['label'], string> = 1
      assertDeep
    })

    test('rejects deep invalid values', () => {
      const zodFormatter = schema.build(ZodSchemer).formatter({ transform: false })

      expect(zodFormatter.safeParse(invalidInput).success).toBe(false)
    })
  })
})
