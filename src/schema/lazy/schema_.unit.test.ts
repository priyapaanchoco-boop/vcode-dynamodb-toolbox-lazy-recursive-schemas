import type { A } from 'ts-toolbelt'

import { DynamoDBToolboxError } from '~/errors/index.js'
import type { AnyOfSchema, MapSchema, Validator } from '~/schema/index.js'
import { anyOf, list, map, number, string } from '~/schema/index.js'

import type { LazySchema } from './schema.js'
import { LazySchema_, lazy } from './schema_.js'

describe('lazy', () => {
  const str = string()

  test('returns default lazy schema', () => {
    const lzy = lazy(() => str)

    const assertType: A.Equals<(typeof lzy)['type'], 'lazy'> = 1
    assertType
    const assertProps: A.Equals<(typeof lzy)['props'], {}> = 1
    assertProps

    expect(lzy).toBeInstanceOf(LazySchema_)
    expect(lzy.type).toBe('lazy')
    expect(lzy.props).toStrictEqual({})
  })

  test('does not call getter on definition', () => {
    const getter = vi.fn(() => str)
    lazy(getter)

    expect(getter).not.toHaveBeenCalled()
  })

  describe('resolve', () => {
    test('returns the getter result', () => {
      const lzy = lazy(() => str)

      const resolved = lzy.resolve()
      const assertResolved: A.Equals<typeof resolved, typeof str> = 1
      assertResolved

      expect(resolved).toBe(str)
    })

    test('calls getter only once', () => {
      const getter = vi.fn(() => str)
      const lzy = lazy(getter)

      lzy.resolve()
      lzy.resolve()
      lzy.resolve()

      expect(getter).toHaveBeenCalledTimes(1)
    })

    test('still resolves once the schema is frozen', () => {
      const getter = vi.fn(() => str)
      const lzy = lazy(getter)
      Object.freeze(lzy)

      expect(lzy.resolve()).toBe(str)
      expect(lzy.resolve()).toBe(str)
      expect(getter).toHaveBeenCalledTimes(1)
    })
  })

  describe('check', () => {
    test('throws if getter returns something else than a schema', () => {
      for (const invalidResolution of [undefined, null, 42, 'str', {}, { type: 'lazy' }, [str]]) {
        // @ts-expect-error
        const lzy = lazy(() => invalidResolution)
        const invalidCall = () => lzy.check('path')

        expect(invalidCall).toThrow(DynamoDBToolboxError)
        expect(invalidCall).toThrow(
          expect.objectContaining({
            code: 'schema.lazy.invalidResolution',
            path: 'path',
            payload: { received: invalidResolution }
          })
        )
      }
    })

    test('throws if a lazy chain resolves to itself', () => {
      const selfLazy: LazySchema = lazy((): LazySchema => selfLazy)
      const loopA: LazySchema = lazy((): LazySchema => loopB)
      const loopB: LazySchema = lazy((): LazySchema => loopA)

      for (const lzy of [selfLazy, loopA]) {
        const invalidCall = () => lzy.check()

        expect(invalidCall).toThrow(DynamoDBToolboxError)
        expect(invalidCall).toThrow(
          expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
        )
      }
    })

    test('throws if a nested lazy chain is invalid', () => {
      // @ts-expect-error
      const lzy = lazy(() => lazy(() => 42))
      const invalidCall = () => lzy.check()

      expect(invalidCall).toThrow(
        expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
      )
    })

    test('checks the resolved schema', () => {
      // @ts-expect-error
      const lzy = lazy(() => list(string().optional()))
      const invalidCall = () => lzy.check('path')

      expect(invalidCall).toThrow(
        expect.objectContaining({ code: 'schema.list.optionalElements', path: 'path' })
      )
    })

    test('checks the lazy props', () => {
      // @ts-expect-error
      const lzy = lazy(() => str, { required: 'foo' })
      const invalidCall = () => lzy.check('path')

      expect(invalidCall).toThrow(expect.objectContaining({ code: 'schema.invalidProp' }))
    })

    test('lazy props are used by parent schemas', () => {
      // Resolved schema is optional but list elements only look at the lazy props
      const optionalStr = string().optional()
      const validList = list(lazy(() => optionalStr))
      expect(() => validList.check()).not.toThrow()

      // @ts-expect-error
      const invalidList = list(lazy(() => str).optional())
      expect(() => invalidList.check()).toThrow(
        expect.objectContaining({ code: 'schema.list.optionalElements' })
      )
    })

    test('works on (mutually) recursive schemas', () => {
      const tree = map({
        value: number(),
        children: list(lazy((): MapSchema => tree))
      })

      expect(() => tree.check()).not.toThrow()
      expect(tree.checked).toBe(true)

      const author = map({
        name: string(),
        books: list(lazy((): MapSchema => book))
      })
      const book = map({
        title: string(),
        author: lazy((): MapSchema => author).optional()
      })

      expect(() => book.check()).not.toThrow()
      expect(book.checked).toBe(true)
      expect(author.checked).toBe(true)
    })

    test('works on recursive anyOf schemas', () => {
      const expr = anyOf(
        map({ kind: string().enum('num'), value: number() }),
        map({
          kind: string().enum('add'),
          operands: list(lazy((): AnyOfSchema => expr))
        }),
        lazy((): AnyOfSchema => expr)
      )

      expect(() => expr.check()).not.toThrow()
    })

    test('works on recursive discriminated anyOf schemas', () => {
      const num = map({ kind: string().enum('num'), value: number() })
      const add = map({
        kind: string().enum('add'),
        operands: list(lazy((): AnyOfSchema => expr))
      })
      const neg = lazy(() =>
        map({ kind: string().enum('neg'), operand: lazy((): AnyOfSchema => expr) })
      )
      const expr = anyOf(num, add, neg).discriminate('kind')

      expect(() => expr.check()).not.toThrow()
      expect(expr.match('num')).toBe(num)
      expect(expr.match('add')).toBe(add)
      // Lazy elements match as themselves (lazy props are applied as usual)
      expect(expr.match('neg')).toBe(neg)
    })
  })

  describe('props', () => {
    test('returns required lazy (option)', () => {
      const lzyAtLeastOnce = lazy(() => str, { required: 'atLeastOnce' })
      const lzyAlways = lazy(() => str, { required: 'always' })
      const lzyNever = lazy(() => str, { required: 'never' })

      const assertAtLeastOnce: A.Contains<
        (typeof lzyAtLeastOnce)['props'],
        { required: 'atLeastOnce' }
      > = 1
      assertAtLeastOnce
      const assertAlways: A.Contains<(typeof lzyAlways)['props'], { required: 'always' }> = 1
      assertAlways
      const assertNever: A.Contains<(typeof lzyNever)['props'], { required: 'never' }> = 1
      assertNever

      expect(lzyAtLeastOnce.props).toStrictEqual({ required: 'atLeastOnce' })
      expect(lzyAlways.props).toStrictEqual({ required: 'always' })
      expect(lzyNever.props).toStrictEqual({ required: 'never' })
    })

    test('returns required lazy (method)', () => {
      const lzyAlways = lazy(() => str).required('always')
      const lzyNever = lazy(() => str).optional()

      const assertAlways: A.Contains<(typeof lzyAlways)['props'], { required: 'always' }> = 1
      assertAlways
      const assertNever: A.Contains<(typeof lzyNever)['props'], { required: 'never' }> = 1
      assertNever

      expect(lzyAlways.props).toStrictEqual({ required: 'always' })
      expect(lzyNever.props).toStrictEqual({ required: 'never' })
    })

    test('returns hidden, key & savedAs lazy', () => {
      const lzy = lazy(() => str)
        .hidden()
        .key()
        .savedAs('foo')

      const assertProps: A.Contains<
        (typeof lzy)['props'],
        { hidden: true; key: true; required: 'always'; savedAs: 'foo' }
      > = 1
      assertProps

      expect(lzy.props).toStrictEqual({
        hidden: true,
        key: true,
        required: 'always',
        savedAs: 'foo'
      })
    })

    test('returns defaulted, linked & validated lazy', () => {
      const putValidator: Validator = () => true
      const lzy = lazy(() => str)
        .putDefault('foo')
        .putLink(() => 'bar')
        .putValidate(putValidator)

      expect(lzy.props.putDefault).toBe('foo')
      expect(lzy.props.putLink).toBeInstanceOf(Function)
      expect(lzy.props.putValidator).toBe(putValidator)
    })

    test('keeps the getter when updating props', () => {
      const getter = () => str
      const lzy = lazy(getter).optional().hidden()

      expect(lzy.getter).toBe(getter)
      expect(lzy.resolve()).toBe(str)
    })
  })

  test('clone', () => {
    const lzy = lazy(() => str).optional()
    const cloned = lzy.clone({ hidden: true })

    expect(cloned).toBeInstanceOf(LazySchema_)
    expect(cloned.props).toStrictEqual({ required: 'never', hidden: true })
  })
})
