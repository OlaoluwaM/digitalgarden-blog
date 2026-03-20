---
{"dg-publish":true,"dg-path":" Posts /Endianness, WOOT!?.md","dg-permalink":"endianness-woot","permalink":"/endianness-woot/","metatags":{"description":"Endian deez nuts"},"created":"2026-03-20T15:17:39.241-05:00","updated":"2026-03-20T15:39:35.108-05:00"}
---


So there I was programming some binary serialization and deserialization logic to add persistence to my Redis server. I was in the zone then the docs I was referencing began to mention this "endian" thing, what the heck does that mean? I mean, I know it has something to do with how bytes are parsed but the rest of that thought was a little fuzzy ngl. It is at this point, dear reader, that I wish to inform you that I did it, for you, I fell right into the rabbit hole so you don't have to. Here's what I learned:

`````ad-tldr
title: TLDR

Assuming the following sequence of bytes:<br/>`[0x01, 0x02, 0x03, 0x04]`

**Big-endian** (most significant byte first):<br/>`0x01020304 = 16,909,060`

**Little-endian** (least significant byte first):<br/>`0x04030201 = 67,305,985`

Again,

Reading a 16-bit value from a file:<br/>`bytes = [0x12, 0x34]`

Big-endian system interprets this as:<br/>`value = 0x1234 // 4660`

Little-endian system interprets this as:<br/>`value = 0x3412 // 13330`

If that doesn't suffice as a complete and holistic explanation, read on
`````

Endianness refers to the direction/order in which computers parse/store sequences of bytes, as the order influences what ends up being interpreted from said bytes.

Note that this isn't the same thing as the bit order. AFAIU, endianness does not affect the order in which individual bits are stored and parsed. Bit order is somewhat consistent across systems but there *are* instances where bit order *does* matter namely in contexts where one finds themselves splitting bytes or doing some bit manipulation on not-so-neat chunks, which tends to be the case when working close to physical mediums/hardware. Ethernet is a good example of this. Nevertheless, with bit order it's typically alright to assume the largest binary place value as being at the leftmost position like in denary (base 10)

To better grasp the concept of endianness, it might be best to first discuss the concept of most and least significant byte. You see, one might consider that numerals ([why am I calling them numerals they're numbers!?](https://ola.bearblog.dev/numbers-numerals-oh-boy/)) are often made up of sub numerals, for example, in base 10 the numeral 912 is made up of the sub numerals 900, 10 and 2. Now which of this sub numerals would you say contributes the most to the whole value of 912, the 900 right? This then would be the most significant decimal numeral while the 2 would be the least significant. See where I'm going with this?

When dealing with a byte sequence, it's similar. Within said sequence there exist a byte that contributes most to the overall value represented by said sequence and there exists a byte that contributes the least. The positions of these bytes is determined by the endianness with which we parse such a sequence. If we were to use big endian, then we assume that the most significant byte is the leftmost byte similar to our decimal example. This kind of endianness feels more natural in that it allows us to parse byte sequences from left to right as we would decimal numbers. This kind of endianness is most common in network communications specifically network protocols.

On the other hand, there is little endian which is the opposite of big endian. With little endian the leftmost byte in a sequence of bytes is considered the *least* significant byte while the rightmost byte is considered the most significant. It is like reading decimal numbers from right to left. It's not as intuitive as big endian, but is commonly used within processors like the ubiquitous `x86_64` Intel processor and most modern ARM implementations (though ARM processors can actually operate in either mode).

The notion of endianness is important because it influences how data, in this case byte sequences, are interpreted. Like our decimal example 912 is representative of a completely different quantity than 219. The former is what we get with big endian whilst the latter is what we interpret using little endian.

Now that's all well and good but why should you care about this? Frankly, I don't know but I reckon this information will in real handy when you find yourself dealing with a web protocol that communicates using a binary format or if you happen to be into systems programming in which case you probably already know all this stuff why are you here?

Nevertheless, how's that for a productive Saturday! That wasn't so bad, right? (I need to get a life…)
