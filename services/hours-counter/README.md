# Corresponding hours counter

Privacy-safe marketing total. The extension POSTs `{ "v": 1, "authors": 12 }` after an eligible fill. No names, emails, URLs, roster ids, or page content.

## Endpoints

- `GET /` — plain-text hours line for a screenshot
- `GET /stats` — `{ authorsFilled, hoursSaved, secondsPerAuthor }`
- `POST /ping` — increment; body may contain only `v` and `authors`

## Deploy

```bash
cd services/hours-counter
npx wrangler kv namespace create HOURS
# paste the id into wrangler.toml
npx wrangler deploy
```

Default production URL baked into the extension:

`https://corresponding-hours.kylekimler.workers.dev`

Override with `VITE_HOURS_COUNTER_URL`. Set `VITE_HOURS_COUNTER_DISABLE=1` to skip pings. Vitest never pings.
