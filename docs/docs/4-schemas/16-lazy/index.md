---
title: lazy
sidebar_position: 16.5
sidebar_custom_props:
  code: true
---

# Lazy

Describes a schema that is **only resolved when needed**, by calling a getter function. Lazy schemas are useful to define **recursive schemas** (like trees, comments threads, or nested categories), which are otherwise impossible to express:

```ts
import { lazy } from 'dynamodb-toolbox/schema/lazy'
import type { LazySchema } from 'dynamodb-toolbox/schema/lazy'

type CategorySchema = MapSchema<
  {
    name: StringSchema<{}>
    subCategories: ListSchema<LazySchema<CategorySchema, {}>, {}>
  },
  {}
>

const categorySchema = map({
  name: string(),
  // 👇 Getter is called on first use, so `categorySchema` can be referenced
  subCategories: list(lazy((): CategorySchema => categorySchema))
})

type Category = FormattedValue<typeof categorySchema>
// => { name: string; subCategories: Category[] }
```

The getter is **called only once**: Its result is cached (per lazy schema instance). You can access it with the `resolve` method:

```ts
const resolvedSchema = lazy(() => categorySchema).resolve()
// => categorySchema
```

:::caution[Typing recursive schemas]

TypeScript cannot infer the type of a variable referenced in its own initializer. Recursive schemas require to:

- **Declare the schema type** explicitly (`CategorySchema` above)
- **Annotate the return type of the getter** with it (`(): CategorySchema => ...`)

Do not annotate the variable itself (`const categorySchema: CategorySchema = ...`), as it prevents the inference of the schema builder methods.

:::

Lazy schemas also work with **mutually recursive** schemas:

```ts
const authorSchema = map({
  name: string(),
  books: list(lazy((): BookSchema => bookSchema))
})

const bookSchema = map({
  title: string(),
  author: lazy((): AuthorSchema => authorSchema).optional()
})
```

Values are **fully validated at any depth**:

```ts
const parsed = categorySchema.build(Parser).parse({
  name: 'Pokemons',
  subCategories: [
    // ❌ Throws: Attribute 'subCategories[0].subCategories[0].name' should be a string
    { name: 'Fire', subCategories: [{ name: 42, subCategories: [] }] }
  ]
})
```

## Lazy & Resolved Props

A lazy schema has **its own props**, which **take precedence** over the ones of the resolved schema. This lets you use the same recursive schema with different props at different places:

```ts
const pokemonSchema = item({
  // 👇 Optional & renamed at the root...
  categories: lazy((): CategorySchema => categorySchema)
    .optional()
    .savedAs('_c')
})

// ...but required in `subCategories` (as list elements must be required)
```

The lazy schema decides whether values are **required**, **hidden**, **key**, **renamed** (`savedAs`), **defaulted** or **linked**. Type-specific props of the resolved schema (like `enum` or `transform`) are kept.

Custom **validators** of both the lazy and the resolved schemas are applied.

:::info

Lazy schemas are checked when their parent schema is checked. A `DynamoDBToolboxError` with code `schema.lazy.invalidResolution` is thrown if the getter does not return a schema, or if a lazy schema resolves to itself (`lazy(() => sameLazySchema)`).

:::

## Paths

Paths (in [conditions](../../3-entities/4-actions/19-parse-condition/index.md), projections, or update references) are **typed up to lazy schemas**. Child paths of lazy schemas are typed as `string`, but are still **validated at run-time**:

```ts
await PokemonEntity.build(UpdateItemCommand)
  .item({
    pokemonId,
    // ✅ Correctly typed & validated
    categories: {
      subCategories: { 0: { subCategories: $append([newCategory]) } }
    }
  })
  .options({
    // ✅ Correctly validated (but child path typed as string)
    condition: { attr: 'categories.subCategories[0].name', exists: true }
  })
  .send()
```

## Discriminated AnyOfs

Lazy schemas can be used as [`anyOf`](../16-anyOf/index.md) elements, including [discriminated](../16-anyOf/index.md#discriminate) ones: They are resolved to find the discriminating attribute.

```ts
const exprSchema = anyOf(
  map({ kind: string().enum('num'), value: number() }),
  lazy(() =>
    map({
      kind: string().enum('neg'),
      operand: lazy((): ExprSchema => exprSchema)
    })
  )
).discriminate('kind')
```

## Actions

Lazy schemas are supported by every [action](../17-actions/1-parse.md):

- [`Parser`](../17-actions/1-parse.md) and [`Formatter`](../17-actions/2-format.md) resolve lazy schemas when needed.
- [`SchemaDTO`](../17-actions/3-dto.md) outputs lazy schemas as **references**: `{ $ref: 'lazy_1' }`. The root DTO gets a `$schema_defs` object mapping each reference to its full schema DTO. `fromDTO` resolves references at any depth (and throws an `actions.fromDTO.unknownSchemaRef` error for unknown references):

```ts
const pokemonSchemaDTO = pokemonSchema.build(SchemaDTO)
// => {
//   type: 'item',
//   attributes: { categories: { $ref: 'lazy_1' } },
//   $schema_defs: {
//     lazy_1: {
//       type: 'map',
//       attributes: {
//         name: { type: 'string' },
//         subCategories: { type: 'list', elements: { $ref: 'lazy_2' } }
//       },
//       required: 'never',
//       savedAs: '_c'
//     },
//     lazy_2: { ... }
//   }
// }
```

- `JSONSchemer` outputs lazy schemas as `{ $ref: '#/$defs/lazy_1' }` references, with definitions in the root `$defs` object.
- [`ZodSchemer`](../17-actions/5-zod-schemer.md) outputs lazy schemas as `z.lazy(...)` schemas (and resolves them in discriminated unions).

## Properties

Lazy schemas have the same properties as other schemas: [`.required()`](../16-anyOf/index.md#required), [`.optional()`](../16-anyOf/index.md#required), [`.hidden()`](../16-anyOf/index.md#hidden), [`.key()`](../16-anyOf/index.md#key), [`.savedAs(...)`](../16-anyOf/index.md#savedas), [`.default(...)`](../16-anyOf/index.md#default), [`.link(...)`](../16-anyOf/index.md#link) and [`.validate(...)`](../16-anyOf/index.md#validate):

```ts
const categoriesSchema = lazy((): CategorySchema => categorySchema)
  .optional()
  .hidden()
  .savedAs('_c')
  .validate(category => category.name.length > 0)
```
