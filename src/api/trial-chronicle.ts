import type { GenericGatewayContext } from "@embabel/runtime-types";
import { normalizeDetail, normalizePubmed, normalizeStudy } from "../lib/normalize";
import type {
  ClinicalTrialRecord,
  CtSearchResponse,
  CtStudy,
  CtVersionResponse,
  PublicationRecord,
  PubmedResponse,
  TrialDetailRecord,
} from "../lib/model";

interface TrialGateway {
  clinicalTrials: {
    getVersion(args: Record<string, never>): Promise<CtVersionResponse>;
    searchStudies(args: {
      "query.cond": string;
      pageSize: number;
      countTotal: boolean;
      fields: string;
      pageToken?: string;
    }): Promise<CtSearchResponse>;
    getStudy(args: { nctId: string }): Promise<CtStudy>;
  };
  pubmed: {
    summarizePubmed(args: { db: string; id: string; retmode: string; tool: string; email: string }): Promise<PubmedResponse>;
  };
}

const gatewayOf = (ctx: GenericGatewayContext): TrialGateway => ctx as unknown as TrialGateway;
const MAX_PAGES = 5;
const PAGE_SIZE = 100;
const LANDSCAPE_FIELDS = [
  "NCTId", "BriefTitle", "OfficialTitle", "OverallStatus", "WhyStopped",
  "StartDate", "PrimaryCompletionDate", "CompletionDate", "StudyFirstPostDate",
  "LastUpdatePostDate", "LeadSponsorName", "LeadSponsorClass", "CollaboratorName",
  "Condition", "Keyword", "StudyType", "Phase", "EnrollmentCount",
  "InterventionName", "InterventionType", "LocationCountry", "HasResults",
].join(",");

export interface TrialCoverageRecord {
  coverageId: string;
  scopeQuery: string;
  source: string;
  state: "COMPLETE" | "PARTIAL_PAGE_CAP";
  detail: string;
  sourceTotal?: number;
  recordsFetched: number;
  pagesFetched: number;
  dataTimestamp?: string;
  retrievedAt: string;
}

export interface TrialSearchRunRecord {
  runId: string;
  scopeQuery: string;
  source: string;
  dataTimestamp?: string;
  retrievedAt: string;
  sourceTotal?: number;
  recordsFetched: number;
  pagesFetched: number;
  capped: boolean;
  trials: ClinicalTrialRecord[];
  coverage: TrialCoverageRecord[];
}

/**
 * Search ClinicalTrials.gov for each disease query, paging without mirroring the
 * registry. A source error throws: callers receive an explicit producer failure,
 * never a misleading empty answer.
 */
export async function searchByDisease(
  ctx: GenericGatewayContext,
  args: { queries: string[] },
): Promise<TrialSearchRunRecord[]> {
  const api = gatewayOf(ctx).clinicalTrials;
  const version = await api.getVersion({});
  const retrievedAt = new Date().toISOString();
  const runs: TrialSearchRunRecord[] = [];

  for (const query of [...new Set(args.queries.map((q) => q.trim()).filter(Boolean))]) {
    const trials: ClinicalTrialRecord[] = [];
    let pageToken: string | undefined;
    let totalCount: number | undefined;
    let pages = 0;
    do {
      const response = await api.searchStudies({
        "query.cond": query,
        pageSize: PAGE_SIZE,
        countTotal: pages === 0,
        fields: LANDSCAPE_FIELDS,
        ...(pageToken ? { pageToken } : {}),
      });
      if (pages === 0) totalCount = response.totalCount;
      trials.push(...(response.studies ?? []).flatMap((s) => {
        const normalized = normalizeStudy(s);
        return normalized ? [normalized] : [];
      }));
      pageToken = response.nextPageToken;
      pages += 1;
    } while (pageToken && pages < MAX_PAGES);

    const capped = !!pageToken;
    const runId = `clinicaltrials.gov:${encodeURIComponent(query)}:${version.dataTimestamp ?? retrievedAt}`;
    const coverage: TrialCoverageRecord = {
      coverageId: `${runId}:coverage`,
      scopeQuery: query,
      source: "ClinicalTrials.gov",
      state: capped ? "PARTIAL_PAGE_CAP" : "COMPLETE",
      detail: capped
        ? `Stopped after ${pages} pages (${trials.length} records); more source pages existed.`
        : `Fetched every page returned for this query (${trials.length} records).`,
      sourceTotal: totalCount,
      recordsFetched: trials.length,
      pagesFetched: pages,
      dataTimestamp: version.dataTimestamp,
      retrievedAt,
    };
    runs.push({
      runId,
      scopeQuery: query,
      source: "ClinicalTrials.gov",
      dataTimestamp: version.dataTimestamp,
      retrievedAt,
      sourceTotal: totalCount,
      recordsFetched: trials.length,
      pagesFetched: pages,
      capped,
      trials,
      coverage: [coverage],
    });
  }
  return runs;
}

/** Fetch current protocol detail for selected NCT ids. Selection keeps this from becoming N+1. */
export async function detailsByNctIds(
  ctx: GenericGatewayContext,
  args: { nctIds: string[] },
): Promise<TrialDetailRecord[]> {
  const api = gatewayOf(ctx).clinicalTrials;
  const ids = [...new Set(args.nctIds.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  const studies = await Promise.all(ids.map((nctId) => api.getStudy({ nctId })));
  return studies.flatMap((s) => {
    const detail = normalizeDetail(s);
    return detail ? [detail] : [];
  });
}

/** Resolve many registry PMIDs through one NCBI ESummary request (max 200 per call). */
export async function publicationsByPmid(
  ctx: GenericGatewayContext,
  args: { pmids: string[] },
): Promise<PublicationRecord[]> {
  const ids = [...new Set(args.pmids.map((id) => id.trim()).filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return [];
  const response = await gatewayOf(ctx).pubmed.summarizePubmed({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
    tool: "trialchronicle",
    email: "assistant@embabel.com",
  });
  return normalizePubmed(response);
}
