---
{"dg-publish":true,"dg-path":" Posts/IO in Haskell, an epiphany.md","permalink":"/posts/io-in-haskell-an-epiphany/","metatags":{"description":"IO! IO! IO!"},"created":"2026-03-20T11:31:55.215-05:00","updated":"2026-03-20T15:39:29.820-05:00"}
---


It seems to me like `IO` is Haskell's way of modelling/representing the general concept of a statement (an action/impure operation, an operation with side effects that may or may not return a value). We know why statements are important. They allow our programs do useful things at the cost of non-determinism (changes to the world state tend not be consistent across invocations) and ordering (we tend to require that effects occur in a certain order).

In mainstream languages, there is often little to no effort to meaningfully distinguish between statements and expressions (at least in my experience), as a result, expressions and statements tend to be interleave-able allowing any sub-program the ability to perform arbitrary side effects. Haskell, on the other hand, seems to have taken a stance against this by making explicit the notion of a statement at the type level through the `IO` type (it's technically a type constructor but for the sake of explanation we'll consider it a type). This way, the implicit interleaving of statements and expressions becomes non-standard while the explicit demarcation of statements and expressions becomes enforceable by the type system.

Though, this isn't to say they can't be mixed in any way as expressions can still return a type of `IO a` while `IO` actions can also trigger the evaluation of expressions, but in standard, idiomatic Haskell, the extent of this mixing is very strictly controlled and purposefully limited though escape hatches do exist for those who know what they're doing.

With all that said, it might be accurate to consider Haskell's `IO a` not as a value like `String`, `Either e a`, or `Int`, but rather as a representation/description of an action/statement that when executed at runtime (given the current world state) yields a value of type `a` potentially performing side effects along the way. This perspective also aligns somewhat with how `IO` is defined as a state function (`s -> (a, s)`) under the hood
