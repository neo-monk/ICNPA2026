const contentsList = document.getElementById("contentsList");
const sectionsEl = document.getElementById("sections");
const authorsEl = document.getElementById("authors");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");

let sections = [];

// Parse CSV text handling commas inside quoted values
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

  return lines.slice(1).filter(line => line.trim() !== "").map(line => {
    const row = [];
    let insideQuote = false;
    let entry = "";

    for (let char of line) {
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());

    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ? row[index].replace(/^"|"$/g, '') : "";
    });
    return record;
  });
}

// Convert CSV rows into grouped section structures
function processCSVData(records) {
  const sectionMap = new Map();

  records.forEach(r => {
    const label = r.section_label || "A";
    const title = r.section_title || "General";
    const sectionId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, {
        id: sectionId,
        label: label,
        title: title,
        entries: []
      });
    }

    sectionMap.get(sectionId).entries.push({
      id: r.entry_code || "",
      title: r.title || "",
      authors: r.authors || "",
      pdf: r.pdf_url || "#"
    });
  });

  // Sort sections alphabetically/numerically by section_label (A to Z)
  return Array.from(sectionMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  );
}

function allEntries() {
  return sections.flatMap(s => s.entries.map(e => ({ ...e, sectionId: s.id, sectionTitle: s.title })));
}

function renderContents() {
  contentsList.innerHTML = `<div class="contents-grid">${
    sections.map(s => `<div class="contents-item">
      <a href="#${s.id}">${escapeHtml(s.label)}.${escapeHtml(s.title)}</a>
    </div>`).join("")
  }</div>`;
}

function renderSections(query = "") {
  const q = query.trim().toLowerCase();
  let shown = 0;
  sectionsEl.innerHTML = sections.map(s => {
    const entries = s.entries.filter(e =>
      !q || [e.id, e.title, e.authors].join(" ").toLowerCase().includes(q)
    );
    shown += entries.length;
    if (q && entries.length === 0) return "";

    const rows = entries.map(e => `
      <article class="entry" id="${escapeHtml(e.id)}">
        <div class="number">${escapeHtml(e.id)}</div>
        <div>
          <div class="title">${escapeHtml(e.title)}</div>
          <div class="authors">${escapeHtml(e.authors)}</div>
        </div>
        <a class="pdf" href="${escapeHtml(e.pdf)}" target="_blank" rel="noopener">PDF</a>
      </article>
    `).join("");

    return `<section class="conference-section" id="${s.id}">
      <div class="section-heading">
        <h2>${escapeHtml(s.label)}. ${escapeHtml(s.title)}</h2>
        <a href="#contents">Top ↑</a>
      </div>
      ${rows}
    </section>`;
  }).join("");

  countEl.textContent = `${shown} abstract${shown === 1 ? "" : "s"}`;
}

function renderAuthors() {
  const map = new Map();
  allEntries().forEach(e => {
    e.authors.split(/[,;]/).map(x => x.trim()).filter(Boolean).forEach(author => {
      if (!map.has(author)) map.set(author, []);
      map.get(author).push(e.id);
    });
  });

  authorsEl.innerHTML = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, ids]) =>
      `<div class="author-row">
        <div class="author-name">${escapeHtml(name)}</div>
        <div>${ids.map(id => `<a href="#${escapeHtml(id)}">${escapeHtml(id)}</a>`).join(", ")}</div>
      </div>`
    ).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

async function init() {
  try {
    // Dynamic timestamp forces GitHub Pages/Browser to download the latest data.csv
    const response = await fetch("./data.csv?v=" + Date.now());
    if (!response.ok) throw new Error(`Failed to load data.csv (Status: ${response.status})`);
    
    const csvText = await response.text();
    const records = parseCSV(csvText);

    sections = processCSVData(records);

    renderContents();
    renderSections();
    renderAuthors();

    searchEl.addEventListener("input", e => renderSections(e.target.value));
  } catch (error) {
    sectionsEl.innerHTML = `<div class="empty">Error loading data: ${error.message}. Make sure data.csv exists in your repository root.</div>`;
  }
}

init();
