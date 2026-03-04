# Troubleshooting

## `better-sqlite3` native module issues

PromptCanary uses `better-sqlite3` for local storage. Most environments use prebuilt binaries, but some require local compilation.

### Prebuilt binary download fails

```bash
npm rebuild better-sqlite3
```

Requirements for source builds:

- Python 3
- C/C++ build tools

### Alpine Linux and Alpine-based Docker images

```dockerfile
RUN apk add --no-cache python3 make g++
RUN npm install
```

### CI environments

If your runner does not provide native build tools, install them before dependency install.

Typical requirement set:

- `python3`
- `make`
- C++ toolchain

### Windows

Install Visual Studio Build Tools with Desktop development with C++ workload.

Alternative legacy command:

```bash
npm install --global windows-build-tools
```

## Common errors and fixes

### Missing API key

Error resembles: `Missing API key in environment variable: ...`

Fix:

- Ensure env var name matches `api_key_env` in config.
- Confirm variable is present in current shell or `.env` file.
- Use `promptcanary --dotenv <path> run ...` for non-default env file paths.

### Invalid config schema

Error resembles: `Config validation failed ...`

Fix:

- Validate with `promptcanary validate promptcanary.yaml`.
- Check required top-level fields: `version`, `config.providers`, `tests`.
- Ensure `min_length <= max_length` when both are set.

## FAQ

### Where is run data stored?

By default in `promptcanary.db` (SQLite) in the working directory.

### Does PromptCanary need external infrastructure?

No. It is designed to run as a self-contained CLI with local SQLite storage.

### Can I run tests across multiple providers in one run?

Yes. Define multiple providers in `config.providers` and optionally narrow per test with `tests[].providers`.

### What happens if embedding API is unavailable?

Structural assertions still run. Semantic similarity checks are skipped and reported as warning details.
