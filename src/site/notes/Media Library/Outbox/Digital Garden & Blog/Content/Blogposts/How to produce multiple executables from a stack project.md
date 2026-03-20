---
{"dg-publish":true,"dg-path":" Posts /How to produce multiple executables from a stack project.md","dg-permalink":"how-to-produce-multiple-executables-from-a-stack-project","permalink":"/how-to-produce-multiple-executables-from-a-stack-project/","metatags":{"description":"To produce an executable"},"created":"2026-03-20T15:36:58.478-05:00","updated":"2026-03-20T15:39:49.272-05:00"}
---


Ever wondered how to produce multiple executables from your `stack` project? Neither did I until I found myself unable to do so in an experiment I was playing with. I've figured it out now though, and for future reference, whenever things of this nature come up you'll probably want to look at how it's done in Cabal then extrapolate for Stack making use of the [hpack repository](https://github.com/sol/hpack) for reference, or just use Cabal. I don't want to yet cause I'm in too deep

> [!aside] Aside
> It is common for you to hear executables be referred to as "*targets*".

Anyway, with that said, When you want to generate multiple executables from your `stack` project, you do so by defining additional entries under the `executables` stanza in your `package.yaml` file. The snippet below is an example. In it, we've defined two executables that our project may produce. You'll notice that the `main` module for each entry is under the same directory.

```yaml
executables:
  initial-exe:
    main: Main.hs
    source-dirs: app
    ghc-options:
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - package-name

  scenario1:
    main: Scenario1.hs
    source-dirs: app
    other-modules: [] # Prevents hpack from auto-discovering `main` modules listed in the other executable entry within the same directory. If we don't add this, stack will try to compile those modules while compiling the project to create this executable
    ghc-options:
      - -fprof-auto
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - package-name
```

Note that in this case, the module in `app/Scenario1.hs` must be named `Main`, not `Scenario1`. This is because GHC expects the entry point module to be named `Main` and export a `main` function. You can work around this using the [`-main-is` ghc-option](https://stackoverflow.com/questions/14238729/producing-multiple-executables-from-single-project) like so

```yaml
executables:
  initial-exe:
    main: Main.hs
    source-dirs: app
    ghc-options:
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - package-name

  scenario1:
    main: Scenario1.hs
    source-dirs: app
    other-modules: [] # Prevents hpack from auto-discovering `main` modules listed in the other executable entry within the same directory. If we don't add this, stack will try to compile those modules while compiling the project to create this executable
    ghc-options:
      - -fprof-auto
      - -threaded
      - -rtsopts
      - -main-is Scenario1 # This allows us avoid needing to set the module name to `Main` in `Scenario1.hs`
      - -with-rtsopts=-N
    dependencies:
      - package-name
```

Personally, I prefer to [give each executable its own directory](https://stackoverflow.com/questions/54150751/how-to-define-multiple-executables-main-modules-with-stack-hpack). This way, there's no need to manually set the `other-modules` field of each executable entry to `[]`, plus I think it allows for more modularity/greater separation of concerns; if you've got different executables, you probably have a different use case for each. Should you decide to go with this approach, you'd structure your directory like so:

```markdown
.
├── app <- Holds one executable module
│   └── Main.hs
├── scenario1 <- Holds another executable module
│   └── Main.hs
└── src <- project lib
```

Then your `package.yaml` configuration ought to look something like

```yaml
executables:
  initial-exe:
    main: Main.hs
    source-dirs: app
    ghc-options:
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - package-name

  scenario1:
    main: Scenario1.hs
    source-dirs: scenario1
    ghc-options:
      - -fprof-auto
      - -threaded
      - -rtsopts
      # - -main-is Scenario1
      - -with-rtsopts=-N
    dependencies:
      - package-name
```

By placing the `main` module of each of our executables in a separate directory, we no longer need to add the `other-modules: []` field to each entry since `cabal` (which `stack` uses under the hood) becomes smart enough to know that the `Main.hs` module in the `app` directory has no relation to the `Scenario1.hs` module in the `scenario1` directory.

Now, if we wanted to execute one of these "targets", we could do

```bash
stack run scenario1 -- <options-to-pass-to-executable>
```

[`stack run`](https://docs.haskellstack.org/en/stable/commands/run_command/) will first compile, then run the resulting executable. If you don't pass an executable name, `stack run` will compile and run the first executable listed under your project's `executables` stanza.

```bash
stack run  -- <options-to-pass-to-executable>

# Synonymous with

stack run initial-exe -- <options-to-pass-to-executable>
```

There is also [`stack exec`](https://docs.haskellstack.org/en/stable/commands/exec_command/), but it will only run the executable. It does not re-compile it.

```bash
stack exec scenario1 -- <options-to-pass-to-executable>
```

If you wanted to just compile/build a specific target without running it, you'd need to use the [`stack build`](https://docs.haskellstack.org/en/stable/commands/build_command/#target-project-package-component)

```bash
stack build my-package:exe:my-executable
stack build my-package:exe:my-executable-2
stack build other-package-in-proj:exe:exe3
```

And there you have it, now go do stuff
