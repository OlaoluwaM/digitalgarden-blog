---
{"dg-publish":true,"dg-path":" Posts/Implementing Redis INFO in Haskell.md","dg-permalink":"/posts/implementing-redis-info-in-haskell","permalink":"/posts/implementing-redis-info-in-haskell/","metatags":{"description":"You're INFO a treat"},"tags":["haskell","software-engineering"],"created":"2026-05-21T12:19","updated":"2026-06-16T16:19","dg-note-properties":{"tags":["haskell","software-engineering"],"created":"2026-05-21T12:19","updated":"2026-06-16T16:19"}}
---


In a [[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/Yes - Cabal custom scripts do have uses\|previous blog post]], I talked about how I used Cabal's custom setup script to generate a module with build info at compile time. As mentioned in that post, the custom setup script work was but a piece of what went into implementing the `INFO` command for my Redis server. Let's talk about it.

As always, if you want to peruse the code, feel free to check out the accompanying [PR](https://github.com/OlaoluwaM/redis-haskell/pull/1)

Ok. Implementing `INFO`.

The Redis [`INFO`](https://redis.io/docs/latest/commands/info/) command was actually rather straightforward to build out, at least, relative to some of the others like `SET` or `BGSAVE`. For context, `INFO` is a command for retrieving data on the current state of a Redis server. Thus, its implementation can be broken down into roughly two parts:

- Finding the information to be displayed
- Displaying said information in the appropriate format

First, I will say that the "Finding the information" piece was definitely the more involved of the two. Displaying the information was far more mechanical. Once I got the overall structure for the command down – [`Info.hs`](https://github.com/OlaoluwaM/redis-haskell/pull/1/changes#diff-210325193069ec43b1d2d9516eded15e9b9bcb4b40e649786f5a439bb96d3e9b) as the central coordinator/dispatcher, with a module per INFO section handling the retrieval and formatting of its own data – things fell into place. For example, for the `Server` section in the `INFO` command output, I have a [`Server.hs`](https://github.com/OlaoluwaM/redis-haskell/pull/1/changes#diff-d8e0740f46b3dc0de82ea0f8f2eb282ee87bb262a9fe862d532ddef507ea57f1) module specifically for defining, organizing and formatting all the info relevant to that section. Likewise for the `Replication` section there is [`Replication.hs`](https://github.com/OlaoluwaM/redis-haskell/pull/1/changes#diff-1eea0c2579bf0bc14fc191a2d6ac4f6bdd094dcc96d4feb02ee0b848791df29a) module, and so on.

`Info.hs` is, again, direct. It is a command module. All my command modules are responsible for defining how to parse their associated raw RESP request (specifically, an intermediate representation of the raw request) into the data type defined for that request, that they also own. I find things easier to manage when they are co-located like this. For `INFO`, the Redis docs define its request as optionally containing one or more output section filters. There are also some special section filter keywords like `all`, `everything`, and `default`.

Per my testing with an official Redis server, `all == everything`. Perhaps there are options that make them behave differently, but I opted not to pry into that right now. If a section filter is omitted or for some reason they were all invalid, then `default` is assumed.

In `Info.hs`, the [`mkInfoCmdArg`](https://github.com/OlaoluwaM/redis-haskell/blob/b1632a3cdf5dee654039bdc1a262072b396b9cf4/codecrafters-redis/src/Redis/Commands/Info.hs#L43) function parses an intermediary representation of the raw Redis request (a list of bulkstrings) into the appropriate domain type: [`InfoCmdArg`](https://github.com/OlaoluwaM/redis-haskell/blob/b1632a3cdf5dee654039bdc1a262072b396b9cf4/codecrafters-redis/src/Redis/Commands/Info.hs#L35) in this case.

Modeling the [individual sections as a sum type](https://github.com/OlaoluwaM/redis-haskell/blob/b1632a3cdf5dee654039bdc1a262072b396b9cf4/codecrafters-redis/src/Redis/Commands/Info.hs#L39) was a choice. I *could* have gone with strings, but types made all the subsequent pattern matching easier, particularly the dispatching on [line 109](https://github.com/OlaoluwaM/redis-haskell/blob/b1632a3cdf5dee654039bdc1a262072b396b9cf4/codecrafters-redis/src/Redis/Commands/Info.hs#L109). Plus, there are a finite number of section keywords anyways, so it wasn't a big lift.

[`handleInfo` on line 92](https://github.com/OlaoluwaM/redis-haskell/blob/b1632a3cdf5dee654039bdc1a262072b396b9cf4/codecrafters-redis/src/Redis/Commands/Info.hs#L92) is the, well, handler for this command, synonymous with an API request handler in your favorite backend framework. All command modules have one. In `Info.hs` all it does, besides gathering the necessary information, is:

1. Process the parsed section filters (the actual parsing happens elsewhere), which boils down to handling the special section filters I mentioned earlier. See `processInfoSectionsToShow`
2. For each section to display, generate its section string; a part of the final response. The function that handles this comes from the module for that section
3. Put all the section strings together
4. Send the response

That's it, for the most part.

To pass the challenge step, all I needed was for my server to be able to handle an `INFO replication` request and output just the "role" field specifically. But, the go-getter I am, I figured why not take a stab at the "Server" section too. Turns out the "Server" section's got hands:

![redis-info-server-got-hands-meme.jpg](/img/user/Extras/Assets/redis-info-server-got-hands-meme.jpg)

Implementing the "Server" section was an ok learning experience, but it took way longer than expected, mostly because I had to understand what its different fields were about and how their values were sourced. This meant a lot of navigating through the Redis codebase and I am not particularly well versed in C. GitHub Copilot was immensely helpful in this process.

Some items were trivial to source once I understood what they meant. Also, once I got my Cabal custom script thingy working, `redis_git_sha1`, `redis_git_dirty`, and `redis_build_id` became straightforward as well. On the other hand, there were some items I couldn't or didn't want to spend the time trying to implement, fields like `lru_clock`, `hz`, and `configured_hz`. Those I just stubbed. My implementation isn't 100% faithful to the official anyways. I added comments to all the `Server` section fields, so feel free to check those out and perhaps point out any misconceptions I may have had.

Next up on the list was testing. I won't go into much detail on how I've set up my test harness since that's out of scope for this blog post (though if you're interested do let me know!). What I do want to touch on are the tests for the `INFO` command specifically.

My personal philosophy to testing is as follows

> Write tests that help you build confidence that your system works as expected. "Works" here doesn't necessarily mean internals, though there are cases where ensuring the internals could be important. I, however, consider "works" to mean that "from the perspective of the user, the software does what it is supposed to. Given some input or scenario we get the expected outcome. What happens in the middle is rarely of importance"

For the `INFO` command, it seemed like snapshot/golden testing would work best to achieve what I described above. The issue, though, was that parts of the response would change on each request or over time. Fields like `redis_git_sha1`, `redis_build_id`, `uptime`, etc… I like to let my tests run in as close to a production environment as is reasonable. I don't like to mock, but mocking here to avoid snapshot churn seemed justifiable.

Well, mocking is a bit of a misnomer, what I decided to do was *mask* the revolving values with a string while in a test environment, which I signal using environment variables. You can check out the snapshots in the PR to see this in action. The function that handles this is called `maskFieldWhenNecessary` in [`Common.hs`](https://github.com/OlaoluwaM/redis-haskell/pull/1/changes#diff-54e69577981f5c4a2442a0fd7d27637f92e50c8d779df7ba7cbb5c028eac9d61). Pretty neat!

I think those are all the interesting bits in this PR. I've done some other things like building out [RDB](https://github.com/OlaoluwaM/redis-haskell/tree/0113c8433f3ce9ba1c180ed9c557e2b14b089c8f/codecrafters-redis/src/Redis/RDB) support, but that predated this PR-blogpost style of writing I've got going on here. Implementing that was way more involved and far more thought-provoking too. If y'all would be interested in a blog post about that let me know!

With that, thank you for reading. Till next time!
