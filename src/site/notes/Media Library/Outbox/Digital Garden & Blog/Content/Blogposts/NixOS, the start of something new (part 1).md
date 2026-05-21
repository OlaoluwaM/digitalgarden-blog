---
{"dg-publish":true,"dg-path":" Posts/NixOS, the start of something new (part 1).md","dg-permalink":"/posts/nixos-the-start-of-something-new-part-1","permalink":"/posts/nixos-the-start-of-something-new-part-1/","title":"NixOS: The start of something new (part 1)","metatags":{"description":"To Nix or not to Nix"},"tags":["linux","software-engineering"],"created":"2026-05-04T08:57","updated":"2026-05-21T11:04","dg-note-properties":{"tags":["linux","software-engineering"],"title":"NixOS: The start of something new (part 1)","Updated At":"2026-05-21T11:04","Created At":"2026-05-04T08:57"}}
---

I am really digging this Nix thing. I've known about Nix for a while now. It didn't really seem like much, especially since I already had my [distro-setup](https://github.com/OlaoluwaM/distro-setup) repository for reproducing my Fedora system. I considered Nix to be needless complexity until I started using it at work and my eyes were opened.

I realized that most, if not all, of the things I have scripted in my distro-setup repository could easily be expressed as Nix configuration, and because NixOS operates as a function of your configuration, the only way to modify your system would be to modify your config.

I figured that kind of workflow would be the solution to a problem I'd been having with distro-setup where, over time, my scripts would drift from the state of my system because I'd neglect to update them as I modified things. By default, however, with NixOS, this undesirable state becomes harder to reach, because, again, by default, you must update your configuration if you want to modify your system. Pretty neat, right!?

Nonetheless, I still kinda held off on doing all this because I *really* didn't want to learn a whole new abstraction and the common sentiment of Nix being a particularly obtuse language with terrible error messages and a steep learning curve only put me off further. But as I continued to consider the potential benefits (lower likelihood of drift and easier reproducibility), I decided to give it a proper shot. I opted to start by learning the meanings of what I think are the most common terms:

`````ad-info
- The Nix language can be thought of as [JSON with functions](https://nix.dev/tutorials/nix-language.html#:~:text=Note-,If,similar).
- A **revision** is a Nix term for a Git commit hash. Most commonly, revisions tend to refer to a specific Git commit hash from the Nixpkgs repo, but it can also refer to a commit hash from any Git repo.
- A **derivation** is a build recipe/blueprint for a "package". With a derivation, we describe how to build a "package": what inputs it needs, what commands to run, and where the output should be placed.
		- I put the term "**package**" in quotes above because in Nix, the term is used pretty loosely. Usually a package refers to something like a program from a repository or something, but in Nix a package may refer to:
			- a derivation itself (confusing, I know).
			- the result of a derivation.
			- a program or tool (like usual).
			- a library (like those `libutils` or whatever packages you'd typically spy in a distribution's repo).
			- a font, config, man pages, really any software artifact I think.
- The Nix "**store**", distinct from `/usr/bin`, is located at `/nix/store` and it is where everything that Nix builds ("packages") is stored. Items are stored at a unique path based on the hash of their inputs. This way different versions of an item can exist without collision.
- A **channel** is a named, stable URL that points to a revision, the latest one among a collection of revisions like `nixos-24.11` or `nixos-unstable`. It is similar to a Git repo where you can subscribe to receive updates when new commits are pushed through. We point a channel to its latest revision using `nix-channel --update` or `nixos-rebuild --upgrade`. Channels make it easy to get started with Nix and NixOS. 
	- However, it is important to note that this mechanism isn't reproducible in the same way a `package.json` without a `package-lock.json` isn't reproducible. Channels can point to different revisions across machines. In other words, two systems with the same channel-based config could be working with different revisions of the same channel.
	- Channels only ever work with the latest revision they are aware. There is no way to rollback or pin to a revision as far as I know
- An **overlay** is a mechanism for extending a package set without needing to fork the package set. It allows for the overriding of a package in a package set or adding a new package.
- An **override** allows for rebuilding a package with different dependencies or options. For example, you want to build a package but do so with a specific flag enabled or swap out an out-of-date dependency with something more recent, etc.
- A **NixOS module** is a reusable piece of system (NixOS) configuration like in `/etc/nixos`, having a `configuration.nix` and a `hardware-configuration.nix` and importing the latter in the former. Both are modules.
- A **generation** is a bootable snapshot of your system configuration. Generations are listed for you to select from before booting. Every time you rebuild, NixOS creates a new generation and adds it as a boot entry.
- A **profile** is a collection of installed packages and configuration for a given user or system.
`````

I also took the time to get at least a partial intuition for what a **flake** is and how it differs from a **channel**. The benefits it offers in terms of reproducibility were the main reason I opted to have my config be flake-based as you can see in [the repo](https://github.com/OlaoluwaM/nixos-config).

> [!aside] Why "reproducibility"
> I value reproducibility because I like being able to get back up and running quickly should anything happen to my device and I need to spin up a new one, or need to do a fresh install. Like with my games, I hate losing my progress :). Even on Fedora, which supports version upgrades, I prefer to do a fresh install as it reduces the chances of things not working right.

> [!aside] What is a "flake"
> A **flake** is a relatively new approach to defining nix projects. A flake can be thought of as any directory with a `flake.nix` and `flake.lock` at its root. In a `flake.nix` file we define two things: `inputs` and `outputs`. Like in a function, the `inputs` are the dependencies of the flake, the things required to generate the output. The `outputs` can be multiple things, a package, a development environment, a library, a NixOS configuration or any other kind of software artifact. Flakes offer us more reproducibility thanks to the `flake.lock` file where dependencies, `inputs` are explicitly "pinned" similar to what a package lock file does in any other programming language

AI has also been a huge boon, particularly as a collaborator. I am playing with all of this on a VM (as anyone should) before I opt to replace Fedora on [[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/Dotfiles Reorg\|Boreas]].

You may also be wondering: "hmm, if you're using Fedora, why not use one of the atomic spins?" Well, anon, that's because atomic spins don't provide the same reproducibility guarantees as NixOS. From what I understand, with atomic spins, we'd all more or less start with the exact same OS base version, but that's it. Changes are still made imperatively using package managers, and though those changes are underpinned by a reproducible base image, transactional updates (via `rpm-ostree`), rollbacks, etc…, the potential for drift between my setup scripts and system state is still high.

So here we are, NixOS. I've been with Fedora since v34, but now it's time for a change. I've got [this PR](https://github.com/OlaoluwaM/nixos-config/pull/1) that migrates my DE/WM-agnostic packages onto Nix. Take a look, and let me know what you think!

[[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/NixOS, the journey continues (part 2)\|Part 2!]]
