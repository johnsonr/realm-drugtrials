# Evidence and claim model

## What v0.1 can establish

The current Realm can establish that a ClinicalTrials.gov response, at a reported source data
timestamp, contains a study record with particular structured fields. It can also establish that
a PMID in that registry record resolves to particular PubMed metadata at retrieval time.

It can deterministically observe:

- registry conduct status (`RECRUITING`, `COMPLETED`, `TERMINATED`, and so on);
- the source-supplied `whyStopped` text, when present;
- whether the current registry response includes a results section;
- registered conditions, interventions, phase, sponsor string and countries;
- protocol outcome declarations; and
- PMID-bearing references declared in the trial record.

It cannot yet establish scientific success/failure, publication completeness, legal compliance,
sponsor corporate identity, regulatory approval, undisclosed conflicts, or causal responsibility.

## The language boundary

| Observation | Safe rendering | Unsafe shortcut |
|---|---|---|
| `overallStatus=COMPLETED` | “Registry status is completed” | “The treatment succeeded” |
| no `resultsSection` | “No results section in the current registry record” | “Results were never published” |
| `TERMINATED` + `whyStopped` | Quote/source the registered reason | Infer fraud, harm or futility |
| a PubMed record resolves | “A registered reference resolves in PubMed” | “This proves the trial worked” |
| recruiting locations include Australia | “The record lists an Australian location” | “All Australian trials are covered” |

“Failed” is meaningful only with a typed axis and evidence: primary endpoint not met, safety stop,
recruitment failure, business discontinuation, or source retrieval failure are different facts.

## Coverage is evidence

Every disease search creates a `TrialCoverage` record containing:

- the exact source expression;
- source name and data timestamp;
- retrieval time;
- source-reported total when present;
- pages and records fetched;
- complete versus deliberate-cap state; and
- a human-readable boundary.

A request failure is not represented as coverage with zero records; it fails the producer. This is
essential because “no trials exist” and “the registry did not answer” are opposite conclusions.

## Provenance now and next

v0.1 carries record links and an execution-level source ledger. The next evidence increment should
add field locators/checksums and compact answer snapshots so a public claim can be reproduced after
the live source changes. That snapshot should retain source ids, selected fields, rule version and
hash—not bulk-copy the source database.

Future DICE propositions should separate:

1. source observation;
2. deterministic derivation;
3. bounded semantic comparison; and
4. human review.

Conflicting and superseded propositions should coexist with time and provenance. A later results
posting supersedes the current-presence assessment; it must not erase that the earlier record had
no results section when an answer was published.

