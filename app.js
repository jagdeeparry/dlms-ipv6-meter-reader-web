const $ = (id) => document.getElementById(id);
const meterList = $("meter-list");
const form = $("reader-form");
const startButton = $("start-button");
const errorBox = $("form-error");
let activeDownloadUrl = null;

function parseMeters() {
  const defaultPort = Number($("port").value);
  return meterList.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length === 1) return { label: `Meter ${index + 1}`, ipv6: parts[0], port: defaultPort };
      if (parts.length === 2) return { label: parts[0] || `Meter ${index + 1}`, ipv6: parts[1], port: defaultPort };
      return { label: parts[0] || `Meter ${index + 1}`, ipv6: parts[1], port: Number(parts[2]) };
    });
}

function isIPv6(value) {
  const address = String(value || "").split("%", 1)[0];
  if (!address.includes(":") || !/^[0-9a-f:]+$/i.test(address)) return false;
  if ((address.match(/::/g) || []).length > 1) return false;
  const pieces = address.split(":");
  if (pieces.some((piece) => piece.length > 4)) return false;
  const nonEmpty = pieces.filter(Boolean).length;
  return address.includes("::") ? nonEmpty < 8 : nonEmpty === 8;
}

function validateMeters(meters) {
  if (!meters.length) throw new Error("Add at least one meter IPv6 address.");
  if (meters.length > 500) throw new Error("A batch can contain at most 500 meters.");
  const seen = new Set();
  for (const meter of meters) {
    if (!isIPv6(meter.ipv6)) throw new Error(`Invalid IPv6 address: ${meter.ipv6 || "(blank)"}`);
    if (!Number.isInteger(meter.port) || meter.port < 1 || meter.port > 65535) {
      throw new Error(`Invalid TCP port for ${meter.label}.`);
    }
    const identity = `${meter.ipv6.toLowerCase()}|${meter.port}`;
    if (seen.has(identity)) throw new Error(`Duplicate meter endpoint: [${meter.ipv6}]:${meter.port}`);
    seen.add(identity);
  }
}

function simulatedMeterNumber(meter) {
  const input = `${meter.ipv6}:${meter.port}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `SIM-${String(hash >>> 0).padStart(10, "0")}`;
}

function showError(message) {
  errorBox.textContent = message || "";
}

function updateRouteCount() {
  const unique = new Set(parseMeters().map((meter) => `${meter.ipv6.toLowerCase()}|${meter.port}`));
  $("route-count").textContent = unique.size;
}

function renderResults(results) {
  const container = $("results");
  if (!results.length) {
    container.className = "results-empty";
    container.textContent = "Results will appear here as each simulated meter completes.";
    return;
  }
  container.className = "";
  container.replaceChildren(...results.map((result) => {
    const row = document.createElement("div");
    row.className = "result-row success";
    const dot = document.createElement("span");
    dot.className = "result-dot";
    const route = document.createElement("div");
    route.className = "result-route";
    const label = document.createElement("strong");
    label.textContent = result.label;
    const address = document.createElement("small");
    address.textContent = `[${result.ipv6}]:${result.port}`;
    route.append(label, address);
    const value = document.createElement("span");
    value.className = "result-value";
    value.textContent = result.meterNumber;
    row.append(dot, route, value);
    return row;
  }));
}

function buildReport(results) {
  const now = new Date().toISOString();
  const lines = [
    "DLMS METER NUMBER BATCH RESULT",
    `Generated UTC: ${now}`,
    "Mode: HOSTED BROWSER SIMULATION",
    "Notice: No meter connection was attempted. Simulated values are not real meter numbers.",
    `Interface selection: ${$("interface-type").value}`,
    `COSEM object: ${$("object-type").value}`,
    `OBIS / attribute: ${$("obis-code").value.trim()} / ${$("attribute-index").value}`,
    `Summary: ${results.length} simulated, 0 failed, ${results.length} total`,
    "",
    "Label\tIPv6\tPort\tStatus\tSimulatedMeterNumber\tTimestampUTC",
    ...results.map((result) => [
      result.label,
      result.ipv6,
      result.port,
      "SIMULATED",
      result.meterNumber,
      result.timestamp,
    ].join("\t")),
  ];
  return `${lines.join("\n")}\n`;
}

function prepareDownload(results) {
  if (activeDownloadUrl) URL.revokeObjectURL(activeDownloadUrl);
  activeDownloadUrl = URL.createObjectURL(new Blob([buildReport(results)], { type: "text/plain;charset=utf-8" }));
  const link = $("download-button");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = activeDownloadUrl;
  link.download = `dlms-meter-simulation-${stamp}.txt`;
  link.classList.remove("hidden");
}

function resetStartButton() {
  startButton.disabled = false;
  startButton.querySelector("span").textContent = "Run browser simulation";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const meters = parseMeters();
  try {
    validateMeters(meters);
  } catch (error) {
    showError(error.message);
    return;
  }

  startButton.disabled = true;
  startButton.querySelector("span").textContent = "Running simulation…";
  $("download-button").classList.add("hidden");
  $("status-title").textContent = "Simulating meters";
  $("status-pill").textContent = "RUNNING";
  $("status-pill").className = "status-pill running";
  $("current-route").classList.add("active");
  const results = [];
  renderResults(results);

  for (const [index, meter] of meters.entries()) {
    $("current-route").querySelector("strong").textContent = `${meter.label} · [${meter.ipv6}]:${meter.port}`;
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    results.push({ ...meter, meterNumber: simulatedMeterNumber(meter), timestamp: new Date().toISOString() });
    const completed = index + 1;
    $("progress-bar").style.width = `${Math.round((completed / meters.length) * 100)}%`;
    $("metric-completed").textContent = `${completed}/${meters.length}`;
    $("metric-success").textContent = completed;
    $("metric-failed").textContent = "0";
    $("result-count").textContent = `${completed} ${completed === 1 ? "entry" : "entries"}`;
    renderResults(results);
  }

  $("status-title").textContent = "Simulation complete";
  $("status-pill").textContent = "COMPLETE";
  $("status-pill").className = "status-pill complete";
  $("current-route").classList.remove("active");
  $("current-route").querySelector("strong").textContent = "No live meter connections were attempted";
  prepareDownload(results);
  resetStartButton();
});

$("load-example").addEventListener("click", () => {
  meterList.value = "Meter 01,2001:db8:1200::101,4059\nMeter 02,2001:db8:1200::102\nMeter 03,2001:db8:1200::103";
  updateRouteCount();
});

meterList.addEventListener("input", updateRouteCount);
$("port").addEventListener("input", updateRouteCount);
window.addEventListener("beforeunload", () => {
  if (activeDownloadUrl) URL.revokeObjectURL(activeDownloadUrl);
});
updateRouteCount();
