# API rate limits and operating budget

Rate limits are manageable for the interactive product if the join plan remains bounded. They
become a problem if an implementation performs one publication request per trial, refreshes on
every keystroke, or tries to crawl whole registries.

## Source constraints

### ClinicalTrials.gov

The [official API page](https://clinicaltrials.gov/data-api/api) documents API v2, a weekday data
refresh, pagination and up to 1,000 studies per page. It does not currently publish a simple
requests-per-second quota on that page. The Realm therefore uses a conservative shared
`clinicaltrials` budget of 2 requests/second, 100 records/page and at most five pages per disease
scope in v0.1. The cap is reported as partial coverage rather than hidden.
Landscape calls also use a response field mask; full protocol/results payloads are fetched only
for a selected NCT id.

### NCBI E-utilities

The [NCBI usage guidance](https://www.ncbi.nlm.nih.gov/books/NBK25497/) permits up to three requests
per second without an API key and ten per second with a key, asks applications to provide `tool`
and `email`, and encourages batching. v0.1 stays in the anonymous three-per-second tier and resolves
up to 200 PMIDs in one ESummary request.

### NIH RePORTER (planned)

The [NIH RePORTER API](https://api.reporter.nih.gov/) asks clients to limit requests to one per
second. A funding join must therefore batch project/search criteria, use a separate shared bucket,
and run only when the question requests funding evidence.

## Expected request shape

| User action | ClinicalTrials.gov | PubMed |
|---|---:|---:|
| Disease landscape, ≤100 matches | version + 1 search page | 0 |
| Disease landscape, 101–500 matches | version + 2–5 pages | 0 |
| Open one selected trial | 1 detail call | 0–1 batched reference call |
| Repeat within TTL | normally 0 source calls | normally 0 source calls |

The landscape intentionally does not resolve publications for every returned trial. That would be
an N+1 architecture. Publication resolution begins only after the user selects a trial or a
bounded analysis explicitly asks for it.

## Public deployment controls

- Cache identical disease searches for six hours and PubMed metadata for one day.
- Coalesce identical in-flight requests at the host/gateway layer.
- Debounce the browser and submit only on an explicit action.
- Apply per-IP/account request budgets at the public façade.
- Keep source buckets global so many users cannot collectively exceed courtesy limits.
- Retry `429`/transient `5xx` with bounded exponential backoff and jitter in the host HTTP layer.
- Honor `Retry-After`; do not spin inside a Realm handler.
- Expose stale cached data only if it is clearly labelled with source/retrieval time.
- Return `SOURCE_UNAVAILABLE` or partial coverage after exhaustion—never a false empty.

For a high-attention launch, ask ClinicalTrials.gov/NCBI about expected traffic, publish a status
page, and pre-warm only a handful of featured queries through normal bounded calls. Do not turn
pre-warming into a background registry mirror.
