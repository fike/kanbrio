FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/kanbrio-api /usr/local/bin/kanbrio-api

EXPOSE 3000

CMD ["kanbrio-api"]
