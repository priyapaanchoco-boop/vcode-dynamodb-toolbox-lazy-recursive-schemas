import type { MapSchema } from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'

import { ConditionParser } from './conditionParser.js'

const node = map({
  value: number().savedAs('v'),
  children: list(lazy((): MapSchema => node))
})

const schema = item({
  id: string(),
  tree: lazy((): MapSchema => node).savedAs('t')
})

describe('parseCondition - lazy schemas', () => {
  test('parses conditions on lazy attributes', () => {
    expect(schema.build(ConditionParser).parse({ attr: 'tree', exists: true })).toStrictEqual({
      ConditionExpression: 'attribute_exists(#c_1)',
      ExpressionAttributeNames: { '#c_1': 't' },
      ExpressionAttributeValues: {}
    })
  })

  test('parses conditions on deep recursive paths', () => {
    expect(
      schema.build(ConditionParser).parse({ attr: 'tree.children[1].children[0].value', gte: 3 })
    ).toStrictEqual({
      ConditionExpression: '#c_1.#c_2[1].#c_2[0].#c_3 >= :c_1',
      ExpressionAttributeNames: { '#c_1': 't', '#c_2': 'children', '#c_3': 'v' },
      ExpressionAttributeValues: { ':c_1': 3 }
    })
  })

  test('parses attribute comparisons on recursive paths', () => {
    expect(
      schema
        .build(ConditionParser)
        .parse({ attr: 'tree.children[0].value', eq: { attr: 'tree.value' } })
    ).toStrictEqual({
      ConditionExpression: '#c_1.#c_2[0].#c_3 = #c_1.#c_3',
      ExpressionAttributeNames: {
        '#c_1': 't',
        '#c_2': 'children',
        '#c_3': 'v'
      },
      ExpressionAttributeValues: {}
    })
  })

  test('throws on invalid recursive paths', () => {
    expect(() =>
      schema.build(ConditionParser).parse({ attr: 'tree.children[0].unknown', eq: 3 })
    ).toThrow(expect.objectContaining({ code: 'actions.invalidExpressionAttributePath' }))
  })
})
