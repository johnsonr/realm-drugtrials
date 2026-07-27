// WhatsBeenTried.org public workspace app.
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

/* ── Geography and time ──────────────────────────────────────────────────────────────────────
 * Both are computed from the records the traversal already returned, so they cost no extra
 * source calls and can never disagree with the numbers above them. Sequential single hue for
 * magnitude on the map; two validated categorical hues for the two time series.
 */
const MAP_STEPS = ["#d7ece7", "#a9d8cf", "#6fbfb2", "#3aa08f", "#168477", "#0d6055"];
const NO_DATA = "#e6e4df";
const C_STARTED = "#0d8a76";
const C_COMPLETED = "#8a5cf0";

/** Registry country spellings → the outline set's names. Unmapped names simply don't shade. */
const COUNTRY_ALIASES = {
  "United States": "United States of America", "Korea, Republic of": "South Korea",
  "Korea, Democratic People's Republic of": "North Korea", "Russian Federation": "Russia",
  "Iran, Islamic Republic of": "Iran", "Viet Nam": "Vietnam", "Türkiye": "Turkey",
  "Syrian Arab Republic": "Syria", "Tanzania, United Republic of": "Tanzania",
  "Venezuela, Bolivarian Republic of": "Venezuela", "Bolivia, Plurinational State of": "Bolivia",
  "Moldova, Republic of": "Moldova", "Macedonia, The Former Yugoslav Republic of": "North Macedonia",
  "Bosnia and Herzegovina": "Bosnia and Herz.", "Dominican Republic": "Dominican Rep.",
  "Czech Republic": "Czechia", "Congo, The Democratic Republic of the": "Dem. Rep. Congo",
  "Lao People's Democratic Republic": "Laos", "Brunei Darussalam": "Brunei",
  "Central African Republic": "Central African Rep.", "South Sudan": "S. Sudan",
  "Equatorial Guinea": "Eq. Guinea", "Solomon Islands": "Solomon Is.", "Côte D'Ivoire": "Côte d'Ivoire",
  "Taiwan, Province of China": "Taiwan", "Hong Kong": "China", "Macau": "China",
  "Palestinian Territories, Occupied": "Palestine", "United Kingdom": "United Kingdom",
};
const mapName = (c) => COUNTRY_ALIASES[c] || c;

function countryCounts(trials) {
  const counts = new Map();
  trials.forEach((t) => new Set(list(t.countries)).forEach((c) => {
    const k = String(c || "").trim();
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Step index for a count, on a sqrt scale so one huge country doesn't flatten everything else. */
function stepFor(count, max) {
  if (!count) return -1;
  const t = Math.sqrt(count) / Math.sqrt(max);
  return Math.min(MAP_STEPS.length - 1, Math.max(0, Math.round(t * (MAP_STEPS.length - 1))));
}

function renderGeography(trials) {
  const host = $("#geography");
  if (!host) return;
  const ranked = countryCounts(trials);
  if (!ranked.length) { host.hidden = true; return; }
  host.hidden = false;
  const max = ranked[0][1];
  const byOutline = new Map();
  ranked.forEach(([c, n]) => {
    const key = mapName(c);
    byOutline.set(key, (byOutline.get(key) || 0) + n); // Hong Kong/Macau fold into China
  });

  const paths = window.WORLD_PATHS || {};
  const shapes = Object.keys(paths).map((name) => {
    const n = byOutline.get(name) || 0;
    const step = stepFor(n, max);
    const fill = step < 0 ? NO_DATA : MAP_STEPS[step];
    const label = n ? `${name}: ${n} trial${n === 1 ? "" : "s"}` : `${name}: no registered location`;
    return `<path d="${paths[name]}" fill="${fill}" data-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title></path>`;
  }).join("");

  const top = ranked.slice(0, 12);
  const bars = top.map(([c, n]) => `
    <div class="geo-row">
      <span class="geo-country">${escapeHtml(c)}</span>
      <span class="geo-track"><span class="geo-bar" style="width:${Math.max(2, (n / max) * 100)}%"></span></span>
      <span class="geo-value">${escapeHtml(n)}</span>
    </div>`).join("");

  host.innerHTML = `
    <div class="viz-head">
      <p class="answer-kicker">Where these trials are registered</p>
      <span class="viz-note">${escapeHtml(ranked.length)} countries · a trial counts once per country</span>
    </div>
    <svg class="worldmap" viewBox="0 0 1000 500" role="img" aria-label="Trials by country">${shapes}</svg>
    <div class="map-legend">
      <span>Fewer</span>${MAP_STEPS.map(c => `<i style="background:${c}"></i>`).join("")}<span>More</span>
      <i class="nodata" style="background:${NO_DATA}"></i><span>No registered location</span>
    </div>
    <div class="geo-bars">${bars}</div>`;
}

/** Year from a registry date string ("2021-04" / "2021-04-19"); null when the field is absent. */
function yearOf(value) {
  const m = /^(\d{4})/.exec(String(value || ""));
  return m ? Number(m[1]) : null;
}

function renderTimeline(trials) {
  const host = $("#timeline");
  if (!host) return;
  const started = new Map();
  const completed = new Map();
  let stopped = 0;
  trials.forEach((t) => {
    const s = yearOf(t.startDate);
    if (s) started.set(s, (started.get(s) || 0) + 1);
    const c = yearOf(t.completionDate || t.primaryCompletionDate);
    if (c) completed.set(c, (completed.get(c) || 0) + 1);
    if (["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(String(t.overallStatus))) stopped += 1;
  });
  const years = [...new Set([...started.keys(), ...completed.keys()])].filter(Boolean).sort();
  if (years.length < 2) { host.hidden = true; return; }
  // Clip to a readable window: a stray 2035 completion date must not squash every real year.
  const thisYear = new Date().getFullYear();
  const within = years.filter((y) => y >= thisYear - 12 && y <= thisYear + 3);
  // EVERY year in the range, including empty ones — a time axis that skips its quiet years
  // compresses them to nothing and misstates when the work actually happened.
  const shown = [];
  for (let y = Math.min(...within); y <= Math.max(...within); y++) shown.push(y);
  const max = Math.max(1, ...shown.map((y) => Math.max(started.get(y) || 0, completed.get(y) || 0)));

  const cols = shown.map((y) => {
    const s = started.get(y) || 0, c = completed.get(y) || 0;
    // Anything past this year has not happened: those completions are the registry's PLANNED
    // dates. Hatched, not solid, so a projection is never read as a result.
    const future = y > thisYear;
    const startedTip = future ? `${y}: ${s} due to start` : `${y}: ${s} started`;
    const doneTip = future ? `${y}: ${c} due to complete` : `${y}: ${c} completed`;
    return `
      <div class="tl-col${y === thisYear ? " now" : ""}${future ? " future" : ""}">
        ${y === thisYear ? '<span class="now-flag">we are here</span><span class="now-line"></span>' : ""}
        <div class="tl-pair">
          <span class="tl-bar started" style="height:${(s / max) * 100}%" title="${escapeHtml(startedTip)}"></span>
          <span class="tl-bar completed" style="height:${(c / max) * 100}%" title="${escapeHtml(doneTip)}"></span>
        </div>
        <span class="tl-year${y === thisYear ? " now" : ""}">${escapeHtml(String(y))}</span>
      </div>`;
  }).join("");

  host.hidden = false;
  host.innerHTML = `
    <div class="viz-head">
      <p class="answer-kicker">When these trials started, and when they are due to finish</p>
      <span class="viz-note">Registered dates · ${escapeHtml(stopped)} stopped early (terminated, withdrawn or suspended)</span>
    </div>
    <div class="tl-legend">
      <span><i style="background:${C_STARTED}"></i>Started</span>
      <span><i style="background:${C_COMPLETED}"></i>Completed</span>
      <span><i class="hatch"></i>Planned, not yet happened</span>
      <span class="viz-note">Peak ${escapeHtml(max)} trials in a year</span>
    </div>
    <div class="tl-chart" style="--started:${C_STARTED};--completed:${C_COMPLETED}">${cols}</div>
    <p class="themes-basis">A completion date in the future is the registry's own projection, not an outcome.</p>`;
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
      <div id="themes" class="themes">
        <div class="themes-head">
          <p class="answer-kicker">What recurs across these trials</p>
          <span id="themes-status" class="themes-status"><span class="spinner"></span>Reading across the trials…</span>
        </div>
        <div id="themes-body"></div>
      </div>
      <section id="geography" class="viz" hidden></section>
      <section id="timeline" class="viz" hidden></section>
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
  renderGeography(trials);
  renderTimeline(trials);
  $("#answer-title").textContent = `Evidence assembled for ${result.scope?.condition || "this disease"}`;
  $("#timestamp").textContent = ledger.dataTimestamp ? `Source data ${ledger.dataTimestamp}` : "Live source response";
}

/**
 * The recurring-themes read, fetched AFTER the landscape is on screen. It costs an LLM reduction
 * over every returned title (tens of seconds), so blocking the answer on it would trade a fast,
 * factual result for a slow one. The facts stay the registry's: `themes()`/`summarize()` reduce
 * the rows the traversal returned, so an empty traversal yields nothing rather than invented prose.
 */
/**
 * Live progress from the engine's own run events, rather than a spinner that says nothing for a
 * minute. `GET /api/v1/virtual-cypher/events` streams this user's virtual-cypher runs;
 * `producer.progress` carries current/total, so the percentage shown is the engine's real fetch
 * position, never an animation pretending to be one. If the stream is unavailable the page simply
 * keeps the plain status text — progress is an enhancement, never a precondition for the answer.
 */
function trackProgress(setStatus) {
  let source;
  try {
    source = new EventSource("/api/v1/virtual-cypher/events", { withCredentials: true });
  } catch (e) {
    return () => {};
  }
  const on = (name, handler) => source.addEventListener(name, (e) => {
    try { handler(JSON.parse(e.data)); } catch (_) { /* a malformed frame must not break the page */ }
  });
  on("producer.progress", (d) => {
    if (!d || !d.total) return;
    const pct = Math.min(100, Math.round((d.current / d.total) * 100));
    // `batch` is the LLM reduction walking its packs; anything else is a source fetch.
    const what = d.unit === "batch" ? "Reading" : "Fetching";
    setStatus(`${what} — ${pct}% (${d.current} of ${d.total})`);
  });
  on("producer.fetch", (d) => setStatus(`Calling ${escapeHtml(String(d && d.producer || "the source"))}…`));
  on("nodes.materialized", (d) => {
    if (d && d.count) setStatus(`Building the evidence graph — ${d.count} records`);
  });
  return () => { try { source.close(); } catch (_) {} };
}

async function readThemes(condition) {
  const section = $("#themes");
  const status = $("#themes-status");
  const body = $("#themes-body");
  if (!section || !status || !body) return; // render() owns the block; nothing to fill before it runs
  const stopProgress = trackProgress((text) => {
    status.innerHTML = `<span class="spinner"></span>${text}`;
  });
  try {
    const response = await fetch("/api/v1/lenses/trial-themes/invoke", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: { condition } }),
    });
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    const result = resultData(await response.json());
    const topics = list(result.topics);
    if (!topics.length && !result.narrative) {
      status.textContent = "No themes could be read from this set.";
      return;
    }
    status.textContent = result.readAcross ? `Read across ${result.readAcross} trials` : "";
    body.innerHTML = `
      ${result.narrative ? `<p class="themes-narrative">${escapeHtml(result.narrative)}</p>` : ""}
      ${topics.length ? `<ul class="theme-list">${topics.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
      <p class="themes-basis">${escapeHtml(result.basis || "")}</p>`;
  } catch (error) {
    // A failed reading must not cast doubt on the landscape above it, which is already correct.
    status.textContent = "The thematic reading is unavailable — the evidence above is unaffected.";
  } finally {
    stopProgress();
  }
}

async function investigate(condition) {
  $("#error").hidden = true;
  // ONE status signal, in the status bar, in plain words. Three competing ones (a title, a
  // "no source call yet" stamp that contradicted it mid-call, and a panel of internal
  // vocabulary) over a dimmed body read as a broken page rather than a running query.
  $("#spinner").hidden = false;
  $("#live-dot").classList.add("busy");
  $("#answer-title").textContent = `Searching ClinicalTrials.gov for ${condition}…`;
  $("#timestamp").textContent = "Live query running";
  const stopProgress = trackProgress((text) => { $("#timestamp").textContent = text; });
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
    readThemes(condition); // deliberately not awaited — the landscape is already usable
  } catch (error) {
    $("#error").textContent = error instanceof Error ? error.message : "The evidence query could not be completed.";
    $("#error").hidden = false;
    $("#answer-title").textContent = "The source traversal did not complete";
  } finally {
    stopProgress();
    $("#spinner").hidden = true;
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
