---
name: investigate-clinical-research
description: Investigate what clinical research exists for a disease, what happened to trials, and what problems are visible in current public evidence.
---

# Investigate clinical research

Use Trial Chronicle for disease-first questions such as:

- What trials exist for Long COVID, and which are active?
- Which completed studies have results in the current registry record?
- What vaccine trials exist for HSV, which stopped, and which remain active?
- Which trials are recruiting in Australia?

## Workflow

1. Establish the disease scope. Preserve the exact source query and any exclusions. Long COVID
   should use the curated synonyms; HSV vaccine searches must exclude zoster unless requested.
2. Prefer the `trial-landscape` Lens for a public, coverage-aware answer. Use the composable
   `DiseaseTrials`/`DiseaseTrialRuns` views for further graph traversal or direct tabular views for
   narrowly structured reports.
3. Use `trial-detail` only for selected NCT ids. It fetches protocol outcomes and resolves
   PMID-bearing registered references through PubMed in a batch.
4. Distinguish trial conduct status, registry-results presence, scientific outcome, safety and
   commercial program fate. The initial Realm establishes only the first two axes.
5. State coverage and source time. If a producer fails or rate-limits, report source unavailability
   or partial coverage. Never turn it into zero trials.
6. Link consequential statements to ClinicalTrials.gov or PubMed. Do not provide medical advice.

## Language rules

- Say “the current registry record has no results section,” not “the trial was never published.”
- Say “terminated/withdrawn/suspended according to the registry,” and quote `whyStopped` when present.
- Recruitment is not evidence of efficacy. Completion is not success. A publication link is not a
  quality assessment. Sponsor identity is not proof of legal corporate lineage.
- “Failed” requires a typed axis and evidence. Do not use it as an unqualified trial state.

