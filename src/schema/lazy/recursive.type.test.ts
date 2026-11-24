import type { A } from 'ts-toolbelt'

import { schema as s } from '../index.js'
import type { ListSchema } from '../list/index.js'
import type { MapSchema } from '../map/index.js'
import type { NumberSchema } from '../number/index.js'
import type { StringSchema } from '../string/index.js'
import type { Paths, ValidValue } from '../types/index.js'
import type { LazySchema } from './schema.js'

/**
 * Recursive schemas: The schema type has to be declared explicitly,
 * and the lazy getter return type annotated with it.
 */
type TreeSchema = MapSchema<
  {
    value: NumberSchema<{}>
    children: ListSchema<LazySchema<TreeSchema, {}>, {}>
  },
  {}
>

const treeSchema = s.map({
  value: s.number(),
  children: s.list(s.lazy((): TreeSchema => treeSchema))
})

const assertBuilt: A.Extends<typeof treeSchema, TreeSchema> = 1
assertBuilt

// Keeps builder methods
treeSchema.optional()

// --- ValidValue
type TreeValue = ValidValue<typeof treeSchema>
declare const treeValue: TreeValue

const assertDeepValue: A.Equals<
  (typeof treeValue)['children'][number]['children'][number]['value'],
  number
> = 1
assertDeepValue

const validTree: TreeValue = {
  value: 1,
  children: [{ value: 2, children: [{ value: 3, children: [] }] }]
}
validTree

const invalidTree: TreeValue = {
  value: 1,
  // @ts-expect-error deep invalid node is caught
  children: [{ value: 2, children: [{ value: 'a', children: [] }] }]
}
invalidTree

// --- Mutually recursive schemas
type AuthorSchema = MapSchema<
  { name: StringSchema<{}>; books: ListSchema<LazySchema<BookSchema, {}>, {}> },
  {}
>
type BookSchema = MapSchema<
  { title: StringSchema<{}>; author: LazySchema<AuthorSchema, { required: 'never' }> },
  {}
>

const validBook: ValidValue<BookSchema> = {
  title: 'a',
  author: { name: 'b', books: [{ title: 'c' }] }
}
validBook

const bookWithoutAuthor: ValidValue<BookSchema> = { title: 'a' }
bookWithoutAuthor

// --- Lazy props
const optionalTree = s.lazy((): TreeSchema => treeSchema).optional()

const assertOptional: A.Equals<(typeof optionalTree)['props'], { required: 'never' }> = 1
assertOptional

const undefinedTree: ValidValue<typeof optionalTree> = undefined
undefinedTree

const requiredTree = s.lazy((): TreeSchema => treeSchema)
// @ts-expect-error required by default
const undefinedRequiredTree: ValidValue<typeof requiredTree> = undefined
undefinedRequiredTree

// --- Paths stop at lazy schemas (any child path is accepted)
type TreePaths = Paths<TreeSchema>

const valuePath: TreePaths = '.value'
valuePath
const childPath: TreePaths = '.children[0]'
childPath
const deepPath: TreePaths = "['children'][0].children[1].value"
deepPath
// @ts-expect-error unknown attribute before lazy point
const invalidPath: TreePaths = '.foo'
invalidPath
