---
{"dg-publish":true,"dg-path":" Posts/Types of types - Haskell's Kind system.md","dg-permalink":"/posts/types-of-types-haskell-kind-system","permalink":"/posts/types-of-types-haskell-kind-system/","title":"Types of types: Haskell's Kind system","tags":["haskell","software-engineering"],"dg-note-properties":{"title":"Types of types: Haskell's Kind system","description":"Kinda?","tags":["haskell","software-engineering"],"published":"2026-10-13T12:30:00","last_updated":"2026-10-13T14:41"}}
---

While working to add [typed configuration](https://github.com/OlaoluwaM/redis-haskell/pull/2) to my Haskell Redis server clone, I found myself learning some new tricks, all of them stemming from Haskell's Kind system. In this article, we're gonna discuss what I learned and the things I managed to build with it.

We'll start from the beginning, with Values.

## Values

These are the constructs we manipulate in our programs, things like `1`, `2`, `True`, `"hello"`, etc… In functional programming contexts, they're also called "*terms.*" They are the things we consume, create, compute with, and output. The management and manipulation of values is a big part of the practice of programming and software engineering.

We all work with different values in our day to day. Like creatures in a fantasy setting, values that share certain characteristics – that are created, used, and manipulated in the same way – belong to the same species. Formally, these "species" are called *Types*.

## Types

Types are groups of related values. Put another way, the notion of a type offers us a means of collectively referencing/referring to a group of related values. In many programming languages, we use words like `Int`, `string`, `Bool`, `Text`, etc… to denote a type.

The main benefit, in grouping values into types, IMO, is abstraction. Types inform us – the programmer and the compiler – of the characteristics of a value and the kinds of operations that can and can't be performed on or with it. Think of weapon classes in a game. In many RPGs there are weapon classes and the class of a weapon often dictates the kinds of attacks that you can perform or the kinds of skills you can use with it; types do the same for values.

Taking this one step further, you might ask yourself, how do we classify types? Do we even need to do that? Why? To answer those questions, we must step into the realm of *Kinds.*

## Kinds

Kinds are to types what types are to values. My intuition for the Kind system is that it is a means of classification for all things type level. You would think "all things type level" would simply refer to everyday types, but in Haskell (and a couple other languages), other type-level constructs exist, like type-level numbers (of Kind `Nat`), type-level strings (of Kind `Symbol`), or the constraints from Typeclasses (of Kind `Constraint`).

We won't be going into much detail about any of those, but `Nat`s and `Symbol`s do often appear in type-level programming contexts. On the other hand, entities of Kind `Constraint` are likely more familiar because they're just (fully applied) Typeclasses for the most part. For example, the `Show` Typeclass belongs to the Kind `Type -> Constraint` and `Show Int` belongs to the Kind `Constraint`.

Regular types belong to the Kind `Type`. Confusing, I know. Type constructors, that is, things like `Maybe`, `Either`, `Last`, `Proxy`, `Dual`, etc…, have their Kind determined by both their [arity](https://en.wikipedia.org/wiki/Arity) and the Kind of their parameters as showcased by the table below.

| Value          | Type-level construct                    | Kind                                               |
| -------------- | --------------------------------------- | -------------------------------------------------- |
| `1`            | `Int`                                    | `Type`                                             |
| `True`         | `Bool`                                   | `Type`                                             |
| `not`          | `Bool -> Bool`                           | `Type`                                             |
| `[1, 2, 3]`    | `[Int]`                                  | `Type`                                             |
| `Just "hello"` | `Maybe String`                           | `Type`                                             |
| `Right 5`      | `Either String Int`                      | `Type`                                             |
|                | `Maybe`                                  | `Type -> Type`                                     |
|                | `[]` (the list type constructor)         | `Type -> Type`                                     |
|                | `Either`                                 | `Type -> Type -> Type`                             |
|                | `Either String`                          | `Type -> Type`                                     |
|                | `Three` (from `data Three a b c = …`)  | `Type -> Type -> Type -> Type`                     |
|                | `5` (a type-level number)                | `Nat` (GHCi prints `Natural`)                      |
|                | `"hello"` (a type-level string)          | `Symbol`                                           |
|                | `Show Int`                               | `Constraint`                                       |
|                | `Show`                                   | `Type -> Constraint`                               |
|                | `Functor`                                | `(Type -> Type) -> Constraint`                     |
|                | `Compose` (simplified)                   | `(Type -> Type) -> (Type -> Type) -> Type -> Type` |

> [!aside] `*` vs `Type`
> In older docs and in some GHC error messages, you'll see `*` where I write `Type`. They're the same thing. AFAICT `*` is a synonym for `Type` and vice versa. `*` is the older name, and GHC plans to deprecate it (`-Wall` already warns when you use it).

> [!aside] Fun fact
> Technically, regular types are also type constructors, type constructors with no parameters. You may find them being referred to as "*nullary type constructors*".

Without Kinds, there'd be no way to tell type-level constructs like `Maybe`, `Maybe Int`, and `Show` apart, IMO. Depending on where you are in your Haskell journey, the benefit of having some of these other type-level entities may not be entirely apparent, but I can assure you that they all work to make the Haskell type system more expressive, allowing us to codify more things in the type system, which in turn makes it easier to write safer programs.

## Higher-Kinded Types

Now, we mentioned before that types allow us to abstract over values. This means that we can collectively refer to a set of values through their type. Similarly, with a given Kind, we name a collection of type-level constructs. For example, the Kind `Type -> Type` collectively refers to all type constructors that take a single regular type as an argument: that covers things like `Maybe`, but also partial applications like `Either String` or `Three Int String`. Likewise, the Kind `Type -> Type -> Type` collectively refers to all type constructors that take two regular types as arguments. To tie this back down to the value/term level, it's similar to function signatures. A function signature of `Int -> Bool` collectively refers to all functions that take an `Int` as argument and return a `Bool`.

Now, we know that a signature like `Int -> Bool` collectively refers to a set of functions, but what about something like `(Int -> Int) -> Bool`? What does that mean? That signature represents all functions that return a boolean only after accepting a function with a signature of `Int -> Int` as argument. This type of signature is quite common, and functions with signatures like this are called higher-order functions.

Okay, now, what happens if we try to extrapolate this idea to the Kind level? What if we replaced the `Type` param in `Type -> Type` with `(Type -> Type)`? Well, for starters, we get a signature like `(Type -> Type) -> Type`. We know that `Type` is the Kind for all regular types and `Type -> Type` is the Kind for all type constructors that take a single regular type as argument. Putting that together means that the signature `(Type -> Type) -> Type` represents the Kind for all type-level constructs that take a type constructor as argument. You see where I'm going with this? Just as functions with signatures like `(Int -> Int) -> Bool` are called higher-order functions, type constructors with Kinds like `(Type -> Type) -> Type` or `(Type -> Type) -> (Type -> Type) -> Type` are collectively called higher-Kinded types or HKTs for short.

Here's a small example:

```haskell
data Wrap (f :: Type -> Type) = Wrap (f Int)
```
{ #bccebc}


`Wrap` takes a type constructor `f` and puts an `Int` inside it, so its Kind is `(Type -> Type) -> Type`. `Wrap Maybe` is a regular type, and so is `Wrap []`. `Wrap (Just 5)` and `Wrap [1, 2, 3]` are values of each. `Compose` from the table earlier is another example, just with more parameters.

From another angle, if parameterized types like `Maybe` or `Either` are what other languages call generics, then HKTs are generics that can take other generics as arguments.

The concept of HKTs, when coupled with Typeclasses, gives us the ability to implement certain functionality on type-level constructs. That's useful because it lets us reuse operations in many more contexts. To illustrate, let's take `Functor :: (Type -> Type) -> Constraint`. `Functor` isn't an HKT itself, since its Kind ends in `Constraint`, not `Type`. However, its parameter *is* a type constructor, which makes it higher-Kinded.

Now, if a type constructor has a `Functor` instance, we can map over its contents using the `fmap` function. Furthermore, thanks to the higher-Kinded nature of `Functor`, we only need to define a single `Functor` instance for an appropriately Kinded type constructor (`Type -> Type` specifically) to be able to use `fmap` with any specialization of said type constructor. What I mean is, because we define the `Functor` instance on, say, `Maybe` and not some `Maybe a`, we can use `fmap` on all concrete versions of `Maybe a` (`Maybe Int`, `Maybe String`, `Maybe Bool`, etc…). In fact, it can't work any other way: `Functor`'s Kind signature only accepts type constructors of Kind `Type -> Type`, so something like `Maybe Int`, of Kind `Type`, isn't even a candidate. The instance belongs to `Maybe` itself. This principle applies to all other higher-Kinded Typeclasses and appropriately Kinded type constructors.

In non-technical terms, take a bowl for eating. Make the bowl itself microwave-safe and you can use it to warm any food you put in it. In this case, the bowl is our "appropriately Kinded type constructor"; the standard that determines whether something is "microwave-safe" is our higher-Kinded Typeclass (like `Functor`); the "microwave-safe" label we put on our bowl is its Typeclass instance; and the bowl of food we're able to microwave represents a specialization of our type constructor. Here too, it can't work any other way: nobody certifies a bowl of soup as microwave-safe. The label belongs to the bowl and applies regardless of the bowl's contents.

## Higher-Kinded Data

Higher-Kinded data, or HKD for short, is the name of a pattern where, instead of a type-level thing, a data type takes one or more type constructors as parameters and uses them to wrap some or all of its fields. People might consider this "advanced", but it's actually pretty straightforward once you wrap your head around [[Outbox/Digital Garden & Blog/Content/Blogposts/Types of types - Haskell's Kind system#Higher-Kinded Types\|higher-Kinded types]]. Here's an example:

```haskell
-- The `f` parameter is a type constructor, making `Profile` higher-Kinded
data Profile (f :: Type -> Type) = Profile
    { age :: f Int
    , name :: f String
    , profession :: f String
    , address :: f String
    }

-- `f = Identity`: every field must be present
grace :: Profile Identity
grace = Profile (Identity 37) (Identity "Grace") (Identity "Computer scientist") (Identity "New York")

-- `f = Maybe`: any field can be missing, like a half-filled sign-up form
draft :: Profile Maybe
draft = Profile Nothing (Just "Grace") Nothing Nothing

-- `f = Const String`: every field holds a `String`, whatever its type, like a form label
labels :: Profile (Const String)
labels = Profile (Const "Age") (Const "Name") (Const "Profession") (Const "Address")
```

Let's take a deeper look using this [PR](https://github.com/OlaoluwaM/redis-haskell/pull/2) from my [redis-haskell](https://github.com/OlaoluwaM/redis-haskell) project, where I added support for typed Redis configuration sourced from both command-line options and options declared in a `redis.conf` file.

First, to implement this, I needed a data type representation of a Redis configuration with the fields I wanted to support.

The issue I first ran into was a case of duplication. My initial data type idea was a plain record type, but it needed to support two slightly different contexts:

- Default config where all the fields will be available, initialized to their official default values.
- Command-line configs and `redis.conf` configs where fields would need to be nullable.

My initial direction was to define two record types: one where the field types were bare, and another where they were wrapped in a `Last`.

```haskell
data RedisConfig = RedisConfig
    { rdbFileDirPath :: SomeBase Dir
    , rdbFilenamePath :: Path Rel File
    , useRDBCompression :: Bool
    , genRdbChecksum :: Bool
    , port :: Int
    }
    deriving stock (Generic)
    
data PartialRedisConfig = PartialRedisConfig
    { rdbFileDirPath :: Last (SomeBase Dir)
    , rdbFilenamePath :: Last (Path Rel File)
    , useRDBCompression :: Last Bool
    , genRdbChecksum :: Last Bool
    , port :: Last Int
    }
    deriving stock (Generic)
```

> [!aside] Why [`Last`](https://www.stackage.org/haddock/lts-24.63/base-4.20.2.0/Data-Monoid.html#t:Last)
> `Maybe`'s `<>` defers to the `Semigroup` semantics of the type it contains, unless either operand is a `Nothing`. Moreover, for it to work, all our wrapped field types would need to have a `Semigroup` instance. `Bool` and `Int` don't have one. And even for types that do, `<>` would combine the two values instead of picking one. `Last` keeps the latest value that's present, letting later sources override earlier values.

I wasn't a fan of this approach because I wanted to have a single source of truth for supported config field names and types. With two data types, it would have been easy to change one variant while forgetting to update the other. The type system could have caught any discrepancies, depending on how things are implemented, but that wasn't good enough.

One option would have been to have just one Redis config type with every field wrapped in `Last`. Since `Last` keeps the right-most `Just` value, `defaults <> confFileOpts <> cliOpts` would give command-line options priority, followed by `redis.conf` options, then the default values. Exactly the semantics we want. The problem, though, would have been the final result. It would've still been a record with all fields wrapped in `Last`, even though combining with the default record (`defaults`) would've ensured all fields had a value. Consequently, every site that read from that final config would've had to unwrap a `Last` value that couldn't be a `Nothing`.

You may also be wondering: why not define another record with bare fields for just the final res—oh…. Yeah.

So, again, I needed two variations of my config type: a partial one for merging, and a complete one for defaults and use by the rest of the server. What I didn't want was two definitions.

To achieve this, I ended up with a definition akin to:

```haskell
data RedisConfigF (f :: Type -> Type) = RedisConfigF
    { rdbFileDirPath :: f (SomeBase Dir)
    , rdbFilenamePath :: f (Path Rel File)
    , useRDBCompression :: f Bool
    , genRdbChecksum :: f Bool
    , port :: f Int
    }
    deriving stock (Generic)
```

`RedisConfigF` is a higher-Kinded data type. It is higher-Kinded because its `f` parameter is of Kind `Type -> Type`. That makes `RedisConfigF` itself of Kind `(Type -> Type) -> Type`, the same as the [[Outbox/Digital Garden & Blog/Content/Blogposts/Types of types - Haskell's Kind system#^bccebc\|`Wrap` definition above]]. This gave me one data type definition for both the contexts I described above. For defaults and the final merged config, `f = Identity`, and for the other case, where field values may not be present, `f = Last`.

To merge, we leverage the `Semigroup` instance for `Last` to combine the config records of `redis.conf` options and CLI options. Then we fill in gaps with the defaults. Here's the [merge code](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config.hs#L74-L81).

After that, we get back a record of type `RedisConfigF Identity` with all fields filled in. However, with `f = Identity`, every field is wrapped in `Identity`, which still needs to be unwrapped on access. The real code [automates that unwrapping](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/Types.hs#L80), but how it does so is beyond the scope of this article.

In any case, what we've just walked through is the power and utility of higher-Kinded data types. Another interesting use case I leveraged was using `RedisConfigF` for field parser association [here](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/Conf.hs#L90-L112). With `f = Const (Text, ReadM PartialRedisConfig)`, the same record holds each field's `redis.conf` name and parser, so if I add a field and forget to give it a name and parser there, the compiler warns me. Neat stuff!

> [!aside] Barbies
> I know the [barbies](https://hackage.haskell.org/package/barbies-2.1.1.0/docs/Barbies.html) library exists for working with higher-Kinded data like this, but it felt simpler and more educational to just build the things I needed for this specific use case.

## Custom Kinds

The final thing I'd like to touch on is custom Kinds. Yes, just as you can make your own types, you can make your own Kinds. Custom Kinds are our own type-level constructs, useful for promoting info into the type system. Example:

```haskell
{-# LANGUAGE DataKinds #-}

data Person = Person Symbol Symbol Nat
```

Here, we have a data declaration that's also been promoted to a Kind through the `DataKinds` extension. Essentially, what that extension does is extend the utility of the `data` declaration syntax so data declarations define Kinds as well as data types. In the case of the snippet above:

- `Person` is the name of our custom data type and Kind
- `Person Symbol Symbol Nat` is a description of the structure/shape of the type-level entities that are members of the Kind
- `'Person :: Symbol -> Symbol -> Nat -> Person` is the type constructor for creating type-level entities of Kind `Person`
- `Person :: Symbol -> Symbol -> Nat -> Person` is the data constructor of the type `Person`

A member of the Kind `Person` looks like this:

```haskell
type Ada = 'Person "Ada" "Lovelace" 21   -- Ada :: Person
```

``````ad-aside
title: Ticks & Puns

You might have noticed the tick in `'Person`. It is to disambiguate a pun. In this context, a *pun* is when a type and its constructor share a name, like `data Person = Person …`. Usually this is fine because Haskell keeps types and terms in separate namespaces. However, once `DataKinds` is enabled and the data constructor is promoted, both names (type and data constructor) can be used at the type level. How then are we to refer to the promoted constructor when plain `Person` already means the type and Kind? The tick lets us refer to the constructor explicitly: `'Person`.

When the names don't clash (like `data Person = MkPerson …`), the tick is optional. Since GHC 9.4, GHC no longer recommends writing it by default either ([GHC issue #20531](https://gitlab.haskell.org/ghc/ghc/-/issues/20531)). In our `Person` example, though, the names do clash, so the tick is required.
``````

Notice that `Person` shows up as both a type and a Kind. Well, **since GHC 8, every Kind is also considered a type**. It's kinda like how you can be a parent and a child at the same time: a parent to your kids, and a child to your own parents. `Person` works the same way: it's the Kind that `Ada` belongs to, and it's also a type that belongs to the Kind `Type`.

Additionally, as some types may be uninhabited, some Kinds are also uninhabited. For example, `Int` is inhabited by values as a type, but uninhabited by type-level constructs as a Kind. Conversely, `Symbol` is uninhabited as a type, but inhabited by type-level string literals as a Kind. In fact, it is for this reason that our `Person` type can have no values at the term level (no values of type `Symbol` to use to create a value of type `Person`), but it can be inhabited at the Kind level.

`Bool` is interesting because it is inhabited both as a type and as a Kind. Same with `Nat`, which is an alias for `Natural`.

| Type     | Members as a type (values) | Members as a Kind (types)          |
| -------- | -------------------------- | ---------------------------------- |
| `Int`    | `0`, `-3`, …               | none                               |
| `Symbol` | none                       | `"Ada"`, `"port"`, …               |
| `Bool`   | `True`, `False`            | `'True`, `'False`                  |
| `Nat`    | `0`, `21`, …               | `0`, `21`, … (type-level literals) |

With that explanation out of the way, let's bring this back to the redis-haskell use case. In my PR, I needed two pieces of data for each field on my `RedisConfigF` type: the `redis.conf` key a field name corresponds to (field names deliberately differ from the actual config keys for semantics' sake) and its type. I originally defined separate type synonyms like so:

```haskell
type RDBFileDir = SomeBase Dir
type RDBFileDirConfigFieldName = "dir"

type RDBFilename = Path Rel File
type RDBFilenameConfigFieldName = "dbfilename"
-- …one more pair per field
```

I also tried type-level tuples, for better encapsulation:

```haskell
type RDBFileDir  = '("dir", SomeBase Dir)          -- Kind: (Symbol, Type)
type RDBFilename = '("dbfilename", Path Rel File)
```

> [!aside] Tuple pun
> The tick works the same way here. Tuple syntax is also a pun, since `(a, b)` names both the tuple type and its constructor.

But that would have been akin to using an anonymous product type at the term/value level. Something like `(Symbol, Type)` is structural. Any two such pairs would be the same Kind regardless of intent. So instead, I decided to make my own custom Kind, [`ConfigField`](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/Types.hs#L48), which is nominal, semantic, self-documenting, and impossible to confuse with some other `(Symbol, Type)` pair.

Here's the definition, with the fields from the snippets above rewritten to use it:

```haskell
data ConfigField = ConfigField Symbol Type  -- with DataKinds, this is also a Kind

type RDBFileDir        = 'ConfigField "dir"            (SomeBase Dir)
type RDBFilename       = 'ConfigField "dbfilename"     (Path Rel File)
type UseRDBCompression = 'ConfigField "rdbcompression" Bool
type GenRDBChecksum    = 'ConfigField "rdbchecksum"    Bool
type RedisPort         = 'ConfigField "port"           Int
```

Now each field's `redis.conf` key and its Haskell type live together in a single `ConfigField`, and with the use of some other type-level mechanisms, we can access that information at the term level, so there's no need to duplicate it. We do this in a couple spots using [`getConfigFieldName`](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/Types.hs#L221): the [command-line parser](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/CommandLine.hs#L37), where each key doubles as its flag name (`"dir"` becomes `--dir`), and the [`redis.conf` parser](https://github.com/OlaoluwaM/redis-haskell/blob/f3839f961ee43c4d12f4f51272615c74abcb6b9f/codecrafters-redis/src/Redis/Server/Config/Conf.hs#L90).

## Conclusion

So, to recap: values are grouped into types, and types are grouped into Kinds. Each pattern in this post builds on that. Higher-Kinded types let us define types that take other type constructors as arguments, like `Wrap` or `Compose`. The higher-Kinded data pattern gave me one config record type that could be partial or complete. And a custom Kind allowed me to keep each config field's `redis.conf` key with its type so the two couldn't drift apart.

As always, if you're interested in seeing more code, give the [PR](https://github.com/OlaoluwaM/redis-haskell/pull/2) a look see and tell me what you think. This post wasn't meant to be exhaustive, but I hope it's given you, dear reader, a decent intuition for Kinds and a push in the right direction.

Till next time!
