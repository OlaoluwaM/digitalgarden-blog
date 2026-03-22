---
{"dg-publish":true,"dg-path":" Posts/On maths and engineering.md","permalink":"/posts/on-maths-and-engineering/","metatags":{"description":"Computer science is applied maths or some such"},"tags":["computer-science","mathematics"],"created":"2026-03-22T12:59:19.926-05:00","updated":"2026-03-22T15:17:16.974-05:00"}
---


I want to be dangerous with maths, at least, with regard to software engineering. I know math isn't *necessarily* a requirement for the field, but being competent never hurts. Moreover, time and time again I have found myself trying to read through some CS literature like *Intro to Algorithms*, or SICP, or (most recently) *The Algorithm Design Manual* only to find myself waylaid by the math weaved into the essence of the prose. Some of it, I am able to overcome, but often it ends up being a point of frustration that causes me to lose interest or take too long to make any meaningful progress.

When I was just starting out, I didn't really think much of this gap. I was more occupied with just learning programming, but now I think I want to do more to study computer science: do a little more theory rather than just practicals. I want to get good at the relevant math which, from my research, seems to just be mostly discrete math (plus linear algebra and statistics for ML). Maybe some Calculus, but that seems more useful in specific niches, if anything.

Oddly enough, I *have* taken a Calculus class, Calculus I specifically, back in community college (CC). However, since I wasn't able to complete a Bachelor's degree immediately after CC, I haven't taken a discrete math class. Well, that's not entirely true. I did do some study in the semester before my hiatus at WGU. Needless to say, for all intents and purposes, I haven't *really* taken a discrete math class, so I'm just gonna do that.

I've found the textbook, *Discrete Mathematics with Applications* by Susanna S. Epp, to be fantastic so far. Super accessible, and I hope to get through it cover-to-cover or close enough to achieve my ends. In parallel, I am also reading *The Algorithm Design Manual* for DSA practice. Yes, sure I *could* just take one of the many DSA/Leetcode courses geared specifically towards getting a person interview-ready, and I did start with that, but I guess I wanted something a little more comprehensive? I also wanted to make progress on this [curriculum](https://teachyourselfcs.com/), so I figured reading TADM would be killing two birds with one stone.

I'm in a pretty good spot to dive into this, I think. Let's just hope it stays that way long enough for me to get to where I want to go.

Anyways, while I go through TADM, particularly the exercises, I find myself needing to do things like come up with counterexamples or prove algorithms. This stuff was never interesting to me, but I find it more and more fascinating as the days go by. I'm even looking to learn Lean to get better at formally expressing the proofs I write. I haven't gotten to the proof section of *Discrete Mathematics with Applications* yet, so the proof exercises in TADM are still a bit of a slog. I have found Claude to be particularly helpful, but I don't let it just give me the answers. I have system prompts that specifically disable this behavior. No, I have configured Claude to be a kind of tutor, and it's been working wonders in helping me get through the TADM exercises while I shore up my math.

A couple of days ago, Claude and I worked through a proof for Horner's method using loop invariants. Below is what I was able to come up with following Claude's assistance (all of this below is in my own words):

`````ad-note
title: Horner's Method
```
Horner(a, x)
	p = a_n
	for i from n − 1 to 0
		p = p · x + a_i
	return p
```

What is/are the invariant(s) that directly assert on the expected end result of this algorithm? Horner's method is an algorithm for evaluating [[Polynomials]]. So it stands to reason that our invariant ought to be something related to the evaluation of polynomials. The algorithm returns a value $p$ which is probably the evaluated polynomial. Ok, then what is true about $p$ at every step (initialization, after each iteration, and after termination)?

Some scrutiny suggests that the invariant we care about here is that "$p$ always contains the evaluated polynomial up to $a_i$".

- At initialization, $p = a_n$ which adheres to our invariant since, at this point, $i$ is not initialized, there is no $i$ but $p$ holds the first term of the polynomial. 
- After each iteration, we can see that our invariant holds true as with every iteration, $p$ still contains an evaluated polynomial up to $a_i$.
	- For iteration 1, we are 1 away from $n$, so $n-1$. Thus, $p = (a_n * x) + a_{n-1} = a_n*x + a_{n-1}$. Since at this iteration $i = n-1$, $p$ is also equal to $a_n*x + a_i$, matching our invariant
	- For iteration 2, we are 2 away from $n$, so $n-2$. Thus $p = (((a_n * x) + a_{n-1}) * x) + a_{n-2} = a_n*x^2 + a_{n-1}*x + a_{n-2}$. Again, because at this iteration we are at $n-2$, $i = n-1-1 = n-2$, thus $p = a_n*x^2 + a_{n-1}*x + a_{i}$, matching our invariant
	- For iteration 3, we are 3 away from $n$, so $n-3$. Thus, $p = (((((a_n * x) + a_{n-1}) * x) + a_{n-2}) * x) + a_{n-3} = a_n*x^3 + a_{n-1}*x^2 + a_{n-2}*x + a_{n-3}$. Once more, because at this iteration we are at $n-3$, $i = n-1-1-1 = n-3$, a $-1$ for each iteration. Thus, $p = a_n*x^3 + a_{n-1}*x^2 + a_{n-2}*x + a_i$, matching our invariant
- Notice how with each iteration, the polynomial held by $p$ increases by a term and all the exponents increase by 1? Also note that the exponent for the first time is equal to the number of iterations. At our first iteration the first term had an exponent of 1. At the second iteration, the exponent was 2, and in our third, it was 3. Likewise, at our first iteration $i = n-1$, at the second $i = n-2$, and at the third iteration $i = n-3$. Doing some quick algebra shows us that we could generalize our exponent as $n-i$ ($i = n-3$ -> $0 = n-3-i$ -> $\text{3, the index} = n-i$). And because each subsequent term has an exponent that is 1 less than the exponent of the previous term, the second and third terms will have an exponent of $n-i-1$ and $n-i-2$ respectively. Thus we can state our invariant more algebraically as $p = a_n*x^{n-i} + a_{n-1}*x^{n-i-1} + a_{n-2}*x^{n-i-2} + a_{n-3}*x^{n-i-3} + \ldots + a_{i}$. Notice how this is more or less equivalent to what we got as the value of $p$ after each iteration.
- At termination, that is, when $i = 0$, $p = a_n*x^{n} + a_{n-1}*x^{n-1} + a_{n-2}*x^{n-2} + a_{n-3}*x^{n-3} + \ldots + a_0$. This is equivalent to our invariant, so the invariant holds all through.

```ad-aside
Note that $a_i$ is the last term since only after the last iteration is $i$ fixed at 0. Using it as the index in any other term wouldn't be correct once we start adding more terms. So, on the first iteration, $a_n*x + a_i$ is correct because on the first iteration $i = n - 1$. However, it would be incorrect to say $p = a_n*x^2 + a_i*x^1 + a_{i - 1}$ for the second iteration because now $i = n - 1 - 1$, so the indexes for the second and third terms of our polynomial would be wrong. Instead we want to reference $n$ directly somehow, since $n$'s value never changes with each iteration.
```
`````

Look at how beautiful that is. It's enough to make a grown man cry! Though I think what I have here is accurate, I'm always open to correction.

Learning about loop invariants and using them for this proof took me a while, and there was a lot of stumbling and fumbling, but I managed it. My goal now is to make it easier for me to do these kinds of things, and by extension open myself up to more CS literature. Not all of it, mind, but enough to help broaden my engineering capabilities. Let's see how it goes.
