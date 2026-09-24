# Escrows and streams over HTTP

Escrows and payment streams live in the contract (`create_escrow`, `release_escrow`,
`release_by_arbiter`, `claim_escrow`, `create_stream`, `claim_stream`, `cancel_stream`) and are reached
over the HTTP surface in `src/app/api/escrows` and `src/app/api/streams`. This page is written for the
integrator calling that surface: the request and response of each endpoint, the state machine of each
object, and the error codes worth handling.

> **There is no UI for either feature yet.** The contract reference documents the on-chain semantics
> and this page documents the HTTP ones; a dashboard for escrows and streams is tracked separately
> (escrow management UI: issue #798, stream UI: issue #799).
>
> **Writes are signed by the client, not by these routes.** `POST` validates the request and returns
> the parameters to sign with — it does not create the object. Creation happens when the wallet signs
> the corresponding contract call (`createEscrow` / `createStream` on the client). The `202 Accepted`
> on both POSTs is that hand-off, not a completed write.

## Endpoints

| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/escrows` | `GET` | API key or wallet session | `?id=N` returns one escrow; without `id` returns the escrow count |
| `/api/escrows` | `POST` | + CSRF | Validates the parameters and returns them for client-side signing (`202`) |
| `/api/escrows/{id}` | `GET` | API key or wallet session | One escrow by numeric id; `404` when the contract has none |
| `/api/streams` | `GET` | API key or wallet session | `?id=N` returns one stream; without `id` returns the stream count |
| `/api/streams` | `POST` | + CSRF | Validates the parameters and returns them for client-side signing (`202`) |
| `/api/streams/{id}` | `GET` | API key or wallet session | One stream by numeric id; `404` when the contract has none |

Every response uses the API envelope: `{ "success": true, "data": … }` for reads and
`{ "success": false, "error": { "code", "message" } }` for failures. See
[API_GUIDE.md](./API_GUIDE.md) for the conventions and [`src/lib/error-codes.ts`](../src/lib/error-codes.ts) for the full catalogue.

### `GET /api/escrows`

```
GET /api/escrows
Authorization: Bearer <api-key>
```

```json
{ "success": true, "data": { "count": 12 } }
```

With `?id=7`, the escrow itself is returned. A chain read that cannot be simulated answers
`200` with `data.available = false` and the reason, rather than pretending the escrow does not exist:

```json
{ "success": true, "data": { "available": false, "error": "host function failed" } }
```

### `POST /api/escrows`

```json
{
  "depositor": "GDEPOSITOR…",
  "beneficiary": "GBENEFICIARY…",
  "amount": "250.00",
  "asset": "native",
  "deadline": 1767225600,
  "metadata": "invoice 42"
}
```

`202 Accepted` — the request is well-formed and ready to sign; nothing is created yet:

```json
{
  "success": true,
  "data": {
    "message": "Escrow creation requires wallet signing via the client-side createEscrow flow.",
    "params": {
      "depositor": "GDEPOSITOR…",
      "beneficiary": "GBENEFICIARY…",
      "amount": "250.00",
      "asset": "native",
      "deadline": 1767225600,
      "metadata": "invoice 42"
    }
  }
}
```

`depositor`, `beneficiary` and `amount` are required; omitting any of them is a `400` with
`VALIDATION_ERROR`. `asset` defaults to `"native"` when omitted.

### `GET /api/escrows/{id}`

```json
{ "success": true, "data": { "id": 7, "depositor": "G…", "beneficiary": "G…", "amount": "250.00", "released": false } }
```

A non-numeric id is rejected with `400 VALIDATION_ERROR`; an id the contract does not know is
`404` with `ESCROW_NOT_FOUND`.

### `GET /api/streams`, `POST /api/streams`, `GET /api/streams/{id}`

The stream endpoints mirror the escrow ones. The POST body is:

```json
{
  "creator": "GCREATOR…",
  "recipient": "GRECIPIENT…",
  "totalAmount": "1200.00",
  "asset": "native",
  "startTime": 1767225600,
  "endTime": 1769817600,
  "metadata": "salary Q4"
}
```

`creator`, `recipient` and `totalAmount` are required (`400 VALIDATION_ERROR` otherwise), and the
response is the same `202` hand-off with `message: "Stream creation requires wallet signing via the
client-side createStream flow."`. `GET /api/streams/{id}` answers `404 STREAM_NOT_FOUND` for an id the
contract does not know; a non-numeric id is answered as `404 STREAM_NOT_FOUND` too, because the route
treats an unparseable id as "no such stream" rather than a malformed request.

## Escrow state machine

```
create_escrow ──► held
                   │  deadline passes
                   ▼
                 due ──release_escrow (depositor or beneficiary)──► released ──claim_escrow (beneficiary)──► paid out
                   │
                   └─release_by_arbiter (arbiter only, either direction)────────────────────────────────────┘
```

- `create_escrow` requires the depositor's auth, an amount greater than zero, a deadline in the future,
  and transfers the deposit into the contract immediately.
- `release_escrow` may be called by the depositor or the beneficiary, and only once the deadline has
  passed: `EscrowNotFound` (8), `EscrowNotDue` (6), `EscrowAlreadyReleased` (7), `Unauthorized` (4).
- `release_by_arbiter` lets the configured arbiter release to either party when an escrow names one —
  the escape hatch for a dispute. It is also the only path that does not wait for the deadline.
- `claim_escrow` moves the released amount to the beneficiary; until it is claimed the funds sit with
  the released escrow.

## Stream state machine

```
create_stream ──► accruing ──claim_stream (recipient)──► accruing ──…──► fully claimed
                     │
                     └──cancel_stream (creator)──► cancelled (unclaimed remainder returns to the creator)
```

- `create_stream` requires the creator's auth, an amount greater than zero and `end_time > start_time`;
  the full amount is deposited up front, and the recipient's claimable balance grows **linearly** with
  elapsed time between `start_time` and `end_time`.
- `claim_stream` may be called by the recipient as often as they like and returns the amount claimed in
  that call. Before `start_time` it fails with `StreamNotStarted` (9); once the whole amount has been
  claimed it fails with `StreamFullyClaimed` (12).
- `cancel_stream` may be called by the creator; the recipient keeps what has already vested and the
  remainder returns to the creator. A second cancel fails with `StreamAlreadyCancelled` (10).
- Streams accrue in the contract, so a claim after a long gap returns everything vested so far in one
  call — an integrator does not need to poll to keep the balance accurate.

## Error codes to handle

HTTP-level codes (the full list lives in [`src/lib/error-codes.ts`](../src/lib/error-codes.ts)):

| Code | HTTP | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | No API key and no wallet session |
| `VALIDATION_ERROR` | 400 | A required field is missing, or a non-numeric id on `/api/escrows/{id}` |
| `ESCROW_NOT_FOUND` | 404 | The contract has no escrow with that id |
| `STREAM_NOT_FOUND` | 404 | The contract has no stream with that id, or the id is not a number |
| `ESCROW_ALREADY_FUNDED` | 409 | The escrow was already funded |
| `ESCROW_ALREADY_COMPLETED` | 409 | The escrow is already settled |
| `ESCROW_DISPUTED` | 409 | The escrow is in dispute |
| `STREAM_ALREADY_ACTIVE` | 409 | The stream is already running |
| `ESCROW_EXPIRED` | 400 | The escrow's deadline passed without a release |
| `ESCROW_RESOLVED` | 400 | The escrow has been resolved |
| `STREAM_PAUSED` / `STREAM_CANCELLED` / `STREAM_COMPLETED` | 400 | The stream is not accruing |

The contract's own numeric codes (`EscrowNotFound` 8, `EscrowNotDue` 6, `EscrowAlreadyReleased` 7,
`StreamNotFound` 11, `StreamNotStarted` 9, `StreamFullyClaimed` 12, `StreamAlreadyCancelled` 10,
`StreamEndBeforeStart` 69, `StreamInvariantViolated` 307) are decoded by
[`src/lib/contract-errors.ts`](../src/lib/contract-errors.ts) and surface through `CONTRACT_ERROR` with
the decoded message; match on the HTTP code and read the message for the contract's reason.

## See also

- [`docs/CONTRACT_FUNCTION_REFERENCE.md`](./CONTRACT_FUNCTION_REFERENCE.md) — the `Escrows` and `Streams` sections, function by function.
- [`docs/API_GUIDE.md`](./API_GUIDE.md) — the API conventions these endpoints follow.
