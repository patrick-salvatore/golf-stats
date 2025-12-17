# Build Stage
FROM elixir:1.18-otp-27-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache build-base git

# Install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Set build env
ENV MIX_ENV=prod

# Install mix dependencies
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

# Compile and build release
COPY config config
COPY lib lib
COPY priv priv

RUN mix compile
RUN mix release

# Runner Stage
FROM alpine:3.19

RUN apk add --no-cache libstdc++ ncurses-libs openssl sqlite

WORKDIR /app

COPY --from=builder /app/_build/prod/rel/golf_stats_server ./

# Create data directory for SQLite
RUN mkdir -p /data
ENV DATABASE_PATH=/data/golf.db

# Command to run migrations and then start the server
CMD ["sh", "-c", "bin/golf_stats_server eval 'GolfStatsServer.Release.migrate' && bin/golf_stats_server start"]
