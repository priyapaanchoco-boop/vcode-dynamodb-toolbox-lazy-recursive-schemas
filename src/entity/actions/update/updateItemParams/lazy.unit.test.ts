import type { LazySchema, ListSchema, MapSchema, StringSchema } from '~/index.js'
import {
  $append,
  $prepend,
  $remove,
  $set,
  DynamoDBToolboxError,
  Entity,
  Table,
  UpdateAttributesCommand,
  UpdateItemCommand,
  item,
  lazy,
  list,
  map,
  string
} from '~/index.js'

const TestTable = new Table({
  name: 'test-table',
  partitionKey: { type: 'string', name: 'pk' }
})

type NodeSchema = MapSchema<
  {
    name: StringSchema<{}>
    children: ListSchema<LazySchema<NodeSchema, {}>, {}>
  },
  {}
>

const node = map({
  name: string(),
  children: list(lazy((): NodeSchema => node))
})

const TestEntity = new Entity({
  name: 'TestEntity',
  schema: item({
    id: string().key().savedAs('pk'),
    tree: lazy((): NodeSchema => node)
      .savedAs('t')
      .optional(),
    requiredTree: lazy((): NodeSchema => node),
    history: lazy(() => list(lazy((): NodeSchema => node))).optional()
  }),
  table: TestTable,
  timestamps: false,
  entityAttribute: false
})

const leaf = { name: 'leaf', children: [] }

describe('update - lazy schemas', () => {
  test('appends to lists inside (recursive) lazy maps', () => {
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      TestEntity.build(UpdateItemCommand)
        .item({
          id: 'a',
          tree: { children: { 0: { children: $append([leaf]) } } }
        })
        .params()

    expect(UpdateExpression).toBe(
      'SET #s_1.#s_2[0].#s_2 = list_append(if_not_exists(#s_1.#s_2[0].#s_2, :s_1), :s_2)'
    )
    expect(ExpressionAttributeNames).toMatchObject({ '#s_1': 't', '#s_2': 'children' })
    expect(ExpressionAttributeValues).toMatchObject({ ':s_1': [], ':s_2': [leaf] })
  })

  test('appends & prepends to lazy lists', () => {
    const { UpdateExpression: appendExpression, ExpressionAttributeValues: appendValues } =
      TestEntity.build(UpdateItemCommand)
        .item({ id: 'a', history: $append([leaf]) })
        .params()

    expect(appendExpression).toBe('SET #s_1 = list_append(if_not_exists(#s_1, :s_1), :s_2)')
    expect(appendValues).toMatchObject({ ':s_1': [], ':s_2': [leaf] })

    const { UpdateExpression: prependExpression } = TestEntity.build(UpdateItemCommand)
      .item({ id: 'a', history: $prepend([leaf]) })
      .params()

    expect(prependExpression).toBe('SET #s_1 = list_append(:s_1, if_not_exists(#s_1, :s_2))')
  })

  test('rejects invalid appended values (deep)', () => {
    const invalidCall = () =>
      TestEntity.build(UpdateItemCommand)
        .item({
          id: 'a',
          tree: {
            // @ts-expect-error deep invalid appended element
            children: $append([{ name: 'a', children: [{ name: 42, children: [] }] }])
          }
        })
        .params()

    expect(invalidCall).toThrow(DynamoDBToolboxError)
    expect(invalidCall).toThrow(expect.objectContaining({ code: 'parsing.invalidAttributeInput' }))
  })

  test('removes optional lazy attributes', () => {
    const { UpdateExpression, ExpressionAttributeNames } = TestEntity.build(UpdateItemCommand)
      .item({ id: 'a', tree: $remove() })
      .params()

    expect(UpdateExpression).toBe('REMOVE #r_1')
    expect(ExpressionAttributeNames).toMatchObject({ '#r_1': 't' })
  })

  test('removes list elements inside (recursive) lazy maps', () => {
    const { UpdateExpression, ExpressionAttributeNames } = TestEntity.build(UpdateItemCommand)
      .item({ id: 'a', tree: { children: { 0: { children: { 1: $remove() } } } } })
      .params()

    expect(UpdateExpression).toBe('REMOVE #r_1.#r_2[0].#r_2[1]')
    expect(ExpressionAttributeNames).toMatchObject({ '#r_1': 't', '#r_2': 'children' })
  })

  test('rejects removing required lazy attributes (lazy props decide)', () => {
    const invalidCall = () =>
      TestEntity.build(UpdateItemCommand)
        // @ts-expect-error
        .item({ id: 'a', requiredTree: $remove() })
        .params()

    expect(invalidCall).toThrow(DynamoDBToolboxError)
    expect(invalidCall).toThrow(expect.objectContaining({ code: 'parsing.attributeRequired' }))
  })

  test('sets & merges lazy maps', () => {
    const { UpdateExpression: setExpression, ExpressionAttributeValues: setValues } =
      TestEntity.build(UpdateItemCommand)
        .item({ id: 'a', tree: $set({ name: 'root', children: [leaf] }) })
        .params()

    expect(setExpression).toBe('SET #s_1 = :s_1')
    expect(setValues).toMatchObject({ ':s_1': { name: 'root', children: [leaf] } })

    const { UpdateExpression: mergeExpression } = TestEntity.build(UpdateItemCommand)
      .item({ id: 'a', tree: { name: 'root' } })
      .params()

    expect(mergeExpression).toBe('SET #s_1.#s_2 = :s_1')
  })

  test('UpdateAttributesCommand: appends to & removes lazy attributes', () => {
    const { UpdateExpression: appendExpression } = TestEntity.build(UpdateAttributesCommand)
      .item({ id: 'a', history: $append([leaf]) })
      .params()

    expect(appendExpression).toBe('SET #s_1 = list_append(if_not_exists(#s_1, :s_1), :s_2)')

    const { UpdateExpression: removeExpression, ExpressionAttributeNames } = TestEntity.build(
      UpdateAttributesCommand
    )
      .item({ id: 'a', tree: $remove() })
      .params()

    expect(removeExpression).toBe('REMOVE #r_1')
    expect(ExpressionAttributeNames).toMatchObject({ '#r_1': 't' })
  })
})
