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

describe("eligibility and the entities a trial names", () => {
  // Names are synthetic: the registry is public, but a test fixture is not the place for real people.
  const withEntities: CtStudy = {
    protocolSection: {
      identificationModule: { nctId: "NCT99999999", briefTitle: "Eligibility trial" },
      eligibilityModule: {
        sex: "FEMALE",
        minimumAge: "18 Years",
        maximumAge: "70 Years",
        stdAges: ["ADULT", "OLDER_ADULT"],
        healthyVolunteers: true,
      },
      contactsLocationsModule: {
        // The registry repeats a facility once per site record.
        locations: [
          { facility: "Example General Hospital", country: "Australia" },
          { facility: "Example General Hospital", country: "Australia" },
          { facility: "Second Example Clinic", country: "New Zealand" },
        ],
        overallOfficials: [
          { name: "A. Researcher", affiliation: "Example University" },
          { name: "B. Investigator", affiliation: "Example University" },
        ],
      },
    },
  };

  it("carries the registry's own cohort labels verbatim", () => {
    const t = normalizeStudy(withEntities)!;
    // Not derived from the age bounds: a trial can declare a cohort its bounds don't imply, and the
    // registry's label is what a reader of the record sees.
    expect(t.ageGroups).toEqual(["ADULT", "OLDER_ADULT"]);
    expect(t.sex).toBe("FEMALE");
    expect(t.minimumAge).toBe("18 Years");
    expect(t.maximumAge).toBe("70 Years");
    expect(t.healthyVolunteers).toBe(true);
  });

  it("deduplicates facilities, so one institution is one node however many sites it registered", () => {
    const t = normalizeStudy(withEntities)!;
    expect(t.facilities).toEqual(["Example General Hospital", "Second Example Clinic"]);
  });

  it("names investigators and their affiliations", () => {
    const t = normalizeStudy(withEntities)!;
    expect(t.investigators).toEqual(["A. Researcher", "B. Investigator"]);
    // Two officials at one institution is one affiliation — the same convergence as facilities.
    expect(t.investigatorAffiliations).toEqual(["Example University"]);
  });

  it("leaves eligibility absent rather than guessing when the registry omits it", () => {
    const t = normalizeStudy({ protocolSection: { identificationModule: { nctId: "NCT1", briefTitle: "t" } } })!;
    expect(t.sex).toBeUndefined();
    expect(t.healthyVolunteers).toBeUndefined();
    // Absent lists are empty, never a list containing nothing meaningful.
    expect(t.ageGroups).toEqual([]);
    expect(t.facilities).toEqual([]);
    expect(t.investigators).toEqual([]);
  });
});
