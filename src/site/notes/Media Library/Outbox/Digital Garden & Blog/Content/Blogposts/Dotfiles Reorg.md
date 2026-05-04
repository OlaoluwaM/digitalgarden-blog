---
{"dg-publish":true,"dg-path":" Posts/Dotfiles Reorg.md","dg-permalink":"/posts/dotfiles-reorg-a-journey","permalink":"/posts/dotfiles-reorg-a-journey/","title":"Dotfiles Reorg: A Journey","metatags":{"description":"Onwards to NixOS"},"tags":["linux","software-engineering"],"created":"2026-05-03T17:12:45.954-05:00","updated":"2026-05-03T22:23:14.955-05:00","dg-note-properties":{"tags":["linux","software-engineering"],"title":"Dotfiles Reorg: A Journey"}}
---

[I did some spring-cleaning on my dotfiles](https://github.com/OlaoluwaM/dotfiles/pull/3). Since I am planning on moving to NixOS, I figured now was as good a time as any to renovate. I've had my current setup for a long time. It has served me well, but nothing lasts forever, I suppose.

The layout up to this point was basically an answer to the question: "what's the simplest thing I could do?".

I first opted to have all my dotfiles grouped by function and listed out at the top-level. Following that, I adopted having a `.config` parent directory.

It was all well and good until I got a Mac for work. I then had to scope my dotfiles by OS: one for my Mac and one for my Fedora system. I deleted the `mac` directory in this PR since I don't have a Mac anymore (should've done that sooner). Now I just have the remaining out-of-place top-level `nixos` directory that I use on my work Framework. It shouldn't be too much effort to move it over, though I'd need to give it a name.

In any case, if you took a look at the PR, you'll notice that `boreas` is now a top-level directory with a `fedora` and `nixos` sub-directory. This is me embracing the Nix convention of organizing configuration per-host.

> [!aside]
> [Boreas](https://en.wikipedia.org/wiki/Boreas) is the name I have bestowed upon my current device, my 2023 ASUS ROG Zephyrus M16 (the product line has, unfortunately, been abandoned by ASUS AFAICT).
>
> I will exclusively be adopting names from ancient Greek mythos for my devices.

Moving forward, each host directory will have sub-directories for each OS used or planned for it. This lends itself to dual booting too. In addition to those, there is the option for a sub-directory called `common` where stuff that's, well, common among at least two OS sub-directories is kept and symlinks are created between it and the relevant OS sub-directories. This way, I no longer need to copy-paste to ensure parity across OSes. I can just edit the files in `common` and the changes will propagate.

There's also some added cognitive benefit to having hosts as the top-level entity and OS directories as sub-directories: co-location. All the dotfiles relevant to a host are grouped together.

This co-location is what allows for the `common` sub-directory I just described. Doing it the other way, with the OS as the top-level entity and the hosts nested within just seemed suboptimal to me. We'd end up with configurations for a given host scattered across different directories. Nope.

One interesting thing I did with this renovation was make sure to use "relative" symlinks. That way, the symlinks are never tied to any one host filesystem. It makes them portable and independent of the structure of the filesystem outside the repository.

All in all, I'm happy with how it's all turned out and hope to get myself over to NixOS soon. Lots of things to learn. Let's see how it goes. Oh and feel free to add a comment to the PR if you've got anything to say!
