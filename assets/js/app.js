(() => {
  "use strict";

  const CONFIG = window.APP_CONFIG || {};
  const RISK_ORDER = { X1: 1, X2: 2, X3: 3, X4: 4, X5: 5, SAFE: 99 };
  const COLORS = {
    blue: "#004f9f",
    navy: "#073763",
    red: "#dc2626",
    redSoft: "#fff0f0",
    green: "#15803d",
    greenSoft: "#e9f9ef",
    gray: "#94a3b8",
    graySoft: "#e2e8f0",
    white: "#ffffff",
  };

  const state = {
    rawPayload: null,
    relationships: [],
    drugs: [],
    currentDrug: null,
    currentResults: [],
    network: null,
    nodes: null,
    edges: null,
    graphReady: false,
  };

  const $ = (selector) => document.querySelector(selector);

  const els = {
    dataStatus: $("#dataStatus"),
    metricDrugs: $("#metricDrugs"),
    metricRelations: $("#metricRelations"),
    metricDanger: $("#metricDanger"),
    metricSafe: $("#metricSafe"),
    drugInput: $("#drugInput"),
    datalist: $("#drugDatalist"),
    suggestionPanel: $("#suggestionPanel"),
    searchBtn: $("#searchBtn"),
    clearBtn: $("#clearBtn"),
    copyBtn: $("#copyBtn"),
    csvBtn: $("#csvBtn"),
    resultSection: $("#resultSection"),
    selectedDrug: $("#selectedDrug"),
    dangerCount: $("#dangerCount"),
    safeCount: $("#safeCount"),
    decisionBanner: $("#decisionBanner"),
    dangerList: $("#dangerList"),
    safeList: $("#safeList"),
    relationshipTable: $("#relationshipTable"),
    tableFilter: $("#tableFilter"),
    statusFilter: $("#statusFilter"),
    graphContainer: $("#graphContainer"),
    fitGraphBtn: $("#fitGraphBtn"),
    resetGraphBtn: $("#resetGraphBtn"),
    toast: $("#toast"),
  };

  function normalize(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  }

  function isDanger(row) {
    return normalize(row.result_code) === "DO_NOT_PRESCRIBE";
  }

  function isSafe(row) {
    return normalize(row.result_code) === "CONSIDERED_SAFE";
  }

  function displayCode(row) {
    return normalize(row.result) || (isDanger(row) ? "X" : "SAFE");
  }

  function relationshipOtherDrug(row, selectedDrug) {
    const drugA = normalize(row.drug_a);
    const drugB = normalize(row.drug_b);
    if (drugA === selectedDrug) return drugB;
    if (drugB === selectedDrug) return drugA;
    return null;
  }

  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "html") el.innerHTML = value;
      else if (key.startsWith("data-")) el.setAttribute(key, value);
      else if (key === "disabled") el.disabled = Boolean(value);
      else el.setAttribute(key, value);
    });

    children.forEach((child) => {
      if (typeof child === "string") el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    });

    return el;
  }

  function setStatus(mode, message) {
    els.dataStatus.classList.remove("is-ready", "is-error");
    if (mode === "ready") els.dataStatus.classList.add("is-ready");
    if (mode === "error") els.dataStatus.classList.add("is-error");
    els.dataStatus.lastChild.nodeValue = ` ${message}`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2800);
  }

  async function loadData() {
    setStatus("loading", "กำลังโหลดฐานข้อมูล");

    try {
      const payload = CONFIG.USE_REMOTE_API
        ? await loadDataFromGas()
        : await loadDataFromJson();

      const normalized = normalizePayload(payload);
      state.rawPayload = normalized;
      state.relationships = normalized.relationships;
      state.drugs = normalized.drugs;

      hydrateMetrics(normalized);
      hydrateDatalist();
      renderSuggestions("");
      renderRelationshipTable();
      renderGraph();

      setStatus("ready", `พร้อมใช้งาน • ${state.relationships.length} คู่ความสัมพันธ์`);
    } catch (error) {
      console.error(error);
      setStatus("error", "โหลดข้อมูลไม่สำเร็จ");
      els.suggestionPanel.innerHTML = "";
      els.suggestionPanel.appendChild(
        createElement("div", { class: "empty-state", text: "ไม่สามารถโหลดฐานข้อมูลได้ โปรดตรวจสอบ data/cross_allergy.json หรือ config.js" })
      );
    }
  }

  async function loadDataFromJson() {
    const response = await fetch(CONFIG.LOCAL_DATA_URL || "data/cross_allergy.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load local JSON: ${response.status}`);
    return response.json();
  }

  function loadDataFromGas() {
    if (!CONFIG.GAS_API_URL) throw new Error("GAS_API_URL is empty.");
    return jsonp(`${CONFIG.GAS_API_URL}?action=getData`, "getData");
  }

  function logSearch(keyword) {
    if (!CONFIG.ENABLE_REMOTE_LOGGING || !CONFIG.GAS_API_URL) return;
    const url = `${CONFIG.GAS_API_URL}?action=log&keyword=${encodeURIComponent(keyword)}`;
    jsonp(url, "log").catch((err) => console.warn("Remote logging failed:", err));
  }

  function jsonp(url, prefix) {
    return new Promise((resolve, reject) => {
      const callbackName = `__bhh_${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, 15000);

      function cleanup() {
        window.clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (data) => {
        cleanup();
        resolve(data && data.data ? data.data : data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("JSONP request failed"));
      };

      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
      document.body.appendChild(script);
    });
  }

  function normalizePayload(payload) {
    const relationshipsSource = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.relationships)
        ? payload.relationships
        : Array.isArray(payload.data)
          ? payload.data
          : [];

    const relationships = relationshipsSource
      .map((row, index) => ({
        id: row.id || `rel-${String(index + 1).padStart(3, "0")}`,
        drug_a: normalize(row.drug_a),
        drug_b: normalize(row.drug_b),
        result: normalize(row.result),
        result_code: normalize(row.result_code),
        description: String(row.description || "").trim(),
      }))
      .filter((row) => row.drug_a && row.drug_b);

    const drugSet = new Set();
    relationships.forEach((row) => {
      drugSet.add(row.drug_a);
      drugSet.add(row.drug_b);
    });

    const drugs = Array.isArray(payload.drugs) && payload.drugs.length
      ? payload.drugs.map(normalize).filter(Boolean).sort()
      : Array.from(drugSet).sort();

    const dangerCount = relationships.filter(isDanger).length;
    const safeCount = relationships.filter(isSafe).length;

    return {
      metadata: payload.metadata || {},
      stats: payload.stats || {
        total_relationships: relationships.length,
        total_drugs: drugs.length,
        by_result_code: {
          DO_NOT_PRESCRIBE: dangerCount,
          CONSIDERED_SAFE: safeCount,
        },
      },
      drugs,
      relationships,
    };
  }

  function hydrateMetrics(payload) {
    const dangerCount = payload.relationships.filter(isDanger).length;
    const safeCount = payload.relationships.filter(isSafe).length;

    els.metricDrugs.textContent = payload.drugs.length.toLocaleString("th-TH");
    els.metricRelations.textContent = payload.relationships.length.toLocaleString("th-TH");
    els.metricDanger.textContent = dangerCount.toLocaleString("th-TH");
    els.metricSafe.textContent = safeCount.toLocaleString("th-TH");
  }

  function hydrateDatalist() {
    els.datalist.innerHTML = "";
    state.drugs.forEach((drug) => {
      const option = createElement("option", { value: drug });
      els.datalist.appendChild(option);
    });
  }

  function findMatchingDrugs(query) {
    const q = normalize(query);
    if (!q) return state.drugs.slice(0, 12);

    const exact = [];
    const starts = [];
    const includes = [];

    state.drugs.forEach((drug) => {
      if (drug === q) exact.push(drug);
      else if (drug.startsWith(q)) starts.push(drug);
      else if (drug.includes(q)) includes.push(drug);
    });

    return [...exact, ...starts, ...includes].slice(0, 12);
  }

  function renderSuggestions(query) {
    const matches = findMatchingDrugs(query);
    els.suggestionPanel.innerHTML = "";

    if (!state.drugs.length) return;

    matches.forEach((drug) => {
      const chip = createElement("button", { type: "button", class: "suggestion-chip", text: drug });
      chip.addEventListener("click", () => {
        els.drugInput.value = drug;
        executeSearch(drug);
      });
      els.suggestionPanel.appendChild(chip);
    });

    if (query && matches.length === 0) {
      els.suggestionPanel.appendChild(
        createElement("span", { class: "empty-state", text: "ไม่พบชื่อยาที่ตรงกับคำค้นนี้" })
      );
    }
  }

  function executeSearch(inputValue = els.drugInput.value) {
    const rawQuery = normalize(inputValue);

    if (!rawQuery) {
      showToast("โปรดระบุชื่อยา");
      els.drugInput.focus();
      return;
    }

    let selectedDrug = rawQuery;
    if (!state.drugs.includes(selectedDrug)) {
      const matches = findMatchingDrugs(selectedDrug);
      if (matches.length === 1) {
        selectedDrug = matches[0];
        els.drugInput.value = selectedDrug;
      } else {
        renderSuggestions(rawQuery);
        showToast(matches.length ? "พบหลายรายการ โปรดเลือกชื่อยาที่ต้องการ" : "ไม่พบข้อมูลยานี้ในฐานข้อมูล");
        return;
      }
    }

    const results = state.relationships
      .map((row) => {
        const otherDrug = relationshipOtherDrug(row, selectedDrug);
        if (!otherDrug) return null;
        return {
          ...row,
          selected_drug: selectedDrug,
          target_drug: otherDrug,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const riskDelta = (RISK_ORDER[displayCode(a)] || 50) - (RISK_ORDER[displayCode(b)] || 50);
        if (riskDelta !== 0) return riskDelta;
        return a.target_drug.localeCompare(b.target_drug);
      });

    state.currentDrug = selectedDrug;
    state.currentResults = results;

    logSearch(selectedDrug);
    renderResults(selectedDrug, results);
    highlightGraphDrug(selectedDrug);
    showPanel("graph", false);
    els.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderResults(selectedDrug, results) {
    const dangerItems = results.filter(isDanger);
    const safeItems = results.filter(isSafe);

    els.resultSection.classList.remove("is-hidden");
    els.selectedDrug.textContent = selectedDrug;
    els.dangerCount.textContent = `${dangerItems.length} ห้ามใช้`;
    els.safeCount.textContent = `${safeItems.length} ใช้ได้`;

    els.decisionBanner.className = "decision-banner";
    if (dangerItems.length) {
      els.decisionBanner.classList.add("is-danger");
      els.decisionBanner.textContent =
        `พบ ${dangerItems.length} รายการที่ควรหลีกเลี่ยงจากฐานข้อมูล สำหรับผู้ป่วยที่มีประวัติแพ้ ${selectedDrug} ` +
        "ควรตรวจสอบประวัติอาการแพ้และปรึกษาแพทย์/เภสัชกรก่อนสั่งใช้ยา โดยเฉพาะกรณีแพ้รุนแรงให้หลีกเลี่ยง beta-lactam ทั้งหมด";
    } else if (safeItems.length) {
      els.decisionBanner.classList.add("is-safe-only");
      els.decisionBanner.textContent =
        `ไม่พบรายการ DO NOT PRESCRIBE ในฐานข้อมูลชุดนี้สำหรับ ${selectedDrug} แต่ต้องประเมินตามประวัติอาการแพ้จริงและนโยบายโรงพยาบาลก่อนใช้ยา`;
    } else {
      els.decisionBanner.textContent = "ไม่พบความสัมพันธ์ของยานี้ในฐานข้อมูลชุดปัจจุบัน";
    }

    renderDrugList(els.dangerList, dangerItems, "danger");
    renderDrugList(els.safeList, safeItems, "safe");

    els.copyBtn.disabled = results.length === 0;
    els.csvBtn.disabled = results.length === 0;
  }

  function renderDrugList(container, items, type) {
    container.innerHTML = "";

    if (!items.length) {
      container.appendChild(
        createElement("div", {
          class: "empty-state",
          text: type === "danger"
            ? "ไม่พบรายการ DO NOT PRESCRIBE จากฐานข้อมูลชุดนี้"
            : "ไม่พบรายการ CONSIDERED SAFE จากฐานข้อมูลชุดนี้",
        })
      );
      return;
    }

    items.forEach((item) => {
      const code = displayCode(item);
      const row = createElement("article", { class: `drug-item ${type}` }, [
        createElement("strong", { text: item.target_drug }),
        createElement("div", { class: "drug-meta" }, [
          createElement("span", { class: `badge ${type}`, text: code }),
          createElement("span", { text: item.result_code }),
        ]),
        createElement("div", { text: item.description || "ไม่มีคำอธิบาย" }),
      ]);
      container.appendChild(row);
    });
  }

  function renderRelationshipTable() {
    const textFilter = normalize(els.tableFilter.value);
    const statusFilter = els.statusFilter.value;
    const filtered = state.relationships.filter((row) => {
      const haystack = normalize(`${row.drug_a} ${row.drug_b} ${row.result} ${row.result_code} ${row.description}`);
      const matchText = !textFilter || haystack.includes(textFilter);
      const matchStatus = statusFilter === "ALL" || row.result_code === statusFilter;
      return matchText && matchStatus;
    });

    els.relationshipTable.innerHTML = "";

    filtered.forEach((row) => {
      const tr = createElement("tr", {}, [
        createElement("td", { text: row.drug_a }),
        createElement("td", { text: row.drug_b }),
        createElement("td", {}, [
          createElement("span", { class: `badge ${isDanger(row) ? "danger" : "safe"}`, text: displayCode(row) }),
        ]),
        createElement("td", {}, [
          createElement("span", { class: `badge ${isDanger(row) ? "danger" : "safe"}`, text: row.result_code }),
        ]),
        createElement("td", { text: row.description }),
      ]);
      els.relationshipTable.appendChild(tr);
    });

    if (!filtered.length) {
      const tr = createElement("tr", {}, [
        createElement("td", { colspan: "5", text: "ไม่พบข้อมูลตาม filter ที่ระบุ" }),
      ]);
      els.relationshipTable.appendChild(tr);
    }
  }

  function renderGraph() {
    if (!window.vis || !state.relationships.length) {
      els.graphContainer.innerHTML = '<div class="graph-loading">ไม่สามารถโหลด graph library ได้ แต่ยังใช้ search/table ได้ตามปกติ</div>';
      return;
    }

    els.graphContainer.innerHTML = "";

    const nodes = new window.vis.DataSet(
      state.drugs.map((drug) => ({
        id: drug,
        label: drug,
        shape: "box",
        margin: 12,
        color: {
          background: "#f8fbff",
          border: COLORS.blue,
          highlight: { background: COLORS.blue, border: COLORS.navy },
        },
        font: { face: "Segoe UI", size: 15, color: "#142033", bold: { color: "#142033" } },
      }))
    );

    const edges = new window.vis.DataSet(
      state.relationships.map((row) => {
        const danger = isDanger(row);
        return {
          id: row.id,
          from: row.drug_a,
          to: row.drug_b,
          width: danger ? 3 : 1.6,
          color: {
            color: danger ? COLORS.red : COLORS.green,
            highlight: danger ? COLORS.red : COLORS.green,
            hover: danger ? COLORS.red : COLORS.green,
          },
          title: `${row.drug_a} ↔ ${row.drug_b}<br>${displayCode(row)}: ${row.description}`,
          smooth: { type: "continuous", roundness: 0.22 },
        };
      })
    );

    const options = {
      autoResize: true,
      nodes: {
        borderWidth: 1.6,
        shadow: { enabled: true, color: "rgba(7,55,99,.16)", size: 12, x: 0, y: 4 },
      },
      edges: {
        selectionWidth: 4,
      },
      interaction: {
        hover: true,
        tooltipDelay: 80,
        navigationButtons: true,
        keyboard: true,
      },
      physics: {
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -54,
          centralGravity: 0.012,
          springLength: 168,
          springConstant: 0.075,
          avoidOverlap: 0.74,
        },
        stabilization: {
          enabled: true,
          iterations: 260,
          fit: true,
        },
      },
      layout: { randomSeed: 52 },
    };

    state.nodes = nodes;
    state.edges = edges;
    state.network = new window.vis.Network(els.graphContainer, { nodes, edges }, options);
    state.graphReady = true;

    state.network.once("stabilizationIterationsDone", () => {
      state.network.setOptions({ physics: false });
      state.network.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    });

    state.network.on("click", (params) => {
      if (params.nodes && params.nodes.length) {
        const drug = params.nodes[0];
        els.drugInput.value = drug;
        executeSearch(drug);
      }
    });
  }

  function highlightGraphDrug(drug) {
    if (!state.graphReady || !state.network || !drug) return;

    const selectedDrug = normalize(drug);
    const connectedNodeIds = new Set(state.network.getConnectedNodes(selectedDrug));
    const connectedEdgeIds = new Set(state.network.getConnectedEdges(selectedDrug));

    const nodeUpdates = state.drugs.map((nodeId) => {
      if (nodeId === selectedDrug) {
        return {
          id: nodeId,
          color: { background: COLORS.blue, border: COLORS.navy },
          font: { color: COLORS.white, size: 17 },
          shadow: { enabled: true, color: "rgba(0,79,159,.42)", size: 20, x: 0, y: 6 },
        };
      }

      if (connectedNodeIds.has(nodeId)) {
        const edge = state.relationships.find((row) =>
          (row.drug_a === selectedDrug && row.drug_b === nodeId) ||
          (row.drug_b === selectedDrug && row.drug_a === nodeId)
        );
        const danger = edge && isDanger(edge);
        return {
          id: nodeId,
          color: {
            background: danger ? COLORS.redSoft : COLORS.greenSoft,
            border: danger ? COLORS.red : COLORS.green,
          },
          font: { color: danger ? COLORS.red : COLORS.green, size: 15 },
        };
      }

      return {
        id: nodeId,
        color: { background: "#f1f5f9", border: "#d6dee9" },
        font: { color: "rgba(100,116,139,.45)", size: 14 },
        shadow: { enabled: false },
      };
    });

    const edgeUpdates = state.relationships.map((row) => {
      const connected = connectedEdgeIds.has(row.id);
      const danger = isDanger(row);
      return {
        id: row.id,
        hidden: !connected,
        width: connected ? (danger ? 4 : 2.6) : 1,
      };
    });

    state.nodes.update(nodeUpdates);
    state.edges.update(edgeUpdates);
    state.network.selectNodes([selectedDrug]);
    state.network.focus(selectedDrug, {
      scale: 1.2,
      animation: { duration: 600, easingFunction: "easeInOutQuad" },
    });
  }

  function resetGraphHighlight() {
    if (!state.graphReady) return;

    state.nodes.update(state.drugs.map((drug) => ({
      id: drug,
      color: {
        background: "#f8fbff",
        border: COLORS.blue,
        highlight: { background: COLORS.blue, border: COLORS.navy },
      },
      font: { color: "#142033", size: 15 },
      shadow: { enabled: true, color: "rgba(7,55,99,.16)", size: 12, x: 0, y: 4 },
    })));

    state.edges.update(state.relationships.map((row) => ({
      id: row.id,
      hidden: false,
      width: isDanger(row) ? 3 : 1.6,
    })));

    state.network.unselectAll();
    state.network.fit({ animation: { duration: 450, easingFunction: "easeInOutQuad" } });
  }

  function clearResults() {
    state.currentDrug = null;
    state.currentResults = [];
    els.drugInput.value = "";
    els.resultSection.classList.add("is-hidden");
    els.copyBtn.disabled = true;
    els.csvBtn.disabled = true;
    renderSuggestions("");
    resetGraphHighlight();
    els.drugInput.focus();
  }

  function copySummary() {
    if (!state.currentDrug || !state.currentResults.length) return;

    const dangerItems = state.currentResults.filter(isDanger);
    const safeItems = state.currentResults.filter(isSafe);
    const summary = [
      `BHH Cross Allergy Checker`,
      `Patient allergic drug: ${state.currentDrug}`,
      `DO NOT PRESCRIBE (${dangerItems.length}): ${dangerItems.map((x) => `${x.target_drug} [${displayCode(x)}]`).join(", ") || "-"}`,
      `CONSIDERED SAFE (${safeItems.length}): ${safeItems.map((x) => x.target_drug).join(", ") || "-"}`,
      `Clinical note: use as screening support only; verify allergy history and hospital policy before prescribing.`,
    ].join("\n");

    navigator.clipboard.writeText(summary)
      .then(() => showToast("คัดลอก summary แล้ว"))
      .catch(() => {
        window.prompt("Copy summary:", summary);
      });
  }

  function exportCsv() {
    if (!state.currentDrug || !state.currentResults.length) return;

    const header = ["selected_drug", "target_drug", "result", "result_code", "description"];
    const rows = state.currentResults.map((row) => [
      row.selected_drug,
      row.target_drug,
      displayCode(row),
      row.result_code,
      row.description || "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = createElement("a", {
      href: url,
      download: `cross-allergy-${state.currentDrug.toLowerCase()}.csv`,
    });

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("ดาวน์โหลด CSV แล้ว");
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function showPanel(view, shouldScroll = true) {
    document.querySelectorAll("[data-view-target]").forEach((button) => {
      if (!button.classList.contains("tab-button")) return;
      const active = button.dataset.viewTarget === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === `view-${view}`);
    });

    if (view === "graph" && state.graphReady) {
      window.setTimeout(() => state.network.redraw(), 50);
    }

    if (shouldScroll) {
      document.querySelector(".tabs-card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindEvents() {
    els.searchBtn.addEventListener("click", () => executeSearch());
    els.clearBtn.addEventListener("click", clearResults);
    els.copyBtn.addEventListener("click", copySummary);
    els.csvBtn.addEventListener("click", exportCsv);

    els.drugInput.addEventListener("input", (event) => {
      renderSuggestions(event.target.value);
    });

    els.drugInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        executeSearch();
      }
    });

    els.tableFilter.addEventListener("input", renderRelationshipTable);
    els.statusFilter.addEventListener("change", renderRelationshipTable);

    els.fitGraphBtn.addEventListener("click", () => {
      if (state.graphReady) state.network.fit({ animation: { duration: 450, easingFunction: "easeInOutQuad" } });
    });

    els.resetGraphBtn.addEventListener("click", resetGraphHighlight);

    document.querySelectorAll("[data-view-target]").forEach((button) => {
      button.addEventListener("click", () => showPanel(button.dataset.viewTarget));
    });

    document.querySelectorAll("[data-scroll-to]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.scrollTo;
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function init() {
    bindEvents();
    loadData();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
