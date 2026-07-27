import { describe, expect, it } from "vitest";
import { classifyTrial } from "../src/lib/classify";
import { normalizeDetail, normalizePubmed, normalizeStudy } from "../src/lib/normalize";
import type { CtStudy } from "../src/lib/model";

const study: CtStudy = {
  hasResults: false,
  protocolSection: {
    identificationModule: { nctId: "NCT12345678", briefTitle: "A useful trial" },
    statusModule: {
      overallStatus: "COMPLETED",
      completionDateStruct: { date: "2025-01-01" },
      lastUpdatePostDateStruct: { date: "2026-07-01" },
    },
    sponsorCollaboratorsModule: {
      leadSponsor: { name: "Example University", class: "OTHER" },
    },
    conditionsModule: { conditions: ["Long COVID"] },
    designModule: { studyType: "INTERVENTIONAL", phases: ["PHASE2"], enrollmentInfo: { count: 50 } },
    armsInterventionsModule: { interventions: [{ type: "DRUG", name: "Examplevir" }] },
    outcomesModule: { primaryOutcomes: [{ measure: "Fatigue", timeFrame: "12 weeks" }] },
    referencesModule: { references: [{ pmid: "12345", type: "RESULT", citation: "Citation" }] },
    contactsLocationsModule: { locations: [{ country: "Australia" }, { country: "Australia" }] },
    descriptionModule: { briefSummary: "A summary" },
  },
};

describe("ClinicalTrials.gov normalization", () => {
  it("normalizes a study without inventing results", () => {
    const normalized = normalizeStudy(study)!;
    expect(normalized.nctId).toBe("NCT12345678");
    expect(normalized.phases).toEqual(["PHASE2"]);
    expect(normalized.countries).toEqual(["Australia"]);
    expect(normalized.hasResults).toBe(false);
    expect(classifyTrial(normalized)[0]?.kind).toBe("REGISTRY_RESULTS_NOT_PRESENT");
  });

  it("brings outcomes and PMID references into selected-trial detail", () => {
    const detail = normalizeDetail(study)!;
    expect(detail.outcomes).toMatchObject([{ outcomeType: "PRIMARY", measure: "Fatigue" }]);
    expect(detail.references).toMatchObject([{ pmid: "12345", type: "RESULT" }]);
  });

  it("normalizes a batched PubMed response", () => {
    const records = normalizePubmed({ result: {
      uids: ["12345"],
      "12345": { uid: "12345", title: "Result paper", authors: [{ name: "Smith A" }], articleids: [{ idtype: "doi", value: "10.1/example" }] },
    } });
    expect(records).toEqual([expect.objectContaining({ pmid: "12345", title: "Result paper", doi: "10.1/example" })]);
  });
});
