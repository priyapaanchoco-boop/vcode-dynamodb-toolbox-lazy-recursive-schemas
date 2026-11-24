import { DynamoDBToolboxError } from '~/errors/index.js'
import type { MapSchema } from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'
import { prefix } from '~/transformers/prefix.js'

import { Formatter } from './formatter.js'

const node = map({
  value: number().savedAs('v'),
  label: string().transform(prefix('L')),
  children: list(lazy((): MapSchema => node))
})

describe('lazySchemaFormatter', () => {
  test('formats recursive values', () => {
    expect(
      node.build(Formatter).format({
        v: 1,
        label: 'L#a',
        children: [{ v: 2, label: 'L#b', children: [{ v: 3, label: 'L#c', children: [] }] }]
      })
    ).toStrictEqual({
      value: 1,
      label: 'a',
      children: [{ value: 2, label: 'b', children: [{ value: 3, label: 'c', children: [] }] }]
    })
  })

  test('throws on deep invalid values', () => {
    const invalidCall = () =>
      node.build(Formatter).format({
        v: 1,
        label: 'L#a',
        children: [{ v: 2, label: 'L#b', children: [{ v: 'three', label: 'L#c', children: [] }] }]
      })

    expect(invalidCall).toThrow(DynamoDBToolboxError)
    expect(invalidCall).toThrow(
      expect.objectContaining({
        code: 'formatter.invalidAttribute',
        // Formatter errors use saved paths
        path: 'children[0].children[0].v'
      })
    )
  })

  test('applies projections through lazy schemas', () => {
    expect(
      node.build(Formatter).format(
        {
          v: 1,
          label: 'L#a',
          children: [{ v: 2, label: 'L#b', children: [{ v: 3, label: 'L#c', children: [] }] }]
        },
        { attributes: ['.children[0].children[0].value'] }
      )
    ).toStrictEqual({ children: [{ children: [{ value: 3 }] }] })
  })

  describe('lazy props take precedence over resolved schema props', () => {
    test('required', () => {
      const optionalStr = string().optional()
      const formatter = item({ lzy: lazy(() => optionalStr) }).build(Formatter)

      expect(() => formatter.format({})).toThrow(
        expect.objectContaining({ code: 'formatter.missingAttribute', path: 'lzy' })
      )

      const formatter2 = item({ lzy: lazy(() => string()).optional() }).build(Formatter)
      expect(formatter2.format({})).toStrictEqual({})
    })

    test('hidden & savedAs', () => {
      const hiddenRenamedStr = string().hidden().savedAs('resolvedSavedAs')
      const formatter = item({
        visible: lazy(() => hiddenRenamedStr).savedAs('v'),
        hidden: lazy(() => string()).hidden()
      }).build(Formatter)

      expect(formatter.format({ v: 'a', hidden: 'b' })).toStrictEqual({ visible: 'a' })
    })
  })
})
