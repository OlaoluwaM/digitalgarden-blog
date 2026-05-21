---
{"dg-publish":true,"dg-path":" Posts/NixOS, the journey continues (part 2).md","dg-permalink":"/posts/nixos-the-journey-continues-part-2","permalink":"/posts/nixos-the-journey-continues-part-2/","title":"NixOS: The journey continues (part 2)","metatags":{"description":"Putting a GUI on this thang"},"tags":["linux","software-engineering"],"created":"2026-05-06T08:04","updated":"2026-05-21T11:04","dg-note-properties":{"tags":["linux","software-engineering"],"title":"NixOS: The journey continues (part 2)","created":"2026-05-06T08:04","updated":"2026-05-21T11:04"}}
---

Since [[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/NixOS, the start of something new (part 1)\|part 1]], I have done work to configure and make configurable the GUI for my budding NixOS setup. If you're interested in the code, the PR for it can be found [here](https://github.com/OlaoluwaM/nixos-config/pull/3). Comments and feedback welcome!

Now, getting into some detail, AI, specifically Codex, has been really valuable thus far with this project. It's been a useful collaborator in discovering config options, understanding how they work (standalone or with others), figuring out best practices, and reviewing my work. One particularly interesting application has been using GitHub Copilot to search for real-world examples of derivations that I could draw inspiration from. I mainly did this to help with writing derivations for things not available in Nixpkgs; these can be found in the [`pkgs`](https://github.com/OlaoluwaM/nixos-config/tree/main/pkgs) directory.

It turns out that there are different strategies for writing a derivation depending on the kind of software you're looking to package. So far, I've got one for a binary program, a Go program, and a Python program. None of them look like the others. Codex was useful in ensuring I was on the right track and in offering suggestions.

Generally, being able to prompt Codex with "could you take a look at this, am I on the right track?", or "is this the best way to do this?" took a lot of frustration out of things. I think having these kinds of interactions is a great way to learn and get ramped up quickly because you aren't just letting the AI do all the work; you're pair programming with it. I, for one, believe this approach has helped me get up to speed at a much faster pace than I would have otherwise. I'm still fuzzy on a couple of things, like `inherit` for instance, but I have come away with a better understanding of and greater appreciation for the configurability and level of control Nix offers.

The work behind the PR also taught me a few things:

- Using `lib.fakeHash` in place of hashes you want NixOS to correct/fill in for you. This is relevant to my project because I'm working on my setup on a Fedora system and then testing it in a VM.
- Some of the different ways a derivation can be made to package software and the different options available to simplify the process based on the kind of software you want to package. For instance, with a Go program, you may want to use something like `buildGoModule`; for Python, you may want to reach for `python3Packages.buildPythonApplication`.
- Derivations by default attempt to do a `make build`, but you can instruct them not to do that by setting the `dontBuild` option to `true`. This was useful with the `rxfetch` derivation since [its repo](https://github.com/mngshm/rxfetch) already contained the binary.
- You can section off configuration into modules and create interfaces to create a more focused public "API" for those configurations. See [`desktop.nix`](https://github.com/OlaoluwaM/nixos-config/pull/3/changes#diff-feca8763973a8b955b20039acae4cf20ae097b032f86eafaf2ca6d066d538ab8).
- Nix supports imperative scripts using [`writeShellApplication`](https://nixos.asia/en/writeShellApplication). Scripts written in this way won't be run automatically but act more like shell scripts defined in a `.zshrc` or `.bashrc` file. They will be made available for you to invoke in your shell.
- Not everything can or should be configured with Nix. DE settings, sure, cloning stuff from GitHub? Setting up an SSH connection with a server? Probably not, unless you wish to do so with a Nix script. My intuition for this is still nascent so I don't really have a concrete heuristic to share.
- Whatever you have configured in `dconf` in GNOME can probably be configured in Nix
- It's just like software engineering. Group and encapsulate related configurations. Expose them using abstract interfaces. The Nix language has support for defining your own options.
- Nix flakes have this requirement where files/modules must be checked into Git before they are evaluated. To circumvent this, you can use the `git add -N` command, which signals the intent to check in a file.

From here, I plan on creating modules for integrating with NVIDIA GPUs, AMD hardware (CPU & GPU), and Intel. I think that will be the last major piece before I start testing this in my VM. Let's see how it goes. Till next time!

[[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/NixOS, the last milestone (part 3)\|Part 3]]
