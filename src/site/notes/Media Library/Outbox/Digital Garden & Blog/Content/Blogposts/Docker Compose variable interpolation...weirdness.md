---
{"dg-publish":true,"dg-path":" Posts/Docker Compose variable interpolation...weirdness.md","dg-permalink":"docker-compose-variable-interpolation-weirdness","permalink":"/docker-compose-variable-interpolation-weirdness/","metatags":{"description":"Ok then."},"created":"2026-03-20T15:40:02.446-05:00","updated":"2026-03-20T15:41:07.446-05:00"}
---


Maybe not weirdness but I ran into something rather strange today. It looks like variables used in interpolation don't get pulled from the env files defined under the `env_file` option for a service. Essentially

```yaml
  db:
    image: postgres:16
    env_file:
      - path: ./backend/.env.something
        required: true
      - path: ./backend/.env.dev
        required: false
    environment:
      POSTGRES_DB=${POSTGRES_DB} # The variable for this will always be pulled from the shell env and .env specifically rather than from the env files defined as part of the service's `env_file` option
      POSTGRES_USER=${POSTGRES_USER}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

As you can probably tell from the example, this means the variables used in interpolations won't be sourced from the service's associated `env_file` env file(s), but rather will always be sourced from the shell and *the* `.env` file. So you can't mix `env_file` and `environment` with interpolation in the same service definition and expect things to work properly.

Our options then seem to be:

- Have separate `.env` files per service with no interpolation, so you'll have to copy stuff (like port numbers) and remember to update across files
- Put everything in a single `.env` file, but prefix accordingly to avoid name-collision and allow for interpolation

> [!aside] Aside
> Name collisions can happen when different services have the same env var requirements, like a service for a dev db and test db. Both will accept the usual [Postgres env variables](https://github.com/docker-library/docs/blob/master/postgres/README.md#environment-variables). So if you're using a single `.env` file, you'll need prefixes to differentiate and avoid collisions

A third option might be to put the variables used in interpolations in *the* `.env` file and everything else goes into the per service `env_file(s)`. You'll still need to watch out for name collisions and prefix accordingly

What do y'all think? Is there a better option? Since this blog of mine doesn't support comments, [@ me on BluSky](https://bsky.app/profile/olamusta.bsky.social) with your commentary instead. Link to this post too, so I know what you're talking about, heh
