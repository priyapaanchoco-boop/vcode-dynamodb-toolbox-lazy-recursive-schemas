import { DynamoDBToolboxError } from '~/errors/index.js'
import type { MapSchema } from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'
import { prefix } from '~/transformers/prefix.js'

import { Parser } from './parser.js'

const node = map({
  value: number().savedAs('v'),
  label: string().transform(prefix('L')).putDefault('none'),
  children: list(lazy((): MapSchema => node)).putDefault([])
})

describe('lazySchemaParser', () => {
  test('parses & transforms recursive values (including nested defaults)', () => {
    const parser = node.build(Parser)

    expect(
      parser.parse({ value: 1, children: [{ value: 2, children: [{ value: 3, label: 'leaf' }] }] })
    ).toStrictEqual({
      v: 1,
      label: 'L#none',
      children: [{ v: 2, label: 'L#none', children: [{ v: 3, label: 'L#leaf', children: [] }] }]
    })

    expect(
      parser.parse(
        { value: 1, children: [{ value: 2, children: [{ value: 3, label: 'leaf' }] }] },
        { transform: false }
      )
    ).toStrictEqual({
      value: 1,
      label: 'none',
      children: [{ value: 2, label: 'none', children: [{ value: 3, label: 'leaf', children: [] }] }]
    })
  })

  test('throws on deep invalid values', () => {
    const invalidCall = () =>
      node.build(Parser).parse({
        value: 1,
        children: [{ value: 2, children: [{ value: 'three' }] }]
      })

    expect(invalidCall).toThrow(DynamoDBToolboxError)
    expect(invalidCall).toThrow(
      expect.objectContaining({
        code: 'parsing.invalidAttributeInput',
        path: 'children[0].children[0].value'
      })
    )
  })

  test('throws on deep missing values', () => {
    const invalidCall = () =>
      node.build(Parser).parse({ value: 1, children: [{ value: 2, children: [{}] }] })

    expect(invalidCall).toThrow(
      expect.objectContaining({
        code: 'parsing.attributeRequired',
        path: 'children[0].children[0].value'
      })
    )
  })

  test('works on mutually recursive schemas', () => {
    const author = map({
      name: string(),
      books: list(lazy((): MapSchema => book))
    })
    const book = map({
      title: string(),
      author: lazy((): MapSchema => author).optional()
    })

    expect(
      book.build(Parser).parse({ title: 'a', author: { name: 'b', books: [{ title: 'c' }] } })
    ).toStrictEqual({ title: 'a', author: { name: 'b', books: [{ title: 'c' }] } })

    expect(() =>
      book.build(Parser).parse({ title: 'a', author: { name: 'b', books: [{ title: 42 }] } })
    ).toThrow(
      expect.objectContaining({
        code: 'parsing.invalidAttributeInput',
        path: 'author.books[0].title'
      })
    )
  })

  describe('lazy props take precedence over resolved schema props', () => {
    // Resolved schema props should be ignored for modifiers
    const requiredStr = string().putDefault('resolvedDefault').savedAs('resolvedSavedAs')

    test('required', () => {
      const schema = item({ opt: lazy(() => string()).optional(), req: lazy(() => string()) })
      const parser = schema.build(Parser)

      expect(parser.parse({ req: 'a' })).toStrictEqual({ req: 'a' })
      expect(() => parser.parse({ opt: 'a' })).toThrow(
        expect.objectContaining({ code: 'parsing.attributeRequired', path: 'req' })
      )

      // Resolved schema being optional does not matter
      const optionalStr = string().optional()
      const parser2 = item({ req: lazy(() => optionalStr) }).build(Parser)
      expect(() => parser2.parse({})).toThrow(
        expect.objectContaining({ code: 'parsing.attributeRequired', path: 'req' })
      )
    })

    test('savedAs & defaults', () => {
      const parser = item({
        lzy: lazy(() => requiredStr)
          .savedAs('l')
          .putDefault('lazyDefault')
      }).build(Parser)

      expect(parser.parse({})).toStrictEqual({ l: 'lazyDefault' })
      expect(parser.parse({}, { transform: false })).toStrictEqual({ lzy: 'lazyDefault' })

      // No lazy default: Resolved default is NOT used
      const parser2 = item({ lzy: lazy(() => requiredStr).optional() }).build(Parser)
      expect(parser2.parse({})).toStrictEqual({})
    })

    test('links', () => {
      const parser = item({
        name: string(),
        lzy: lazy(() => string()).putLink((input: any) => `${input.name}!`)
      }).build(Parser)

      expect(parser.parse({ name: 'foo' })).toStrictEqual({ name: 'foo', lzy: 'foo!' })
    })

    test('validators', () => {
      const putValidator = vi.fn((value: string) => value !== 'forbidden')
      const parser = item({ lzy: lazy(() => string()).putValidate(putValidator) }).build(Parser)

      expect(parser.parse({ lzy: 'ok' })).toStrictEqual({ lzy: 'ok' })
      expect(() => parser.parse({ lzy: 'forbidden' })).toThrow(
        expect.objectContaining({ code: 'parsing.customValidationFailed', path: 'lzy' })
      )
      expect(putValidator).toHaveBeenCalledTimes(2)
    })
  })

  test('resolves getter only once', () => {
    const getter = vi.fn((): MapSchema => node)
    const schema = list(lazy(getter))
    const parser = schema.build(Parser)

    parser.parse([{ value: 1 }, { value: 2 }])
    parser.parse([{ value: 3 }])

    expect(getter).toHaveBeenCalledTimes(1)
  })
})
