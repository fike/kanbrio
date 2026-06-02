# Stage 1: Builder
FROM rust:1.95-slim-bookworm AS builder

# Install system build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Create a dummy project and build dependencies to cache them
RUN cargo new --bin kanbrio-api
WORKDIR /usr/src/app/kanbrio-api

COPY Cargo.toml Cargo.lock ./
COPY .sqlx ./.sqlx

# Cache dependencies
RUN cargo build --release
RUN rm -f src/*.rs target/release/deps/kanbrio_api*

# Copy actual source files
COPY src ./src

# Build for release (offline mode — uses .sqlx/ cache)
RUN SQLX_OFFLINE=true cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install system runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app

# Copy binary from builder
COPY --from=builder /usr/src/app/kanbrio-api/target/release/kanbrio-api /usr/app/kanbrio-api

# Expose port
EXPOSE 3000

# Set default env
ENV HOST=0.0.0.0
ENV PORT=3000

# Run API server
CMD ["/usr/app/kanbrio-api"]
