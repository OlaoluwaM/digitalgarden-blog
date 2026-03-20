---
{"dg-publish":true,"dg-path":" Posts /Numbers? Numerals? Oh Boy.md","dg-permalink":"numbers-numerals-oh-boy","permalink":"/numbers-numerals-oh-boy/","metatags":{"description":"Ever wondered about the difference between numbers and numerals? Me neither, but here we are"},"created":"2026-03-20T15:09:00.012-05:00","updated":"2026-03-20T15:14:21.664-05:00"}
---


So a while back I was attempting to do some data marshalling for the persistence of the store in my [redis server implementation](https://github.com/OlaoluwaM/redis-haskell) per the [RDB file specification](https://rdb.fnordig.de/file_format.html#length-encoding). It turns out that when you attempt to get the char code for a character in Haskell, it'll give you a decimal number. This stumped me for a bit since in the example I was testing out (getting the char code for the character 'R') I was expecting to get 52 per what I saw in the docs, but I was getting 82 instead?

Then while I was having a friendly chat with some of the gods at the functional programming discord, I was told that those numbers are the same, wtf? I was expecting 52, which, it turns out, is the char code for 'R' in _hexadecimal_, while 82 is the char code in _decimal_. For some reason, my brain somehow didn't even consider that those two symbols (52 and 82) could be the same in any way. If you too are a little confused, read on.

You see, it turns out that we all conflate the idea of numbers and numerals because the distinction tends not to have any practical significance for the most part. Numbers are in reality not a sequence of symbols, but are abstract mathematical objects. They exist independently of any base system, they just are, like the concept of 'distance' or 'quantity'. They are a pure mathematical concept that transcends notation (like a soul), independent of the symbols we typically associate them with/use to represent them. These symbols are actually numerals.

Think about it, when you have three apples, the "threeness" exists whether you write it as 3, III, 三, or 11 (in binary). The quantity itself is the number; how we write it down is the numeral.

A helpful analogy here might be the game [Mortal Shell](https://store.steampowered.com/app/1110910/Mortal_Shell/). Great game btw, though a little too tedious for me. Anyway, this game makes a great analogy because it follows a sort of spirit (number) that can be taken into combat with different shells (numerals). Just like in the game where the same spirit can inhabit different shells, the same number can be expressed through different numeral systems.

Numerals are what we mean when we typically refer to a "number" in everyday speech. If numbers are the soul, numerals are the physical shells with which we interact with said soul in everyday life. Numerals are a representation of numbers in the form of some base (10 for decimal, 16 for hex, 2 for binary, etc.) using an available sequence of digits. They're the physical manifestation of the abstract mathematical idea for practical use.

I mean, how else can a notion of equality between completely disparate symbols like "42", "101010", and "2A" even exist without some sort of common denominator to refer back to? In this case, that common denominator is a number in the mathematical sense.

Although computers represent numbers using binary numerals for practical reasons (hardware limitations, to speed up bitwise operations, etc.), what we deal with as engineers are numbers in the mathematical sense because that's the level of abstraction we think in. The fact that it's binary beneath the covers is irrelevant to us, so for all intents and purposes (excluding maybe systems engineering), numeric types are a digital representation of numbers not numerals.

So in essence, numbers are abstract mathematical objects that represent quantity. Numerals are the symbols we use to represent/concretize said objects. Crazy right? Who would've thought numbers to be like spirits? What if they're the ghost of some vengeful mathematicians? Anyway, understanding this helped clarify my confusion while giving me a cool concept to explain when I want to sound smart, so it's a win win.
