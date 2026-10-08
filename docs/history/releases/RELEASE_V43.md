# Release V43

## What changed
V43 closes a production-durability gap discovered during review of V42: asynchronous PostgreSQL writes were queued but request handlers did not wait for completion before returning success.

### V43 changes
- Mutating request paths await `save()`.
- `save()` propagates persistence errors and tracks the last failure.
- `/api/health` reports persistence failure as unhealthy.
- Graceful shutdown closes storage resources when supported.
- Added V43 durability regression tests.

## Verification
`npm test` passes with zero failures.

## Production boundary
This release still does not claim a live deployment. TLS certificates, DNS, a real PostgreSQL service, reverse proxy and external monitoring must be configured on the target infrastructure.
