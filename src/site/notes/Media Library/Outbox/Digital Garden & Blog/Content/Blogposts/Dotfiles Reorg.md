---
{"dg-publish":true,"dg-path":" Posts/Dotfiles Reorg.md","dg-permalink":"/posts/dotfiles-reorg-a-journey","permalink":"/posts/dotfiles-reorg-a-journey/","title":"Dotfiles Reorg: A Journey","metatags":{"description":"Onwards to NixOS"},"tags":["linux","software-engineering"],"created":"2026-05-03T17:12:45.954-05:00","updated":"2026-05-03T18:48:10.371-05:00","dg-note-properties":{"tags":["linux","software-engineering"],"title":"Dotfiles Reorg: A Journey"}}
---

[I did some spring-cleaning on my dotfiles](https://github.com/OlaoluwaM/dotfiles/pull/3). Since I am planning on moving to NixOS, I figured now was as good a time as any to renovate. I've had this structure for a long time, and it has served me well, but nothing lasts forever, I suppose.

The layout up to this point was basically an answer to "what's the simplest thing I could do?", a question I like to ask myself when trying to do pretty much anything. I first opted to have all my dotfiles grouped by function and listed out at the top-level. Then I adopted having a `.config` parent directory.

It was all well and good until I joined Freckle and got a Mac. I then had to scope my dotfiles by OS: one for `mac` and one for `fedora`. I've deleted the `mac` directory in this PR since I don't work at Freckle anymore. Now I just have an out-of-place top-level `nixos` directory because I still use it on my work Framework. It shouldn't be too much effort to move that over, though I'd need to give it a name.

In any case, if you take a look at the PR, you'll notice that `boreas` is a top-level directory with a `fedora` and `nixos` sub-directory. This is me embracing the Nix convention of organizing configuration per-host.

> [!aside]
> [Boreas](https://en.wikipedia.org/wiki/Boreas) is the name I have bestowed upon my current device, my 2023 ASUS ROG Zephyrus M16 (the product line has unfortunately been abandoned by ASUS). I will exclusively be adopting names from ancient Greek mythos for my devices.

Moving forward, each host directory will have sub-directories for each OS used or planned for it. This lends itself to dual booting too. In addition to those, there is a sub-directory called `common` where stuff that's, well, common among at least two OS sub-directories is kept and symlinks are created between it and the relevant OS sub-directories. This way, I no longer need to copy and paste to ensure parity across OSes. I can just edit the files in `common` and the changes will be there everywhere. There's also a bit of cognitive value with having the host be the top-level and the OSes inside that: co-location. That co-location is what allows for that `common` directory in the first place. Doing it the other way, with the OS as the top-level entity and the hosts within those just seemed suboptimal to me.

One interesting thing I did with this renovation was make sure to use "relative" symlinks. That way, the symlinks are never tied to any one host filesystem. It makes them portable and independent of the structure of the filesystem outside the repository.

All in all, I'm happy with how it's all turned out and hope to get myself over to NixOS soon. Lots of things to learn. Let's see how it goes.
