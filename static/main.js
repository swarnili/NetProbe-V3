/**
 * NETPROBE V3 — Frontend Controller
 * File location : static/main.js
 *
 * Responsibilities:
 *  - Clock, segmented buttons, slider, toggle
 *  - POST to /run_experiment  →  render results
 *  - Chart.js: line, bar, stability charts
 *  - History sidebar: fetch and reload past experiments
 *  - Downloads: PDF (jsPDF in-browser), JSON / TXT / CSV via Flask routes
 */

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
var currentMode       = "both";
var currentSize       = 10;
var currentIterations = 5;
var currentExpId      = null;
var currentExpData    = null;
var lineChartInst     = null;
var barChartInst      = null;
var stabilityInst     = null;

// ══════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════
function updateClock() {
  var now = new Date();
  var p   = function(n) { return String(n).padStart(2, "0"); };
  document.getElementById("liveClock").textContent =
    p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds());
}
setInterval(updateClock, 1000);
updateClock();

// ══════════════════════════════════════════
//  SEGMENTED BUTTONS
//  Attach individual listeners to each button
//  so clicking always fires regardless of
//  exactly where inside the button you click.
// ══════════════════════════════════════════
document.querySelectorAll("#modeGroup .seg-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll("#modeGroup .seg-btn").forEach(function(b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    currentMode = this.getAttribute("data-val");
  });
});

document.querySelectorAll("#sizeGroup .seg-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll("#sizeGroup .seg-btn").forEach(function(b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    currentSize = parseFloat(this.getAttribute("data-val"));
  });
});

// ══════════════════════════════════════════
//  ITERATIONS SLIDER
// ══════════════════════════════════════════
var slider    = document.getElementById("iterSlider");
var iterLabel = document.getElementById("iterLabel");

function updateSlider() {
  var pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty("--pct", pct + "%");
  iterLabel.textContent = slider.value;
  currentIterations = parseInt(slider.value);
}
slider.addEventListener("input", updateSlider);
updateSlider();

// ══════════════════════════════════════════
//  RUN BUTTON  →  POST to Flask /run_experiment
// ══════════════════════════════════════════
document.getElementById("runBtn").addEventListener("click", function() {
  var btn  = document.getElementById("runBtn");
  var pill = document.getElementById("statusPill");

  btn.disabled = true;
  document.getElementById("runBtnLabel").textContent = "PROCESSING…";
  pill.textContent = "● RUNNING";
  pill.className   = "status-pill running";

  fetch("/run_experiment", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data_size:  currentSize,
      iterations: currentIterations,
      mode:       currentMode,
      use_delay:  document.getElementById("delayToggle").checked
    })
  })
  .then(function(resp) {
    if (!resp.ok) throw new Error("Server error " + resp.status);
    return resp.json();
  })
  .then(function(data) {
    currentExpId   = data.id;
    currentExpData = data;
    renderResults(data);
    refreshHistory();
    pill.textContent = "● DONE";
    pill.className   = "status-pill done";
  })
  .catch(function(err) {
    alert("Experiment failed: " + err.message);
    pill.textContent = "● ERROR";
    pill.className   = "status-pill";
  })
  .finally(function() {
    btn.disabled = false;
    document.getElementById("runBtnLabel").textContent = "RUN EXPERIMENT";
  });
});

// ══════════════════════════════════════════
//  RENDER RESULTS
// ══════════════════════════════════════════
function renderResults(data) {
  var results = data.results;
  var normal  = results.normal;
  var vpn     = results.vpn;

  // Speed readout cards
  document.getElementById("normalAvg").textContent =
    normal ? normal.metrics.avg.toFixed(1) : "—";
  document.getElementById("vpnAvg").textContent =
    vpn ? vpn.metrics.avg.toFixed(1) : "—";

  // Real-world context box
  if (normal && vpn) {
    var deg = ((normal.metrics.avg - vpn.metrics.avg) / normal.metrics.avg * 100).toFixed(1);
    document.getElementById("realityText").textContent =
      "Simulated VPN penalty: " + deg + "% throughput reduction. " +
      "In this model, VPN adds AES-256 encryption cost + tunnel RTT per packet chunk. " +
      "Real-world VPN services (WireGuard, OpenVPN) typically reduce throughput by 10-40% on modern hardware.";
    document.getElementById("realityBox").style.display = "";
  }

  // Stats table
  if (normal || vpn) {
    var rows = [
      ["AVG SPEED (MB/s)", "avg"],
      ["MIN SPEED (MB/s)", "min"],
      ["MAX SPEED (MB/s)", "max"],
      ["STD DEVIATION",    "std_dev"],
      ["STABILITY / 100",  "stability_score"]
    ];
    document.getElementById("statsBody").innerHTML = rows.map(function(r) {
      return "<tr>" +
        "<td>" + r[0] + "</td>" +
        "<td class='accent-green'>" + (normal ? normal.metrics[r[1]] : "—") + "</td>" +
        "<td class='accent-pink'>"  + (vpn    ? vpn.metrics[r[1]]    : "—") + "</td>" +
        "</tr>";
    }).join("");
    document.getElementById("statsWrap").style.display = "";
  }

  // Charts
  renderLineChart(normal, vpn);
  renderBarChart(normal, vpn);

  if (normal && vpn) {
    renderStabilityChart(normal, vpn);
    document.getElementById("stabilityCard").style.display = "";
  }

  // Insights
  if (data.insights && data.insights.length) {
    document.getElementById("insightsList").innerHTML = data.insights.map(function(ins) {
      var cls = typeof ins === "object" ? (ins.cls || "") : "";
      var txt = typeof ins === "object" ? ins.text : ins;
      return "<li class='" + cls + "'>" + txt + "</li>";
    }).join("");
    document.getElementById("insightsSection").style.display = "";
  }

  // Run log
  renderRunLog(results);

  // Export buttons
  document.getElementById("downloadRow").style.display = "";
  document.getElementById("dlPdf").onclick  = function() { downloadPDF(data); };
  document.getElementById("dlJson").onclick = function() { window.location.href = "/download/" + currentExpId + "/json"; };
  document.getElementById("dlTxt").onclick  = function() { window.location.href = "/download/" + currentExpId + "/txt";  };
  document.getElementById("dlCsv").onclick  = function() { window.location.href = "/download/" + currentExpId + "/csv";  };
}

// ══════════════════════════════════════════
//  CHART.JS  — shared options
// ══════════════════════════════════════════
function chartOpts(yLabel, yMax) {
  return {
    responsive: true,
    animation:  { duration: 800 },
    plugins: {
      legend: {
        labels: { color: "#d0c8e8", font: { family: "Share Tech Mono", size: 11 } }
      }
    },
    scales: {
      x: {
        ticks: { color: "#6a6080", font: { family: "Share Tech Mono", size: 10 } },
        grid:  { color: "rgba(255,255,255,.04)" }
      },
      y: {
        max:   yMax,
        title: { display: true, text: yLabel, color: "#6a6080", font: { size: 10 } },
        ticks: { color: "#6a6080", font: { family: "Share Tech Mono", size: 10 } },
        grid:  { color: "rgba(255,255,255,.06)" }
      }
    }
  };
}

function renderLineChart(normal, vpn) {
  if (lineChartInst) lineChartInst.destroy();
  var ctx    = document.getElementById("lineChart").getContext("2d");
  var base   = normal || vpn;
  var labels = base.runs.map(function(r) { return "R" + r.run; });
  var datasets = [];
  if (normal) datasets.push({
    label: "Normal",
    data:  normal.runs.map(function(r) { return r.speed; }),
    borderColor: "#00ffb2", backgroundColor: "rgba(0,255,178,.08)",
    pointBackgroundColor: "#00ffb2", tension: .4, fill: true
  });
  if (vpn) datasets.push({
    label: "VPN",
    data:  vpn.runs.map(function(r) { return r.speed; }),
    borderColor: "#ff00cc", backgroundColor: "rgba(255,0,204,.08)",
    pointBackgroundColor: "#ff00cc", tension: .4, fill: true
  });
  lineChartInst = new Chart(ctx, {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: chartOpts("MB/s")
  });
}

function renderBarChart(normal, vpn) {
  if (barChartInst) barChartInst.destroy();
  var ctx = document.getElementById("barChart").getContext("2d");
  var labels = [], values = [], colors = [];
  if (normal) { labels.push("Normal"); values.push(normal.metrics.avg); colors.push("#00ffb2"); }
  if (vpn)    { labels.push("VPN");    values.push(vpn.metrics.avg);    colors.push("#ff00cc"); }
  barChartInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Avg Speed",
        data:  values,
        backgroundColor: colors.map(function(c) { return c + "44"; }),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: chartOpts("MB/s")
  });
}

function renderStabilityChart(normal, vpn) {
  if (stabilityInst) stabilityInst.destroy();
  var ctx = document.getElementById("stabilityChart").getContext("2d");
  stabilityInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Normal", "VPN"],
      datasets: [{
        label: "Stability Score",
        data:  [normal.metrics.stability_score, vpn.metrics.stability_score],
        backgroundColor: ["rgba(0,255,178,.25)", "rgba(255,0,204,.25)"],
        borderColor: ["#00ffb2", "#ff00cc"],
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: chartOpts("/ 100", 100)
  });
}

// ══════════════════════════════════════════
//  RUN LOG TABLE
// ══════════════════════════════════════════
function renderRunLog(results) {
  var modes = Object.keys(results);

  // Build header
  document.getElementById("runsHead").innerHTML =
    "<tr><th>RUN</th>" +
    modes.map(function(m) {
      var cls = m === "normal" ? "accent-green" : "accent-pink";
      return "<th class='" + cls + "'>" + m.toUpperCase() + " MB/s</th>" +
             "<th class='" + cls + "'>TIME (s)</th>";
    }).join("") +
    "</tr>";

  // Build body
  var maxRuns = Math.max.apply(null, modes.map(function(m) { return results[m].runs.length; }));
  document.getElementById("runsBody").innerHTML = Array.from({ length: maxRuns }, function(_, i) {
    return "<tr><td>R" + (i + 1) + "</td>" +
      modes.map(function(m) {
        var r = results[m].runs[i];
        return r
          ? "<td>" + r.speed.toFixed(4) + "</td><td>" + r.time_taken.toFixed(6) + "</td>"
          : "<td>—</td><td>—</td>";
      }).join("") +
      "</tr>";
  }).join("");

  document.getElementById("runsWrap").style.display = "";
}

// ══════════════════════════════════════════
//  HISTORY SIDEBAR
// ══════════════════════════════════════════
function refreshHistory() {
  fetch("/history")
    .then(function(r) { return r.json(); })
    .then(function(history) {
      var list = document.getElementById("historyList");
      if (!history.length) {
        list.innerHTML = "<div class='history-empty'>No experiments yet.</div>";
        return;
      }
      list.innerHTML = history.slice().reverse().map(function(exp) {
        return "<div class='history-item' onclick='loadExperiment(" + exp.id + ")'>" +
          "<div class='hi-id'>#" + exp.id + " — " + exp.config.mode.toUpperCase() + "</div>" +
          "<div class='hi-meta'>" + exp.timestamp + " | " + exp.config.data_size_mb + "MB × " + exp.config.iterations + "</div>" +
          "</div>";
      }).join("");
    })
    .catch(function(e) { console.error("History fetch failed:", e); });
}

function loadExperiment(id) {
  fetch("/history/" + id)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      currentExpId   = data.id;
      currentExpData = data;
      renderResults(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// Load history on page load
refreshHistory();

// ══════════════════════════════════════════
//  PDF EXPORT  (uses jsPDF loaded via CDN in HTML)
// ══════════════════════════════════════════
function downloadPDF(exp) {
  var doc    = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var W      = 210;
  var margin = 18;
  var y      = 0;

  // Helper: move cursor down
  function ln(n) { y += (n || 1) * 6; }

  // Helper: write text
  function text(str, x, size, style, rgb) {
    doc.setFontSize(size || 10);
    doc.setFont("helvetica", style || "normal");
    if (rgb) doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    else     doc.setTextColor(40, 40, 60);
    doc.text(str, x || margin, y);
  }

  // Helper: draw horizontal rule
  function rule() {
    doc.setDrawColor(60, 20, 80);
    doc.setLineWidth(.3);
    doc.line(margin, y, W - margin, y);
    ln();
  }

  // ── Dark header block ──
  doc.setFillColor(11, 11, 18);
  doc.rect(0, 0, W, 30, "F");
  y = 12;
  text("NETPROBE V3", margin, 18, "bold", [255, 0, 204]);
  text("Network Performance Analysis Report", margin + 62, 12, "normal", [180, 160, 210]);
  y = 25;
  text("Generated: " + exp.timestamp,    margin,          8, "normal", [100, 90, 130]);
  text("Experiment #" + exp.id,          W - margin - 32, 8, "normal", [100, 90, 130]);
  y = 36;

  // ── Config section ──
  rule();
  text("EXPERIMENT CONFIGURATION", margin, 11, "bold", [200, 100, 220]);
  ln();
  var cfg = exp.config;
  [
    ["Data Size",  cfg.data_size_mb + " MB"],
    ["Iterations", "" + cfg.iterations],
    ["Mode",       cfg.mode.toUpperCase()],
    ["Art. Delay", cfg.use_delay ? "Enabled" : "Disabled"],
    ["Model",      "TCP socket-based chunked transfer + VPN tunnel simulation"]
  ].forEach(function(row) {
    text(row[0] + ":", margin,      9, "bold",   [160, 120, 180]);
    text(row[1],       margin + 44, 9, "normal", [40, 40, 60]);
    ln();
  });

  // ── Results section ──
  ln(.5); rule();
  text("PERFORMANCE RESULTS", margin, 11, "bold", [200, 100, 220]);
  ln();

  Object.keys(exp.results).forEach(function(mode) {
    var d    = exp.results[mode];
    var mRgb = mode === "normal" ? [0, 180, 120] : [220, 0, 180];
    text(mode.toUpperCase() + " MODE", margin, 10, "bold", mRgb);
    ln(.8);
    [
      ["Avg Speed",     d.metrics.avg     + " MB/s"],
      ["Min Speed",     d.metrics.min     + " MB/s"],
      ["Max Speed",     d.metrics.max     + " MB/s"],
      ["Std Deviation", d.metrics.std_dev + " MB/s"],
      ["Stability",     d.metrics.stability_score + " / 100"]
    ].forEach(function(row) {
      text("  " + row[0] + ":", margin,      9, "normal", [100, 90, 130]);
      text(row[1],              margin + 50, 9, "bold",   [40, 40, 60]);
      ln();
    });
    ln(.3);
    text("  Run-by-Run:", margin, 8, "bold", [100, 90, 130]);
    ln(.8);
    d.runs.forEach(function(r) {
      if (y > 270) { doc.addPage(); y = 18; }
      text(
        "    Run " + r.run + ":  " + r.speed.toFixed(4) + " MB/s    " + r.time_taken.toFixed(6) + "s",
        margin, 8, "normal", [60, 60, 80]
      );
      ln(.9);
    });
    ln(.3);
  });

  // ── Insights section ──
  if (y > 240) { doc.addPage(); y = 18; }
  rule();
  text("AUTO-GENERATED INSIGHTS", margin, 11, "bold", [200, 100, 220]);
  ln();
  exp.insights.forEach(function(ins) {
    var txt     = typeof ins === "object" ? ins.text : ins;
    var wrapped = doc.splitTextToSize("• " + txt, W - margin * 2);
    wrapped.forEach(function(line) {
      if (y > 270) { doc.addPage(); y = 18; }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 50, 80);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 2;
  });

  // ── Disclaimer ──
  if (y > 255) { doc.addPage(); y = 18; }
  ln(); rule();
  text("DISCLAIMER", margin, 9, "bold", [150, 80, 150]);
  ln(.8);
  var disc =
    "Speeds shown are simulated on localhost loopback (in-memory throughput). " +
    "This does NOT represent real ISP bandwidth. " +
    "Real-world VPN overhead is typically 10-40%. " +
    "This simulation exaggerates latency effects for visualization and analysis purposes.";
  doc.splitTextToSize(disc, W - margin * 2).forEach(function(dl) {
    text(dl, margin, 7.5, "normal", [120, 100, 140]);
    ln(.9);
  });

  doc.save("NETPROBE_Report_Exp" + exp.id + ".pdf");
}