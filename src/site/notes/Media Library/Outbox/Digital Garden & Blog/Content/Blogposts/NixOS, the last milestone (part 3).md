---
{"dg-publish":true,"dg-path":" Posts/NixOS, the last milestone (part 3).md","dg-permalink":"/posts/nixos-the-last-milestone-part-3","permalink":"/posts/nixos-the-last-milestone-part-3/","title":"NixOS: The last milestone (part 3)","metatags":{"description":"Like the third installment to a semi-epic TV show. Nix does sound like a cool MC name"},"tags":["linux","software-engineering"],"created":"2026-05-10T20:40:04.743-05:00","updated":"2026-05-20T17:43:34.192-05:00","dg-note-properties":{"tags":["linux","software-engineering"],"title":"NixOS: The last milestone (part 3)"}}
---

Alrighty! Since [[Media Library/Outbox/Digital Garden & Blog/Content/Blogposts/NixOS, the journey continues (part 2)\|part 2]], I've handled the hardware configuration for my NixOS setup. Specifically, the configuration for an Intel CPU and Integrated GPU, and an NVIDIA GPU. My initial plan was to make reusable modules for each component, so I could plug'n'play across hosts. I wanted separate modules for an Intel CPU & GPU, separate modules for an AMD CPU & GPU, and a module for an NVIDIA GPU. However, as it turns out, all that is already covered by the [nixos-hardware project](https://github.com/NixOS/nixos-hardware). In fact, all I needed to do was find the module corresponding to my host model and just import and hook it up to get all the hardware configuration I was looking for, or at least a baseline to work up from. Pretty neat I say.

Beyond that I also added configuration for some other miscellaneous items. To check those out, feel free to peruse the [PR](https://github.com/OlaoluwaM/nixos-config/pull/4)

In part 2, I spoke about how helpful LLMs were in standing all this up. So, I figure it's only right to now show you, or at least, offer up a snapshot of the kinds of interactions/conversations I have with them within the context of this project.

On the branch for this work, I started with the following prompt:

> Alright, the final milestone before I test this in a VM would be setting up hardware integration, things like NVIDIA GPU support, Intel support, AMD (CPU & GPU) support. Boreas has an intel cpu and integrated gpu with an NVIDIA GPU. So it makes sense to directly have options for that in its configurations. However, capturing those options in a module would allow for reusability which I think is much more valuable. I also plan to get a framework in the near/distant future with potentially an AMD CPU and Nvidia GPU, but having separate modules for each makes sense. One for AMD CPU and another for AMD GPU. What do you think? We're just brainstorming here

Ignoring the grammar for a bit, I find myself increasingly asking the LLM for its "thoughts" in my prompts. I think the reason I do this is to force brainstorming in some form. To make interactions with it more "interactive", rather than just telling it what to do and having it "go forth". I like to think that I am taking advantage of the fact that LLMs have knowledge they've gleamed from the huge amount of text and code they are trained on. So it makes sense to want to learn from/query that a bit. LLMs, for all their faults (and the faults of the people behind them), know things. Thus, it only makes sense to want to leverage that knowledge by having them check *my* reasoning against their vast repository.

Nevertheless, that does not mean that their answers should be trusted by default. It does, however, make them useful as a kind of reasoning surface: I can explain what I'm thinking, ask for pushback, and then check the response against real/alternative sources.

Now, from that initial prompt, the LLM came back with a useful framing:

`````ad-ai-text
I think your direction is good: split by hardware capability, not by machine.

For Boreas, the host config should basically say:

```nix
my.hardware.cpu.intel.enable = true;
my.hardware.gpu.intel.enable = true;
my.hardware.gpu.nvidia.enable = true;
my.hardware.gpu.nvidia.hybrid.enable = true;
```
Then the reusable modules own the messy details.

...

One caveat: this is a good milestone before a VM test for module evaluation, builds, and option shape, but a VM will not meaningfully validate NVIDIA/AMD/Intel hardware behavior. It can tell you “the config composes”; the real machine tells you “the driver stack behaves.” Still worth doing now, just don’t overestimate what the VM proves.
`````


See how it responds like a "coworker" and not a "yes master, of course master" slave. There is also a bit of push back. I then follow up by saying

> This all tracks with what I was thinking about. And yes, there will absolutely be host specific configuration not suitable for a reusable module, but that's out of scope for now as those kinds of things tend to pop up as one goes. For the reusable hardware modules, I want to give it a shot myself first, but some inspiration in the form of real-world repo examples would be helpful

I like how it feels like a conversation. I'm speaking to what the LLM has told me and suggested. I am looking for code examples I can learn from and indirectly grounding the LLM to actual factual code samples on GitHub in the process.

> [!aside]
> I like getting inspiration from GitHub because a lot of code lives there (it's current reputation aside). Seems like a great place to learn from others. Pre-AI I'd make good use of the search feature. Now I just describe what I'm looking for and have GitHub Copilot pull up results. It's a pretty neat practice.

The LLM then replies with

`````ad-ai-text
Yep. Here are the examples I’d study.

**Best Reference**

- `nixos-hardware` is the main one: [common/cpu](https://github.com/NixOS/nixos-hardware/tree/master/common/cpu) and [common/gpu](https://github.com/NixOS/nixos-hardware/tree/master/common/gpu). What to steal:
	- Intel CPU has both `default.nix` and `cpu-only.nix`; the default imports CPU + Intel GPU, but the CPU-only escape hatch exists.
	- AMD CPU is tiny: it mostly sets `hardware.cpu.amd.updateMicrocode`.
	- AMD GPU uses `mkDefault` for `modesetting`, `hardware.graphics.enable`, `enable32Bit`, and `hardware.amdgpu.initrd.enable`.
	- Intel GPU is richer: it exposes options for `i915` vs `xe`, compute runtime, media runtime, VAAPI driver, and kernel-version assertions.

That last point is the big architectural lesson.

**Other Useful Patterns**


```nix
nixos.system.gpu.maker = "amd" | "intel" | "nvidia";
```

...
`````

Now, this part might sound a little hand-wavy, but the `nixos-hardware` it mentions piqued my interest. It sounded like something to take a look into, and so I did. What I found was something that already handles what I was trying to do. Something I could integrate rather than try to replicate, so that's what I did. I replied by saying

> Or maybe I should just use nixos-hardware outright. No sense duplicating work. Or have my own integration based on it

Then from there we got around to integrating `nixos-hardware`. Fortunately, there is a module for the 2022 version of my host device that still holds with the 2023 version, so I could use it without any modifications. It would have been cooler/nicer if the LLM straight up told me from the start, "No bro, just use nixos-hardware". I think if it truly understood what it is I was trying to do, it would have made that suggestion. Then again, perhaps if I had asked it to suggest the best/most conventional way of going about what I wanted to do, it might have made the "nixos-hardware" suggestion more immediately.

I think this interaction is a good reminder that whatever "understanding" we think these systems have is brittle and prompt-dependent. Codex only had `nixos-hardware` as *an* answer to my query despite it being *the* answer to what I was trying to accomplish. It didn't and perhaps wouldn't have made the connection unless I set it up to do so. But that's fine because I was there to do that. For me, this is yet another strong case for keeping a human in the loop: the model can surface options, but someone still has to recognize which option actually fits the job.

Nevertheless, from there, we worked to port over things like cron jobs to systemd timers, handle dotfiles symlinking via home-manager, and improve the overall cohesion of the configuration, which just means consolidating and having less duplication.

Since writing this blog post I have two other branches based off this one for refinements from testing and Hyprland ricing. I plan to make PRs for those and may even write accompanying blog posts if there's anything to share.

With that, thanks for stopping by. Till next time!
