import { Formatter } from '~/schema/actions/format/index.js'
import { Parser } from '~/schema/actions/parse/index.js'
import { ZodSchemer } from '~/schema/actions/zodSchemer/index.js'
import { $discriminators } from '~/schema/anyOf/constants.js'
import type { AnyOfSchema } from '~/schema/index.js'
import { anyOf, item, lazy, list, map, number, string } from '~/schema/index.js'

/**
 * Discriminated anyOf schemas with lazy elements: Lazy elements resolve normally
 */
describe('lazy schemas in discriminated anyOf', () => {
  const num = map({ kind: string().enum('num'), value: number() })
  const add = map({
    kind: string().enum('add'),
    operands: list(lazy((): AnyOfSchema => expr))
  })
  const neg = lazy(() =>
    map({ kind: string().enum('neg'), operand: lazy((): AnyOfSchema => expr) })
  )
  const pos = lazy(() => map({ kind: string().enum('pos'), value: number() })).putValidate(
    value => (value as { value: number }).value > 0
  )
  const expr = anyOf(num, add, neg, pos).discriminate('kind')

  const schema = item({ expr })

  const input = {
    expr: {
      kind: 'add',
      operands: [
        { kind: 'num', value: 1 },
        { kind: 'neg', operand: { kind: 'add', operands: [{ kind: 'pos', value: 2 }] } }
      ]
    }
  }

  test('discriminators are computed through lazy elements', () => {
    expect(() => schema.check()).not.toThrow()
    // Discriminators object also holds an internal (symbol) flag
    expect({ ...expr[$discriminators] }).toMatchObject({ kind: 'kind' })
    expect(Object.keys(expr[$discriminators])).toStrictEqual(['kind'])
  })

  test('discriminators intersection takes lazy elements into account', () => {
    const renamedKind = lazy(() => map({ kind: string().enum('renamed').savedAs('k') }))
    // @ts-expect-error Discriminator type also takes lazy elements into account
    const invalidCall = () => anyOf(num, renamedKind).discriminate('kind').check()

    expect(invalidCall).toThrow(
      expect.objectContaining({ code: 'schema.anyOf.invalidDiscriminator' })
    )
  })

  test('match resolves lazy elements (to the lazy schema itself)', () => {
    expect(expr.match('num')).toBe(num)
    expect(expr.match('add')).toBe(add)
    expect(expr.match('neg')).toBe(neg)
    expect(expr.match('pos')).toBe(pos)
    expect(expr.match('unknown')).toBeUndefined()
  })

  test('parses & formats through lazy elements', () => {
    const parsed = schema.build(Parser).parse(input)

    expect(parsed).toStrictEqual(input)
    expect(schema.build(Formatter).format(parsed)).toStrictEqual(input)

    expect(() =>
      schema.build(Parser).parse({ expr: { kind: 'neg', operand: { kind: 'num', value: 'x' } } })
    ).toThrow(expect.objectContaining({ path: 'expr.operand.value' }))
  })

  test('applies lazy element validators when matched by discriminator', () => {
    const parser = schema.build(Parser)

    expect(parser.parse({ expr: { kind: 'pos', value: 1 } })).toStrictEqual({
      expr: { kind: 'pos', value: 1 }
    })
    expect(() => parser.parse({ expr: { kind: 'pos', value: -1 } })).toThrow(
      expect.objectContaining({ code: 'parsing.customValidationFailed' })
    )
  })

  test('zod discriminated unions resolve lazy elements', () => {
    // NOTE: zod discriminatedUnion does not support validators (ZodEffects), so `pos` is not used here
    const zodSchema = item({ expr: anyOf(num, add, neg).discriminate('kind') })
    const zodInput = {
      expr: {
        kind: 'add',
        operands: [
          { kind: 'num', value: 1 },
          { kind: 'neg', operand: { kind: 'num', value: 2 } }
        ]
      }
    }

    const zodParser = zodSchema.build(ZodSchemer).parser()
    expect(zodParser.parse(zodInput)).toStrictEqual(zodSchema.build(Parser).parse(zodInput))
    expect(
      zodParser.safeParse({ expr: { kind: 'neg', operand: { kind: 'num', value: 'x' } } }).success
    ).toBe(false)

    const zodFormatter = zodSchema.build(ZodSchemer).formatter()
    expect(zodFormatter.parse(zodInput)).toStrictEqual(zodSchema.build(Formatter).format(zodInput))
  })
})
