# API error codes

Every error response uses the same envelope, and the machine-readable part of it is `code`:

```json
{ "success": false, "error": { "code": "INVALID_ADDRESS", "message": "…" } }
```

The catalog in [`src/lib/error-codes.ts`](../src/lib/error-codes.ts) holds 219 codes across 16 statuses. Match on `code` rather than on the message text: the message is for humans and may change, the code is the contract.

## Retryability

Retryable statuses: 408, 425, 429, 500, 502, 503, 504. Everything else in the catalog is terminal — retrying it will return the same answer, so surface the error instead.

On `429`, honour the `Retry-After` response header: it carries the number of seconds until the window resets. A `500` is retryable in the sense that the failure is not the request's fault, but only replay a request that is safe to repeat.

## The user-facing message

Some codes also have a catalogued, user-facing message in [`src/lib/error-messages.ts`](../src/lib/error-messages.ts); where one exists the table repeats it below. The rest are returned with the message the route composes, `—` marks those.

## The catalog

Grouped by the HTTP status the codes in each section are returned with. The `Meaning` column is derived from the code name; the authoritative contract is the code value and its status.

### 400 — Client errors (input validation, malformed requests)

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `BAD_REQUEST` | Bad request | — |
| `VALIDATION_ERROR` | Validation error | — |
| `MISSING_REQUIRED_FIELD` | Missing required field | — |
| `INVALID_INPUT` | Invalid input | — |
| `INVALID_PAGE` | Invalid page | — |
| `INVALID_LIMIT` | Invalid limit | — |
| `INVALID_SORT` | Invalid sort | — |
| `INVALID_FILTER` | Invalid filter | — |
| `INVALID_CURSOR` | Invalid cursor | — |
| `INVALID_FORMAT` | Invalid format | — |
| `INVALID_AMOUNT` | Invalid amount | Please enter a valid positive amount. |
| `AMOUNT_TOO_SMALL` | Amount too small | — |
| `AMOUNT_TOO_LARGE` | Amount too large | — |
| `AMOUNT_BELOW_MINIMUM` | Amount below minimum | — |
| `AMOUNT_EXCEEDS_MAXIMUM` | Amount exceeds maximum | — |
| `INVALID_ADDRESS` | Invalid address | Please enter a valid Stellar address (starts with G, 56 characters). |
| `ADDRESS_MALFORMED` | Address malformed | — |
| `MISSING_DESTINATION` | Missing destination | — |
| `SELF_PAYMENT` | Self payment | — |
| `DESTINATION_INVALID` | Destination invalid | — |
| `INVALID_MEMO` | Invalid memo | — |
| `MEMO_REQUIRED` | Memo required | — |
| `MEMO_TOO_LONG` | Memo too long | Memo must be 28 characters or fewer. |
| `MEMO_INVALID_FORMAT` | Memo invalid format | — |
| `INVALID_ASSET` | Invalid asset | — |
| `ASSET_NOT_SUPPORTED` | Asset not supported | — |
| `INVALID_TRUSTLINE` | Invalid trustline | — |
| `CSV_IMPORT_ERROR` | Csv import error | — |
| `CSV_FORMAT_ERROR` | Csv format error | — |
| `CSV_TOO_LARGE` | Csv too large | — |
| `CSV_EMPTY` | Csv empty | — |
| `CSV_MALFORMED_ROW` | Csv malformed row | — |
| `EXPORT_FORMAT_INVALID` | Export format invalid | — |
| `EXPORT_TOO_LARGE` | Export too large | — |
| `DATE_RANGE_INVALID` | Date range invalid | — |
| `DATE_RANGE_TOO_LARGE` | Date range too large | — |
| `INVALID_SIGNATURE` | Invalid signature | — |
| `INVALID_TIMESTAMP` | Invalid timestamp | — |
| `INVALID_CHALLENGE` | Invalid challenge | — |
| `CHALLENGE_EXPIRED` | Challenge expired | — |

### 401 — Authentication (credentials, tokens, sessions)

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `UNAUTHORIZED` | Unauthorized | — |
| `INVALID_API_KEY` | Invalid api key | — |
| `API_KEY_MISSING` | Api key missing | — |
| `API_KEY_DISABLED` | Api key disabled | — |
| `EXPIRED_API_KEY` | Expired api key | — |
| `TOKEN_EXPIRED` | Token expired | — |
| `TOKEN_REVOKED` | Token revoked | — |
| `TOKEN_MISSING` | Token missing | — |
| `TOKEN_INVALID` | Token invalid | — |
| `SESSION_EXPIRED` | Session expired | — |
| `SESSION_INVALID` | Session invalid | — |
| `INVALID_CREDENTIALS` | Invalid credentials | — |

### 403 — Authorization (permissions, roles, access control)

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `FORBIDDEN` | Forbidden | — |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | — |
| `INSUFFICIENT_SCOPE` | Insufficient scope | — |
| `ROLE_REQUIRED` | Role required | — |
| `NOT_OWNER` | Not owner | — |
| `NOT_SIGNER` | Not signer | — |
| `NOT_MEMBER` | Not member | — |
| `NOT_APPROVER` | Not approver | — |
| `NOT_ADMIN` | Not admin | — |
| `ACCOUNT_DISABLED` | Account disabled | — |
| `ACCOUNT_SUSPENDED` | Account suspended | — |
| `RESOURCE_LOCKED` | Resource locked | — |
| `WALLET_LOCKED` | Wallet locked | — |
| `REGION_RESTRICTED` | Region restricted | — |

### 404 — Not found (resources, entities, endpoints)

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `NOT_FOUND` | Not found | The requested resource was not found. |
| `PAYMENT_NOT_FOUND` | Payment not found | — |
| `ESCROW_NOT_FOUND` | Escrow not found | — |
| `STREAM_NOT_FOUND` | Stream not found | — |
| `BATCH_NOT_FOUND` | Batch not found | — |
| `WEBHOOK_NOT_FOUND` | Webhook not found | — |
| `USER_NOT_FOUND` | User not found | — |
| `ACCOUNT_NOT_FOUND` | Account not found | — |
| `WALLET_NOT_FOUND` | Wallet not found | — |
| `SIGNER_NOT_FOUND` | Signer not found | — |
| `ASSET_NOT_FOUND` | Asset not found | — |
| `API_KEY_NOT_FOUND` | Api key not found | — |
| `KEY_NOT_FOUND` | Key not found | — |
| `TOKEN_NOT_FOUND` | Token not found | — |
| `CONTRACT_NOT_FOUND` | Contract not found | — |
| `FUNCTION_NOT_FOUND` | Function not found | — |
| `FILE_NOT_FOUND` | File not found | — |
| `EXPORT_NOT_FOUND` | Export not found | — |
| `NOTIFICATION_NOT_FOUND` | Notification not found | — |
| `ROUTE_NOT_FOUND` | Route not found | — |

### 405 — Method Not Allowed

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `METHOD_NOT_ALLOWED` | Method not allowed | — |

### 406 — Not Acceptable

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `NOT_ACCEPTABLE` | Not acceptable | — |

### 408 — Request Timeout

Retryable: yes

| Code | Meaning | User-facing message |
|---|---|---|
| `REQUEST_TIMEOUT` | Request timeout | — |
| `TRANSACTION_TIMEOUT` | Transaction timeout | — |
| `CONTRACT_TIMEOUT` | Contract timeout | — |
| `RPC_TIMEOUT` | Rpc timeout | — |

### 409 — Conflict (state conflicts, duplicate operations)

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `CONFLICT` | Conflict | — |
| `UNIQUE_CONSTRAINT` | Unique constraint | — |
| `DUPLICATE_REQUEST` | Duplicate request | — |
| `STATE_CONFLICT` | State conflict | — |
| `VERSION_CONFLICT` | Version conflict | — |
| `SEQUENCE_NUMBER_MISMATCH` | Sequence number mismatch | — |
| `OPERATION_IN_PROGRESS` | Operation in progress | — |
| `RESOURCE_IN_USE` | Resource in use | — |
| `WALLET_ALREADY_CONNECTED` | Wallet already connected | — |
| `STREAM_ALREADY_ACTIVE` | Stream already active | — |
| `ESCROW_ALREADY_FUNDED` | Escrow already funded | — |
| `ESCROW_ALREADY_COMPLETED` | Escrow already completed | — |
| `USER_EXISTS` | User exists | — |
| `EMAIL_EXISTS` | Email exists | — |
| `WALLET_EXISTS` | Wallet exists | — |
| `SIGNER_EXISTS` | Signer exists | — |
| `WEBHOOK_EXISTS` | Webhook exists | — |
| `BATCH_CONFLICT` | Batch conflict | — |

### 410 — Gone

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `RESOURCE_DELETED` | Resource deleted | — |
| `CONTRACT_DEPRECATED` | Contract deprecated | — |

### 413 — Payload Too Large

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `PAYLOAD_TOO_LARGE` | Payload too large | — |
| `BATCH_TOO_LARGE` | Batch too large | A batch can contain at most 100 recipients. |
| `FILE_TOO_LARGE` | File too large | — |
| `REQUEST_BODY_TOO_LARGE` | Request body too large | — |

### 415 — Unsupported Media Type

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `UNSUPPORTED_MEDIA_TYPE` | Unsupported media type | — |
| `UNSUPPORTED_ENCODING` | Unsupported encoding | — |

### 422 — Unprocessable Entity

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `UNPROCESSABLE_ENTITY` | Unprocessable entity | — |
| `BUSINESS_RULE_VIOLATION` | Business rule violation | — |

### 429 — Rate Limiting (tiers, backoff)

Retryable: yes

| Code | Meaning | User-facing message |
|---|---|---|
| `RATE_LIMITED` | Rate limited | Too many requests. Please wait a moment and try again. |
| `RATE_LIMIT_IP` | Rate limit ip | — |
| `RATE_LIMIT_USER` | Rate limit user | — |
| `RATE_LIMIT_WALLET` | Rate limit wallet | — |
| `RATE_LIMIT_API_KEY` | Rate limit api key | — |
| `RATE_LIMIT_GLOBAL` | Rate limit global | — |
| `RATE_LIMIT_BACKOFF` | Rate limit backoff | — |

### 451 — Unavailable For Legal Reasons

Retryable: no

| Code | Meaning | User-facing message |
|---|---|---|
| `LEGALLY_RESTRICTED` | Legally restricted | — |

### 500 — Server errors (infrastructure, dependencies)

Retryable: yes

| Code | Meaning | User-facing message |
|---|---|---|
| `INTERNAL_ERROR` | Internal error | — |
| `DATABASE_ERROR` | Database error | — |
| `DATABASE_QUERY_FAILED` | Database query failed | — |
| `DATABASE_CONNECTION_FAILED` | Database connection failed | — |
| `DATABASE_TRANSACTION_FAILED` | Database transaction failed | — |
| `DATABASE_DEADLOCK` | Database deadlock | — |
| `CONTRACT_ERROR` | Contract error | Smart contract execution failed. The contract may not be deployed or initialized. |
| `CONTRACT_CALL_FAILED` | Contract call failed | — |
| `CONTRACT_DEPLOY_FAILED` | Contract deploy failed | — |
| `CONTRACT_COMPILE_FAILED` | Contract compile failed | — |
| `CONTRACT_VERIFY_FAILED` | Contract verify failed | — |
| `CONTRACT_UNAVAILABLE` | Contract unavailable | — |
| `RPC_ERROR` | Rpc error | — |
| `RPC_NODE_ERROR` | Rpc node error | — |
| `NETWORK_ERROR` | Network error | Network error — unable to reach the Stellar network. Please check your connection and try again. |
| `NETWORK_TIMEOUT` | Network timeout | — |
| `STELLAR_ERROR` | Stellar error | — |
| `HORIZON_ERROR` | Horizon error | — |
| `SOROBAN_ERROR` | Soroban error | — |
| `EMAIL_SEND_FAILED` | Email send failed | — |
| `NOTIFICATION_FAILED` | Notification failed | — |
| `WEBHOOK_DELIVERY_FAILED` | Webhook delivery failed | — |
| `WEBHOOK_SIGNATURE_INVALID` | Webhook signature invalid | — |
| `FILE_UPLOAD_FAILED` | File upload failed | — |
| `FILE_PROCESSING_FAILED` | File processing failed | — |
| `EXPORT_FAILED` | Export failed | — |
| `IMPORT_FAILED` | Import failed | — |
| `SEARCH_INDEX_ERROR` | Search index error | — |
| `SEARCH_FAILED` | Search failed | — |
| `CACHE_ERROR` | Cache error | — |
| `CACHE_MISS` | Cache miss | — |
| `CONFIG_ERROR` | Config error | — |
| `FEATURE_NOT_ENABLED` | Feature not enabled | — |
| `MAINTENANCE_MODE` | Maintenance mode | — |
| `UNKNOWN_ERROR` | Unknown error | — |

### 503 — Service Unavailable

Retryable: yes

| Code | Meaning | User-facing message |
|---|---|---|
| `SERVICE_UNAVAILABLE` | Service unavailable | — |
| `OVERLOADED` | Overloaded | — |
| `DEPENDENCY_UNAVAILABLE` | Dependency unavailable | — |
| `STELLAR_UNAVAILABLE` | Stellar unavailable | — |
| `HORIZON_UNAVAILABLE` | Horizon unavailable | — |
| `SOROBAN_UNAVAILABLE` | Soroban unavailable | — |
| `RPC_UNAVAILABLE` | Rpc unavailable | — |
| `DATABASE_UNAVAILABLE` | Database unavailable | — |
| `CACHE_UNAVAILABLE` | Cache unavailable | — |
| `EMAIL_UNAVAILABLE` | Email unavailable | — |
| `INSUFFICIENT_FUNDS` | Insufficient funds | — |
| `INSUFFICIENT_RESERVE` | Insufficient reserve | — |
| `PAYMENT_FAILED` | Payment failed | — |
| `PAYMENT_CANCELLED` | Payment cancelled | — |
| `PAYMENT_EXPIRED` | Payment expired | — |
| `PAYMENT_PENDING` | Payment pending | — |
| `PAYMENT_ALREADY_PROCESSED` | Payment already processed | — |
| `TRANSACTION_FAILED` | Transaction failed | — |
| `TRANSACTION_EXPIRED` | Transaction expired | — |
| `TRANSACTION_REJECTED` | Transaction rejected | — |
| `STREAM_PAUSED` | Stream paused | — |
| `STREAM_RESUMED` | Stream resumed | — |
| `STREAM_CANCELLED` | Stream cancelled | — |
| `STREAM_COMPLETED` | Stream completed | — |
| `BATCH_PROCESSING` | Batch processing | — |
| `BATCH_PARTIAL_SUCCESS` | Batch partial success | — |
| `BATCH_CANCELLED` | Batch cancelled | — |
| `BATCH_FAILED` | Batch failed | — |
| `ESCROW_EXPIRED` | Escrow expired | — |
| `ESCROW_DISPUTED` | Escrow disputed | — |
| `ESCROW_RESOLVED` | Escrow resolved | — |
| `THRESHOLD_NOT_MET` | Threshold not met | — |
| `ALREADY_APPROVED` | Already approved | — |
| `ALREADY_EXECUTED` | Already executed | — |
| `INVALID_THRESHOLD` | Invalid threshold | — |
| `SIGNER_LIMIT_EXCEEDED` | Signer limit exceeded | — |
| `SIGNER_WEIGHT_EXCEEDED` | Signer weight exceeded | — |
| `SIGNER_WEIGHT_INVALID` | Signer weight invalid | — |
| `MULTISIG_NOT_CONFIGURED` | Multisig not configured | — |
| `PROPOSAL_NOT_FOUND` | Proposal not found | — |
| `VOTING_ENDED` | Voting ended | — |
| `PROPOSAL_ALREADY_EXECUTED` | Proposal already executed | — |
| `PROPOSAL_EXPIRED` | Proposal expired | — |
| `PROPOSAL_CANCELLED` | Proposal cancelled | — |
| `PROPOSAL_NOT_ACTIVE` | Proposal not active | — |
| `ALREADY_VOTED` | Already voted | — |
| `VOTING_NOT_STARTED` | Voting not started | — |
| `QUORUM_NOT_MET` | Quorum not met | — |
| `INSUFFICIENT_VOTING_POWER` | Insufficient voting power | — |
| `WALLET_NOT_INSTALLED` | Wallet not installed | Freighter wallet is not installed. Please install the Freighter browser extension to continue. |
| `WALLET_CONNECTION_FAILED` | Wallet connection failed | — |
| `WALLET_DISCONNECTED` | Wallet disconnected | Wallet disconnected. Please reconnect your Freighter wallet to continue. |
| `WALLET_NETWORK_MISMATCH` | Wallet network mismatch | — |
| `WALLET_SIGN_FAILED` | Wallet sign failed | — |
| `WALLET_SIGN_REJECTED` | Wallet sign rejected | — |
| `WALLET_NOT_SUPPORTED` | Wallet not supported | — |

## Soroban contract errors

Reverts from the payment contract are not part of the catalog above. The contract's own numeric codes are decoded by [`src/lib/contract-errors.ts`](../src/lib/contract-errors.ts) (`decodeContractError`, `getContractErrorCatalog`) and surface through the API as `CONTRACT_ERROR`, keeping the transport-level status (`500` or `503`) unchanged.

