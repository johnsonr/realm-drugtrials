import type {
  ClinicalTrialRecord,
  CtStudy,
  PublicationRecord,
  PubmedResponse,
  TrialDetailRecord,
  TrialOutcomeRecord,
  TrialReferenceRecord,
} from "./model";

const unique = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))];

export function normalizeStudy(study: CtStudy): ClinicalTrialRecord | undefined {
  const p = study.protocolSection;
  const id = p?.identificationModule?.nctId;
  if (!id) return undefined;
  const status = p?.statusModule;
  const design = p?.designModule;
  const sponsor = p?.sponsorCollaboratorsModule;
  const interventions = p?.armsInterventionsModule?.interventions ?? [];
  const countries = unique((p?.contactsLocationsModule?.locations ?? []).map((l) => l.country));
  return {
    registryRecordId: id,
    nctId: id,
    title: p?.identificationModule?.briefTitle || p?.identificationModule?.officialTitle || id,
    officialTitle: p?.identificationModule?.officialTitle,
    overallStatus: status?.overallStatus,
    studyType: design?.studyType,
    phases: design?.phases ?? [],
    sponsor: sponsor?.leadSponsor?.name,
    sponsorClass: sponsor?.leadSponsor?.class,
    collaborators: unique((sponsor?.collaborators ?? []).map((c) => c.name)),
    conditions: p?.conditionsModule?.conditions ?? [],
    keywords: p?.conditionsModule?.keywords ?? [],
    interventions: unique(interventions.map((i) => i.name)),
    interventionTypes: unique(interventions.map((i) => i.type)),
    countries,
    enrollment: design?.enrollmentInfo?.count,
    startDate: status?.startDateStruct?.date,
    primaryCompletionDate: status?.primaryCompletionDateStruct?.date,
    completionDate: status?.completionDateStruct?.date,
    firstPosted: status?.studyFirstPostDateStruct?.date,
    lastUpdated: status?.lastUpdatePostDateStruct?.date,
    hasResults: study.hasResults ?? study.resultsSection != null,
    whyStopped: status?.whyStopped,
    registryUrl: `https://clinicaltrials.gov/study/${encodeURIComponent(id)}`,
  };
}

function outcomesFor(study: CtStudy, nctId: string): TrialOutcomeRecord[] {
  const o = study.protocolSection?.outcomesModule;
  const groups: Array<[TrialOutcomeRecord["outcomeType"], typeof o extends undefined ? never[] : NonNullable<typeof o>["primaryOutcomes"]]> = [
    ["PRIMARY", o?.primaryOutcomes],
    ["SECONDARY", o?.secondaryOutcomes],
    ["OTHER", o?.otherOutcomes],
  ];
  return groups.flatMap(([outcomeType, items]) =>
    (items ?? []).map((item, i) => ({
      outcomeId: `${nctId}:${outcomeType}:${i + 1}`,
      nctId,
      outcomeType,
      ordinal: i + 1,
      measure: item.measure,
      description: item.description,
      timeFrame: item.timeFrame,
    })),
  );
}

function referencesFor(study: CtStudy, nctId: string): TrialReferenceRecord[] {
  return (study.protocolSection?.referencesModule?.references ?? [])
    .filter((r) => !!r.pmid)
    .map((r, i) => ({
      referenceId: `${nctId}:${r.pmid}:${i + 1}`,
      nctId,
      pmid: r.pmid!,
      type: r.type,
      citation: r.citation,
    }));
}

export function normalizeDetail(study: CtStudy): TrialDetailRecord | undefined {
  const p = study.protocolSection;
  const id = p?.identificationModule?.nctId;
  if (!id) return undefined;
  const outcomes = outcomesFor(study, id);
  const references = referencesFor(study, id);
  return {
    detailId: `clinicaltrials.gov:${id}`,
    nctId: id,
    briefSummary: p?.descriptionModule?.briefSummary,
    detailedDescription: p?.descriptionModule?.detailedDescription,
    enrollment: p?.designModule?.enrollmentInfo?.count,
    sourceUpdatedAt: p?.statusModule?.lastUpdatePostDateStruct?.date,
    hasResults: study.hasResults ?? study.resultsSection != null,
    rawOutcomeCount: outcomes.length,
    rawReferenceCount: references.length,
    outcomes,
    references,
  };
}

export function normalizePubmed(response: PubmedResponse): PublicationRecord[] {
  const result = response.result;
  if (!result) return [];
  return (result.uids ?? []).flatMap((pmid) => {
    const value = result[pmid];
    if (!value || Array.isArray(value)) return [];
    const doi = value.articleids?.find((id) => id.idtype === "doi")?.value;
    return [{
      pmid,
      title: value.title,
      publishedDate: value.pubdate,
      journal: value.fulljournalname || value.source,
      authorNames: unique((value.authors ?? []).map((a) => a.name)),
      doi,
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`,
    }];
  });
}
