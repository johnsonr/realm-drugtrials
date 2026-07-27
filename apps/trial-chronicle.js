const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const list = (value) => Array.isArray(value) ? value : [];

function resultData(envelope) {
  if (envelope && envelope.status === "FAILED") throw new Error(envelope.error?.message || "The evidence query failed.");
  return envelope?.data ?? envelope;
}

function statusClass(status) {
  if (["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(status)) return "problem";
  if (status === "COMPLETED") return "done";
  return "";
}

function render(result) {
  const trials = list(result.trials);
  const findings = list(result.findings);
  const summary = result.summary || {};
  const statuses = Object.entries(summary.byStatus || {}).sort((a,b) => b[1]-a[1]).slice(0, 4);
  const cards = [
    [summary.matchingTrials ?? trials.length, "matching trials after filters"],
    [summary.sourceMatches ?? trials.length, "records matched at source"],
    [trials.filter(t => t.hasResults).length, "with registry results"],
    [findings.length, "signals requiring attention"],
  ];
  const trialRows = trials.slice(0, 100).map((t) => `
    <a class="trial" href="${escapeHtml(t.registryUrl)}" target="_blank" rel="noreferrer">
      <span><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.nctId)} · ${escapeHtml(list(t.phases).join(", ") || t.studyType || "phase not stated")}</small></span>
      <span class="status ${statusClass(t.overallStatus)}">${escapeHtml(t.overallStatus || "UNKNOWN")}</span>
      <span class="sponsor">${escapeHtml(t.sponsor || "Sponsor not stated")}</span>
      <span class="results">${t.hasResults ? "Results posted" : "No registry results"}</span>
    </a>`).join("");
  const findingRows = findings.slice(0, 30).map((f) => `
    <div class="finding"><b>${escapeHtml(f.nctId)} · ${escapeHtml(f.statement)}</b><p>${escapeHtml(f.basis)}</p></div>`).join("");
  const ledger = list(result.sourceLedger)[0] || {};
  $("#answer").innerHTML = `
    <section class="answer-main">
      <p class="answer-kicker">Live answer · distinctions preserved</p>
      <h2>${escapeHtml(result.question || "Clinical trial landscape")}</h2>
      <p class="lede">The current registry returned ${escapeHtml(summary.sourceMatches ?? trials.length)} records; ${escapeHtml(trials.length)} remain after the selected filters. Status describes conduct—not whether an intervention works.</p>
      <div class="summary-cards">${cards.map(([n,label]) => `<div class="summary-card"><b>${escapeHtml(n)}</b><span>${escapeHtml(label)}</span></div>`).join("")}</div>
      <div class="coverage"><strong>Coverage: ${escapeHtml(result.coverage?.state || "UNKNOWN")}</strong><p>${escapeHtml(result.coverage?.detail || "No coverage statement returned.")}</p></div>
      <div class="trial-list">${trialRows || "<p>No matching trial records were returned for this scope.</p>"}</div>
      ${trials.length > 100 ? `<p class="ledger">Showing the first 100 of ${escapeHtml(trials.length)} normalized records.</p>` : ""}
      ${findingRows ? `<div class="findings"><p class="answer-kicker">Problems visible in the current record</p>${findingRows}</div>` : ""}
    </section>
    <aside class="answer-side">
      <p class="answer-kicker">Evidence controls</p>
      <h3>${escapeHtml(result.coverage?.state === "COMPLETE" ? "Source traversal complete" : "Read the coverage boundary")}</h3>
      <p>${escapeHtml(result.coverage?.detail || "Coverage was not declared.")}</p>
      <dl>${statuses.map(([s,n]) => `<div><dt>${escapeHtml(n)}</dt><dd>${escapeHtml(s)}</dd></div>`).join("") || "<div><dt>0</dt><dd>No status counts</dd></div>"}</dl>
      <p class="answer-kicker" style="margin-top:28px">Unknowns retained</p>
      <ul class="unknowns">${list(result.unknowns).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      <div class="ledger"><b>Source ledger</b><br>${escapeHtml(ledger.source || "ClinicalTrials.gov")}<br>Data: ${escapeHtml(ledger.dataTimestamp || "not supplied")}<br>Retrieved: ${escapeHtml(ledger.retrievedAt || "not supplied")}<br>Query: ${escapeHtml(ledger.query || result.scope?.registryQuery || "")}</div>
    </aside>`;
  $("#answer-title").textContent = `Evidence assembled for ${result.scope?.condition || "this disease"}`;
  $("#timestamp").textContent = ledger.dataTimestamp ? `Source data ${ledger.dataTimestamp}` : "Live source response";
}

async function investigate(condition) {
  $("#error").hidden = true;
  // Keep the previous answer on screen, dimmed, while the next one loads: blanking it made a
  // working query look broken, and on a first run the page's own explanation stays readable.
  $("#answer").classList.add("busy");
  $("#loading").hidden = false;
  $("#live-dot").classList.add("busy");
  $("#answer-title").textContent = `Reconstructing ${condition}…`;
  try {
    const response = await fetch("/api/v1/lenses/trial-landscape/invoke", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: { condition, phases: "", countries: "", statuses: "" } }),
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Sign in to the Embabel workspace, then run the query again.");
      throw new Error((await response.json().catch(() => ({}))).error || `Request failed (${response.status}).`);
    }
    render(resultData(await response.json()));
    $("#answer").hidden = false;
  } catch (error) {
    $("#error").textContent = error instanceof Error ? error.message : "The evidence query could not be completed.";
    $("#error").hidden = false;
    $("#answer-title").textContent = "The source traversal did not complete";
  } finally {
    $("#loading").hidden = true;
    $("#answer").classList.remove("busy");
    $("#live-dot").classList.remove("busy");
  }
}

$("#question-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const condition = $("#condition").value.trim();
  if (condition) investigate(condition);
});
document.querySelectorAll("[data-condition]").forEach((button) => button.addEventListener("click", () => {
  $("#condition").value = button.dataset.condition;
  investigate(button.dataset.condition);
}));

