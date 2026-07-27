import { describe, expect, it, vi } from "vitest";
import { mockGateway } from "@embabel/runtime-types";
import type { GenericGatewayContext } from "@embabel/runtime-types";
import { detailsByNctIds, publicationsByPmid, searchByDisease } from "../src/api/trial-chronicle";

const ctStudy = (id: string) => ({ protocolSection: {
  identificationModule: { nctId: id, briefTitle: `Trial ${id}` },
  statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2026-07-20" } },
  designModule: { studyType: "INTERVENTIONAL", phases: ["PHASE2"] },
} });

describe("live adapter orchestration", () => {
  it("pages a disease query and returns explicit complete coverage", async () => {
    const searchStudies = vi.fn()
      .mockResolvedValueOnce({ studies: [ctStudy("NCT00000001")], totalCount: 2, nextPageToken: "next" })
      .mockResolvedValueOnce({ studies: [ctStudy("NCT00000002")] });
    const ctx = mockGateway<GenericGatewayContext>({ clinicalTrials: {
      getVersion: vi.fn().mockResolvedValue({ apiVersion: "2.0.5", dataTimestamp: "2026-07-24T09:00:05" }),
      searchStudies,
    } });
    const [run] = await searchByDisease(ctx, { queries: ["Long COVID"] });
    expect(run.trials).toHaveLength(2);
    expect(run.coverage[0]).toMatchObject({ state: "COMPLETE", recordsFetched: 2, pagesFetched: 2 });
    expect(searchStudies).toHaveBeenNthCalledWith(2, expect.objectContaining({
      pageToken: "next", countTotal: false, fields: expect.stringContaining("HasResults"),
    }));
  });

  it("honours a caller-supplied sweep depth instead of a hardcoded cap", async () => {
    // Depth is CONFIG (the producer declares it), not a constant: 500 records was an
    // arbitrary ceiling nobody could reach. A capped sweep must still say so.
    const searchStudies = vi.fn()
      .mockResolvedValueOnce({ studies: [ctStudy("NCT00000001")], totalCount: 99, nextPageToken: "p2" })
      .mockResolvedValueOnce({ studies: [ctStudy("NCT00000002")], nextPageToken: "p3" });
    const ctx = mockGateway<GenericGatewayContext>({ clinicalTrials: {
      getVersion: vi.fn().mockResolvedValue({ apiVersion: "2.0.5", dataTimestamp: "2026-07-24T09:00:05" }),
      searchStudies,
    } });

    const [run] = await searchByDisease(ctx, { queries: ["Long COVID"], pageSize: 250, maxPages: 2 });

    expect(searchStudies).toHaveBeenCalledTimes(2);
    expect(searchStudies).toHaveBeenNthCalledWith(1, expect.objectContaining({ pageSize: 250 }));
    expect(run.coverage[0]).toMatchObject({ state: "PARTIAL_PAGE_CAP", pagesFetched: 2 });
  });

  it("clamps a page size the source would reject", async () => {
    const searchStudies = vi.fn().mockResolvedValueOnce({ studies: [ctStudy("NCT00000001")], totalCount: 1 });
    const ctx = mockGateway<GenericGatewayContext>({ clinicalTrials: {
      getVersion: vi.fn().mockResolvedValue({ apiVersion: "2.0.5", dataTimestamp: "2026-07-24T09:00:05" }),
      searchStudies,
    } });

    await searchByDisease(ctx, { queries: ["Long COVID"], pageSize: 99999 });

    expect(searchStudies).toHaveBeenNthCalledWith(1, expect.objectContaining({ pageSize: 1000 }));
  });

  it("deduplicates selected ids before detail fetch", async () => {
    const getStudy = vi.fn().mockResolvedValue(ctStudy("NCT00000001"));
    const ctx = mockGateway<GenericGatewayContext>({ clinicalTrials: { getStudy } });
    const detail = await detailsByNctIds(ctx, { nctIds: ["nct00000001", "NCT00000001"] });
    expect(detail).toHaveLength(1);
    expect(getStudy).toHaveBeenCalledTimes(1);
  });

  it("resolves many PMIDs in one ESummary call", async () => {
    const summarizePubmed = vi.fn().mockResolvedValue({ result: {
      uids: ["1", "2"], "1": { title: "One" }, "2": { title: "Two" },
    } });
    const ctx = mockGateway<GenericGatewayContext>({ pubmed: { summarizePubmed } });
    const publications = await publicationsByPmid(ctx, { pmids: ["1", "2", "2"] });
    expect(publications).toHaveLength(2);
    expect(summarizePubmed).toHaveBeenCalledOnce();
    expect(summarizePubmed).toHaveBeenCalledWith(expect.objectContaining({ id: "1,2" }));
  });

  it("propagates a registry error instead of returning a false empty", async () => {
    const ctx = mockGateway<GenericGatewayContext>({ clinicalTrials: {
      getVersion: vi.fn().mockResolvedValue({ dataTimestamp: "2026-07-24" }),
      searchStudies: vi.fn().mockRejectedValue(new Error("429")),
    } });
    await expect(searchByDisease(ctx, { queries: ["Long COVID"] })).rejects.toThrow("429");
  });
});
