# ── Stage 1: Builder ─────────────────────────────────────────────
FROM rust:1.95-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy API manifest and SQLx cache first (better layer caching)
COPY apps/api/Cargo.toml apps/api/Cargo.lock ./
COPY apps/api/.sqlx ./.sqlx
ENV SQLX_OFFLINE=true

# Create minimal src to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f src/*.rs target/release/deps/kanbrio_api*

# Copy actual source
COPY apps/api/src ./src

# Build the binary
RUN cargo build --release

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/kanbrio-api /usr/local/bin/kanbrio-api

EXPOSE 3000

CMD ["kanbrio-api"]
