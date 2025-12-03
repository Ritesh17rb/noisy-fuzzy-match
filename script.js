import { html, render } from "lit-html";
import { bootstrapAlert } from "bootstrap-alert";

const $ = (sel, el = document) => el.querySelector(sel);
const loading = html`<div class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

function notify(color, title, body) {
  bootstrapAlert({ color, title, body });
}

function scoreColor(score) {
  return score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
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
    .filter((m) => threshold == null || m.score >= Number(threshold))
    .sort((x, y) => y.score - x.score);

  const matchedA = new Set(all.map((m) => m.source));
  const matchedB = new Set(all.map((m) => m.target));
  return {
    matches: all,
    unmatchedSource: listA.filter((x) => !matchedA.has(x)),
    unmatchedTarget: listB.filter((x) => !matchedB.has(x)),
  };
}

async function parseCSV(file) {
  const Papa = await import("https://esm.sh/papaparse@5.4.1");
  return new Promise((resolve, reject) => {
    Papa.default.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data.map(row => Object.values(row)[0]).map(x => String(x).trim()).filter(Boolean)),
      error: reject
    });
  });
}

async function handleFileUpload(file, targetList) {
  const items = await parseCSV(file);
  if (!items.length) throw new Error("No items found in file");
  current[targetList === 'A' ? 'listA' : 'listB'] = items;
  current[targetList === 'A' ? 'fileNameA' : 'fileNameB'] = file.name;
  renderEditor();
  notify("success", "File loaded", `${items.length} items loaded from ${file.name}`);
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
  render(html`${cards}`, $("#demo-cards"));
}

let current = { listA: [], listB: [], locks: [], fileNameA: null, fileNameB: null };

function renderEditor() {
  const optsA = current.listA.map((x) => html`<option value="${x}">${x}</option>`);
  const optsB = current.listB.map((x) => html`<option value="${x}">${x}</option>`);

  const locksView = current.locks.map((l, idx) => html`
    <span class="badge text-bg-primary me-2 mb-2">
      ${l[0]} = ${l[1]}
      <button class="btn btn-sm btn-link text-danger ps-2" @click=${() => { current.locks.splice(idx, 1); renderEditor(); }}>X</button>
    </span>
  `);

  const createListInput = (label, list, targetList) => {
    const fileName = targetList === 'A' ? current.fileNameA : current.fileNameB;
    return html`
      <label class="form-label fw-semibold">${label}</label>
      <div class="mb-2">
        <input type="file" class="form-control form-control-sm ${fileName ? 'border-success' : ''}" accept=".csv" 
          @change=${async (e) => {
            const file = e.target.files[0];
            if (file) {
              try {
                await handleFileUpload(file, targetList);
              } catch (error) {
                notify("danger", "Error loading file", error.message);
              }
              e.target.value = '';
            }
          }} />
        ${fileName ? html`<small class="text-success"><i class="bi bi-check-circle-fill me-1"></i>${fileName}</small>` : html`<small class="text-muted">Upload CSV file</small>`}
      </div>
   <textarea 
  class="form-control" 
  rows="10"
  .value=${current[list].join("\n")}
  @input=${(e) => current[list] = e.target.value.split("\n").map(x => x.trim()).filter(Boolean)}
></textarea>

    `;
  };

  render(html`
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div class="fw-bold">Editor</div>
        <button class="btn btn-sm btn-primary" id="run-editor">Run</button>
      </div>
      <div class="card-body">
        <div class="row g-4">
          <div class="col-md-6">${createListInput("List A (one item per line)", "listA", "A")}</div>
          <div class="col-md-6">${createListInput("List B (one item per line)", "listB", "B")}</div>
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
  `, $("#editor"));

  $("#add-lock").onclick = () => {
    const a = $("#lock-a").value;
    const b = $("#lock-b").value;
    if (!a || !b) return notify("warning", "Select items", "Choose from both lists to add a lock.");
    if (current.locks.some((l) => l[0] === a && l[1] === b)) return notify("warning", "Duplicate lock", "This lock already exists.");
    if (current.locks.some((l) => l[0] === a)) return notify("warning", "Already locked", `"${a}" is already locked to another item.`);
    if (current.locks.some((l) => l[1] === b)) return notify("warning", "Already locked", `"${b}" is already locked to another item.`);
    current.locks.push([a, b]);
    renderEditor();
  };

  $("#run-editor").addEventListener("click", async () => {
    const listA = current.listA.filter(Boolean);
    const listB = current.listB.filter(Boolean);
    if (!listA.length || !listB.length) return notify("warning", "Add data", "Add items to both lists before running.");
    render(loading, $("#output"));
    try {
      const result = await matchListsGlobal(listA, listB, current.locks, {
        ratio: $("#ratio").value || defaultSettings.ratio,
        threshold: $("#threshold").value || defaultSettings.threshold,
      });
      renderMatches(result);
    } catch (e) {
      notify("danger", "Error", String(e));
    }
  });
}

render(loading, $("#demo-cards"));
const { demos = [], defaults: fetchedDefaults = {} } = await fetch("config.json").then((r) => r.json()).catch(() => ({ demos: [], defaults: {} }));
const config = { demos, defaults: fetchedDefaults };
const defaultSettings = config.defaults || { ratio: "token_sort_ratio", threshold: 60 };
renderCards(config);
renderEditor();   
$("#demo-cards").addEventListener("click", (e) => {
  const fresh = e.target.closest("[data-load-fresh]");
  if (fresh) { 
    current = { listA: [""], listB: [""], locks: [], fileNameA: null, fileNameB: null }; 
    renderEditor(); 
    return; 
  }
  const loadBtn = e.target.closest("[data-load-demo]");
  if (loadBtn) {
    const demo = config.demos[Number(loadBtn.getAttribute("data-load-demo"))];
    if (demo) {
      current = { 
        listA: [...demo.listA], 
        listB: [...demo.listB], 
        locks: demo.locks?.map((l) => [l[0], l[1]]) || [],
        fileNameA: null,
        fileNameB: null
      };
      renderEditor();
    }
  }
});