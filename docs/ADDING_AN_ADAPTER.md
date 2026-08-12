# Adding a platform adapter

## Prerequisites

1. An anonymized fixture from Diagnostics / Compatibility Capture (no PII values).
2. Placement under `fixtures/corpus/`.
3. Replay test green for detection expectations.

## Steps

1. Copy `src/adapters/_template/adapter.ts` to `src/adapters/<platform>/adapter.ts`.
2. Implement `detect`, `inspect`, `fill`, `validate`.
3. Register in `src/adapters/registry.ts`.
4. Add `tests/adapters/<platform>.contract.test.ts` using `describeAdapterContract`.
5. Add synthetic mount helpers; never invent selectors without fixture evidence.
6. Run:

```bash
npm run test:adapters
npm run test:fixtures
npm test
npm run typecheck
npm run build
```

## Confidence rules

- Exact tested selectors → confidence 1.0
- Platform patterns → ~0.95
- Semantic labels alone → fill only if ≥ 0.8 and author groups are fill-safe
- Ambiguous / structural guesses → unresolved (Preview only)

## Safety

Never click submit/certify/payment/signature controls. Never read passwords or auth tokens. Default preserve non-empty fields.
