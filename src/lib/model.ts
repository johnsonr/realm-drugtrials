export interface DateStruct { date?: string; type?: string }
export interface Intervention { type?: string; name?: string; description?: string }
export interface Outcome { measure?: string; description?: string; timeFrame?: string }
export interface Reference { pmid?: string; type?: string; citation?: string }

export interface CtStudy {
  hasResults?: boolean;
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
    statusModule?: {
      overallStatus?: string;
      whyStopped?: string;
      startDateStruct?: DateStruct;
      primaryCompletionDateStruct?: DateStruct;
      completionDateStruct?: DateStruct;
      studyFirstPostDateStruct?: DateStruct;
      lastUpdatePostDateStruct?: DateStruct;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string };
      collaborators?: Array<{ name?: string; class?: string }>;
    };
    descriptionModule?: { briefSummary?: string; detailedDescription?: string };
    conditionsModule?: { conditions?: string[]; keywords?: string[] };
    designModule?: { studyType?: string; phases?: string[]; enrollmentInfo?: { count?: number; type?: string } };
    armsInterventionsModule?: { interventions?: Intervention[] };
    outcomesModule?: { primaryOutcomes?: Outcome[]; secondaryOutcomes?: Outcome[]; otherOutcomes?: Outcome[] };
    referencesModule?: { references?: Reference[] };
    eligibilityModule?: {
      sex?: string;
      minimumAge?: string;
      maximumAge?: string;
      stdAges?: string[];
      healthyVolunteers?: boolean;
      eligibilityCriteria?: string;
    };
    contactsLocationsModule?: {
      locations?: Array<{ facility?: string; city?: string; state?: string; zip?: string; country?: string; geoPoint?: { lat?: number; lon?: number } }>;
      overallOfficials?: Array<{ name?: string; affiliation?: string; role?: string }>;
    };
  };
  resultsSection?: unknown;
  derivedSection?: {
    miscInfoModule?: { versionHolder?: string };
    miscInfo?: { versionHolder?: string };
  };
}

export interface CtSearchResponse { studies?: CtStudy[]; nextPageToken?: string; totalCount?: number }
export interface CtVersionResponse { apiVersion?: string; dataTimestamp?: string }

export interface ClinicalTrialRecord {
  registryRecordId: string;
  nctId: string;
  title: string;
  officialTitle?: string;
  overallStatus?: string;
  studyType?: string;
  phases: string[];
  sponsor?: string;
  sponsorClass?: string;
  collaborators: string[];
  conditions: string[];
  keywords: string[];
  interventions: string[];
  interventionTypes: string[];
  countries: string[];
  facilities: string[];
  investigators: string[];
  investigatorAffiliations: string[];
  sex?: string;
  minimumAge?: string;
  maximumAge?: string;
  ageGroups: string[];
  openTo: string[];
  healthyVolunteers?: boolean;
  enrollment?: number;
  startDate?: string;
  primaryCompletionDate?: string;
  completionDate?: string;
  firstPosted?: string;
  lastUpdated?: string;
  hasResults: boolean;
  whyStopped?: string;
  registryUrl: string;
}

export interface TrialDetailRecord {
  detailId: string;
  nctId: string;
  briefSummary?: string;
  detailedDescription?: string;
  enrollment?: number;
  sourceUpdatedAt?: string;
  hasResults: boolean;
  rawOutcomeCount: number;
  rawReferenceCount: number;
  outcomes: TrialOutcomeRecord[];
  references: TrialReferenceRecord[];
}

export interface TrialOutcomeRecord extends Outcome {
  outcomeId: string;
  nctId: string;
  outcomeType: "PRIMARY" | "SECONDARY" | "OTHER";
  ordinal: number;
}

export interface TrialReferenceRecord extends Reference {
  referenceId: string;
  nctId: string;
  pmid: string;
}

export interface PubmedAuthor { name?: string }
export interface PubmedArticleId { idtype?: string; value?: string }
export interface PubmedSummary {
  uid?: string;
  title?: string;
  pubdate?: string;
  fulljournalname?: string;
  source?: string;
  authors?: PubmedAuthor[];
  articleids?: PubmedArticleId[];
}
export interface PubmedResponse { result?: { uids?: string[]; [uid: string]: PubmedSummary | string[] | undefined } }
export interface PublicationRecord {
  pmid: string;
  title?: string;
  publishedDate?: string;
  journal?: string;
  authorNames: string[];
  doi?: string;
  pubmedUrl: string;
}
