import { html, render } from "lit-html";
import { bootstrapAlert } from "bootstrap-alert";

// Tiny DOM helper
const $ = (sel, el = document) => el.querySelector(sel);

// Spinner while computing
const loading = html`<div class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

function notify(color, title, body) {
  bootstrapAlert({ color, title, body });
}

function scoreColor(score) {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

function renderMatches({ matches, unmatchedSource, unmatchedTarget }) {
  const rows = matches.map(({ source, target, score, isManual }) => html`
    <tr>
      <td class="fw-semibold">${source}</td>
      <td>${target}</td>
      <td class="text-end fw-bold ${isManual ? "text-primary" : scoreColor(score)}">${score}%</td>
      <td class="text-center"><span class="badge ${isManual ? "text-bg-primary" : "text-bg-secondary"}">${isManual ? "Locked" : "Auto"}</span></td>
    </tr>`);

  const unmatchedA = unmatchedSource.length
    ? unmatchedSource.map((x) => html`<li class="list-group-item list-group-item-danger py-1">${x}</li>`)
    : [html`<li class="list-group-item text-muted py-1">All items matched</li>`];
  const unmatchedB = unmatchedTarget.length
    ? unmatchedTarget.map((x) => html`<li class="list-group-item list-group-item-warning py-1">${x}</li>`)
    : [html`<li class="list-group-item text-muted py-1">All items matched</li>`];

  render(html`
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div class="fw-bold">Optimized Matches</div>
            <span class="badge text-bg-success">${matches.length} Pairs</span>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th>Source (List A)</th><th>Target (List B)</th><th class="text-end">Similarity</th><th class="text-center">Type</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-4 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header text-danger fw-bold">Unmatched Source</div>
          <ul class="list-group list-group-flush">${unmatchedA}</ul>
        </div>
        <div class="card">
          <div class="card-header text-warning fw-bold">Unmatched Target</div>
          <ul class="list-group list-group-flush">${unmatchedB}</ul>
        </div>
      </div>
    </div>
  `, $("#output"));
}

// Core matching: Hungarian + fuzzball + manual locks
async function matchListsGlobal(listA, listB, manualMatches, options) {
  const { ratio = "token_sort_ratio", threshold } = options || {};
  const [{ linearSumAssignment }, fuzzball] = await Promise.all([
    import("https://esm.sh/linear-sum-assignment"),
    import("https://esm.sh/fuzzball"),
  ]);

  const fixedA = new Set(manualMatches.map((m) => m[0]));
  const fixedB = new Set(manualMatches.map((m) => m[1]));
  const openA = listA.filter((x) => !fixedA.has(x));
  const openB = listB.filter((x) => !fixedB.has(x));

  const fn = fuzzball[ratio] || fuzzball.token_sort_ratio;
  const cost = openA.map((a) => openB.map((b) => fn(a, b)));

  let algo = [];
  if (openA.length && openB.length) {
    const res = linearSumAssignment(cost, { maximize: true });
    algo = Array.from(res.rowAssignments)
      .map((col, row) => (col !== undefined && col !== -1 && openB[col]
        ? { source: openA[row], target: openB[col], score: cost[row][col], isManual: false }
        : null))
      .filter(Boolean);
  }

  const manual = manualMatches.map(([a, b]) => ({ source: a, target: b, score: 100, isManual: true }));
  const all = [...manual, ...algo]
    .filter((m) => (threshold == null ? true : m.score >= Number(threshold)))
    .sort((x, y) => y.score - x.score);

  const matchedA = new Set(all.map((m) => m.source));
  const matchedB = new Set(all.map((m) => m.target));
  return {
    matches: all,
    unmatchedSource: listA.filter((x) => !matchedA.has(x)),
    unmatchedTarget: listB.filter((x) => !matchedB.has(x)),
  };
}

function renderCards(config) {
  const cards = [
    html`
      <div class="col-md-4 col-lg-3">
        <div class="card h-100 text-center">
          <div class="card-body d-flex flex-column">
            <div class="mb-2"><i class="bi bi-stars display-3 text-success"></i></div>
            <h6 class="card-title h5">Start Fresh</h6>
            <p class="card-text">Begin with empty lists and add your own items.</p>
            <button class="btn btn-primary mt-auto" data-load-fresh>Load</button>
          </div>
        </div>
      </div>`,
    ...config.demos.map((d, i) => html`
      <div class="col-md-4 col-lg-3">
        <div class="card h-100 text-center">
          <div class="card-body d-flex flex-column">
            <div class="mb-2"><i class="${d.icon} display-3 text-primary"></i></div>
            <h6 class="card-title h5">${d.title}</h6>
            <p class="card-text">${d.body}</p>
            <button class="btn btn-primary mt-auto" data-load-demo="${i}">Load</button>
          </div>
        </div>
      </div>
    `),
  ];
  render(html`${cards}`, document.getElementById("demo-cards"));
}

// Editor state
let current = { listA: [], listB: [], locks: [] };
let manualLocks = [];

function renderEditor() {
  const optsA = current.listA.map((x) => html`<option value="${x}">${x}</option>`);
  const optsB = current.listB.map((x) => html`<option value="${x}">${x}</option>`);

  const locksView = (current.locks || []).map((l, idx) => html`
    <span class="badge text-bg-primary me-2 mb-2">
      ${l[0]} = ${l[1]}
      <button class="btn btn-sm btn-link text-white ps-2" @click=${() => { current.locks.splice(idx, 1); renderEditor(); }}>x</button>
    </span>
  `);

  const tableA = html`
    <table class="table table-sm">
      <thead class="table-light"><tr><th style="width:40px">#</th><th>List A</th><th style="width:70px"></th></tr></thead>
      <tbody>
        ${current.listA.map((val, i) => html`
          <tr>
            <td class="text-muted">${i + 1}</td>
            <td><input class="form-control" .value=${val} @input=${(e) => { current.listA[i] = e.target.value; }} /></td>
            <td><button class="btn btn-outline-danger btn-sm" @click=${() => { current.listA.splice(i, 1); renderEditor(); }}>Del</button></td>
          </tr>
        `)}
      </tbody>
    </table>
    <button class="btn btn-outline-secondary btn-sm" @click=${() => { current.listA.push(""); renderEditor(); }}>Add Row</button>`;

  const tableB = html`
    <table class="table table-sm">
      <thead class="table-light"><tr><th style="width:40px">#</th><th>List B</th><th style="width:70px"></th></tr></thead>
      <tbody>
        ${current.listB.map((val, i) => html`
          <tr>
            <td class="text-muted">${i + 1}</td>
            <td><input class="form-control" .value=${val} @input=${(e) => { current.listB[i] = e.target.value; }} /></td>
            <td><button class="btn btn-outline-danger btn-sm" @click=${() => { current.listB.splice(i, 1); renderEditor(); }}>Del</button></td>
          </tr>
        `)}
      </tbody>
    </table>
    <button class="btn btn-outline-secondary btn-sm" @click=${() => { current.listB.push(""); renderEditor(); }}>Add Row</button>`;

  render(html`
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div class="fw-bold">Editor</div>
        <div>
          <button class="btn btn-sm btn-primary" id="run-editor">Run</button>
        </div>
      </div>
      <div class="card-body">
        <div class="row g-4">
          <div class="col-md-6">${tableA}</div>
          <div class="col-md-6">${tableB}</div>
        </div>
        <hr />
        <div class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Lock A</label>
            <select class="form-select" id="lock-a">${optsA}</select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Lock B</label>
            <select class="form-select" id="lock-b">${optsB}</select>
          </div>
          <div class="col-md-4">
            <button class="btn btn-outline-primary" id="add-lock">Add Lock</button>
          </div>
        </div>
        <div class="mt-3">${locksView}</div>
      </div>
    </div>
  `, document.getElementById("editor"));

  const addLockBtn = document.getElementById("add-lock");
  if (addLockBtn) addLockBtn.addEventListener("click", () => {
    const a = document.getElementById("lock-a").value;
    const b = document.getElementById("lock-b").value;
    if (!a || !b) return notify("warning", "Select items", "Choose from both lists to add a lock.");
    if (current.locks.some((l) => l[0] === a || l[1] === b)) return notify("warning", "Duplicate lock", "One of the items is already locked.");
    current.locks.push([a, b]);
    renderEditor();
  });

  const runBtn = document.getElementById("run-editor");
  if (runBtn) runBtn.addEventListener("click", async () => {
    manualLocks = current.locks || [];
    const listA = current.listA.map((x) => x.trim()).filter(Boolean);
    const listB = current.listB.map((x) => x.trim()).filter(Boolean);
    if (!listA.length || !listB.length) return notify("warning", "Add data", "Add items to both lists before running.");
    render(loading, document.getElementById("output"));
    try {
      const result = await matchListsGlobal(listA, listB, manualLocks, {
        ratio: document.getElementById("ratio").value || defaultSettings.ratio,
        threshold: document.getElementById("threshold").value || defaultSettings.threshold,
      });
      renderMatches(result);
    } catch (e) {
      notify("danger", "Error", String(e));
    }
  });
}

// Init: render cards and wire handlers
render(loading, document.getElementById("demo-cards"));
const { demos = [], defaults: fetchedDefaults = {} } = await fetch("config.json").then((r) => r.json()).catch(() => ({ demos: [], defaults: {} }));
const config = { demos, defaults: fetchedDefaults };
const defaultSettings = config.defaults || { ratio: "token_sort_ratio", threshold: 60 };
renderCards(config);

document.getElementById("demo-cards").addEventListener("click", (e) => {
  const fresh = e.target.closest("[data-load-fresh]");
  if (fresh) { current = { listA: [""], listB: [""], locks: [] }; renderEditor(); return; }
  const loadBtn = e.target.closest("[data-load-demo]");
  if (loadBtn) {
    const i = Number(loadBtn.getAttribute("data-load-demo"));
    const demo = config.demos[i]; if (!demo) return;
    current = { listA: [...(demo.listA || [])], listB: [...(demo.listB || [])], locks: (demo.locks || []).map((l) => [l[0], l[1]]) };
    renderEditor();
  }
});