
const form = document.getElementById("scanForm");
const urlInput = document.getElementById("urlInput");
const errorMessage = document.getElementById("errorMessage");
const scanButton = document.getElementById("scanButton");

const securityScore = document.getElementById("securityScore");
const privacyScore = document.getElementById("privacyScore");
const performanceScore = document.getElementById("performanceScore");
const performanceGrade = document.getElementById("performanceGrade");
const responseTime = document.getElementById("responseTime");

const securityChecks = document.getElementById("securityChecks");
const recommendations = document.getElementById("recommendations");

const progressFill = document.getElementById("securityProgressFill");
const progressTrack = document.getElementById("securityProgressTrack");
const securityGrade = document.getElementById("securityGrade");
const privacyGrade = document.getElementById("privacyGrade");

const scanHistory = document.getElementById("scanHistory");
const historyMessage = document.getElementById("historyMessage");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const exportHistoryButton = document.getElementById("exportHistoryButton");

const HISTORY_KEY = "safebrowse_scan_history";
const MAX_HISTORY = 10;

console.log("SafeBrowse JavaScript loaded");

function showMessage(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

function displayList(element, items) {
    if (!element) return;

    element.replaceChildren();

    items.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        element.appendChild(li);
    });
}

function getScanHistory() {
    try {
        const saved = localStorage.getItem(HISTORY_KEY);
        const history = saved ? JSON.parse(saved) : [];

        return Array.isArray(history) ? history : [];
    } catch (error) {
        console.error("Could not read scan history:", error);
        return [];
    }
}

// Save full scan results for future restoration.
function saveScan(data) {
    const history = getScanHistory();

    const entry = {
        url: data.url,
        statusCode: data.status_code,
        securityScore: data.score,
        securityGrade: data.grade || "Unavailable",
        checks: Array.isArray(data.checks) ? data.checks : [],
        privacyScore: data.privacy_score,
        privacyGrade: data.privacy_grade || "Unavailable",
        privacyChecks: Array.isArray(data.privacy_checks)
            ? data.privacy_checks
            : [],
        performanceScore: data.performance_score,
        performanceGrade: data.performance_grade || "Unavailable",
        responseTime: data.response_time_ms,
        cookies: Array.isArray(data.cookies) ? data.cookies : [],
        scannedAt: new Date().toISOString()
    };

    history.unshift(entry);

    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history.slice(0, MAX_HISTORY))
        );

        renderScanHistory();
    } catch (error) {
        console.error("Could not save scan history:", error);

        if (historyMessage) {
            historyMessage.textContent =
                "Scan completed, but history could not be saved.";
        }
    }
}

function renderScanHistory() {
    if (!scanHistory) return;

    const history = getScanHistory();
    scanHistory.replaceChildren();

    if (history.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "No scans yet.";

        row.appendChild(cell);
        scanHistory.appendChild(row);

        if (historyMessage) {
            historyMessage.textContent =
                "Your recent website scans will appear here.";
        }

        return;
    }

    history.forEach(function (entry, index) {
        const row = document.createElement("tr");

        const websiteCell = document.createElement("td");
        const websiteLink = document.createElement("a");

        try {
            const parsed = new URL(entry.url);

            if (["http:", "https:"].includes(parsed.protocol)) {
                // Clicking the website name restores the saved results.
                websiteLink.href = "#results";
                websiteLink.textContent = parsed.hostname;
                websiteLink.addEventListener("click", function (event) {
                    event.preventDefault();
                    restoreScan(index);
                });
            } else {
                websiteLink.textContent = "Invalid URL";
            }
        } catch {
            websiteLink.textContent = "Invalid URL";
        }

        websiteCell.appendChild(websiteLink);
        row.appendChild(websiteCell);

        addHistoryCell(row, formatScore(entry.securityScore));
        addHistoryCell(row, formatScore(entry.privacyScore));
        addHistoryCell(row, formatScore(entry.performanceScore));

        const dateCell = document.createElement("td");
        const date = new Date(entry.scannedAt);

        dateCell.textContent = Number.isNaN(date.getTime())
            ? "Unknown"
            : date.toLocaleString();

        row.appendChild(dateCell);
        scanHistory.appendChild(row);
    });

    if (historyMessage) {
        historyMessage.textContent =
            `${history.length} recent scan(s) saved in this browser. ` +
            "Click a website name to view its saved results.";
    }
}

function addHistoryCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
}

function formatScore(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? `${Math.max(0, Math.min(100, value))}/100`
        : "--";
}

// Restore previously saved results without making a new request.
function restoreScan(index) {
    const history = getScanHistory();
    const entry = history[index];

    if (!entry) return;

    if (urlInput) {
        urlInput.value = entry.url || "";
    }

    updateSecurityScore(entry.securityScore, entry.securityGrade);

    updatePrivacyScore(entry.privacyScore, entry.privacyGrade);

    updatePerformance({
        performance_score: entry.performanceScore,
        performance_grade: entry.performanceGrade,
        response_time_ms: entry.responseTime
    });

    displaySecurityChecks(entry.checks || []);
    displayRecommendations(entry.checks || []);

    showMessage(
        `Showing saved results for ${entry.url}. ` +
        "This is a previous scan; no new scan was performed."
    );

    const resultsSection = document.getElementById("results");

    if (resultsSection) {
        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function clearScanHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
        renderScanHistory();

        if (historyMessage) {
            historyMessage.textContent = "Scan history cleared.";
        }
    } catch (error) {
        console.error("Could not clear history:", error);

        if (historyMessage) {
            historyMessage.textContent =
                "Could not clear history in this browser.";
        }
    }
}

// Export scan history to CSV.
function exportScanHistory() {
    const history = getScanHistory();

    if (history.length === 0) {
        if (historyMessage) {
            historyMessage.textContent =
                "No scan history available to export.";
        }
        return;
    }

    const headers = [
        "Website URL",
        "Security Score",
        "Security Grade",
        "Privacy Score",
        "Privacy Grade",
        "Performance Score",
        "Performance Grade",
        "Response Time (ms)",
        "HTTP Status",
        "Scan Time"
    ];

    const rows = history.map(scan => [
        scan.url,
        scan.securityScore,
        scan.securityGrade,
        scan.privacyScore,
        scan.privacyGrade,
        scan.performanceScore,
        scan.performanceGrade,
        scan.responseTime,
        scan.statusCode,
        scan.scannedAt
    ]);

    const csvContent = [headers, ...rows]
        .map(row =>
            row.map(value => {
                const safeValue = String(value ?? "").replace(/"/g, '""');
                return `"${safeValue}"`;
            }).join(",")
        )
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "safebrowse-scan-history.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Delay revoking the URL to allow the download to start.
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    if (historyMessage) {
        historyMessage.textContent =
            "Scan history exported successfully.";
    }
}

function updateSecurityScore(score, grade) {
    const numericScore = Number(score);

    if (
        score === null ||
        score === undefined ||
        score === "" ||
        !Number.isFinite(numericScore)
    ) {
        throw new Error("Invalid security score.");
    }

    const safeScore = Math.max(0, Math.min(100, numericScore));

    if (securityScore) securityScore.textContent = safeScore;

    if (progressFill) {
        progressFill.style.width = `${safeScore}%`;
        progressFill.style.backgroundColor =
            safeScore >= 80 ? "#34d399" :
            safeScore >= 60 ? "#fbbf24" : "#f87171";
    }

    if (progressTrack) {
        progressTrack.setAttribute("aria-valuenow", safeScore);
        progressTrack.setAttribute(
            "aria-valuetext",
            `${safeScore} out of 100`
        );
    }

    if (securityGrade) {
        securityGrade.textContent = grade || "Score calculated";
    }
}

function updatePrivacyScore(score, grade) {
    const numericScore = Number(score);

    if (
        score === null ||
        score === undefined ||
        score === "" ||
        !Number.isFinite(numericScore)
    ) {
        if (privacyScore) privacyScore.textContent = "--";
        if (privacyGrade) privacyGrade.textContent = "Unavailable";
        return;
    }

    if (privacyScore) {
        privacyScore.textContent = Math.max(
            0,
            Math.min(100, numericScore)
        );
    }

    if (privacyGrade) {
        privacyGrade.textContent = grade || "Score calculated";
    }
}

function updatePerformance(data) {
    const score = data.performance_score;
    const time = data.response_time_ms;

    const validScore =
        score !== null &&
        score !== undefined &&
        score !== "" &&
        Number.isFinite(Number(score));

    const validTime =
        time !== null &&
        time !== undefined &&
        time !== "" &&
        Number.isFinite(Number(time)) &&
        Number(time) >= 0;

    if (performanceScore) {
        performanceScore.textContent = validScore
            ? Math.max(0, Math.min(100, Number(score)))
            : "--";
    }

    if (performanceGrade) {
        performanceGrade.textContent = validScore
            ? data.performance_grade || "Score calculated"
            : "Unavailable";
    }

    if (responseTime) {
        responseTime.textContent = validTime
            ? `Response time: ${Number(time)} ms`
            : "Response time: Unavailable";
    }
}

function resetResults() {
    if (securityScore) securityScore.textContent = "--";
    if (privacyScore) privacyScore.textContent = "--";
    if (performanceScore) performanceScore.textContent = "--";

    if (performanceGrade) performanceGrade.textContent = "Scanning...";
    if (responseTime) responseTime.textContent = "Response time: --";
    if (progressFill) progressFill.style.width = "0%";

    if (progressTrack) {
        progressTrack.setAttribute("aria-valuenow", "0");
        progressTrack.setAttribute("aria-valuetext", "Waiting for scan");
    }

    if (securityGrade) securityGrade.textContent = "Scanning...";
    if (privacyGrade) privacyGrade.textContent = "Scanning...";

    displayList(securityChecks, ["Waiting for scan results..."]);
    displayList(recommendations, [
        "Analyzing security configuration..."
    ]);
}

function displaySecurityChecks(checks) {
    if (!securityChecks) return;

    securityChecks.replaceChildren();

    if (!checks.length) {
        displayList(securityChecks, [
            "No security checks returned by the server."
        ]);
        return;
    }

    checks.forEach(function (check) {
        const li = document.createElement("li");
        li.classList.add("security-check-item");

        const passed = check.status === "pass";

        const badge = document.createElement("span");
        badge.classList.add(
            "status-badge",
            passed ? "status-pass" : "status-review"
        );
        badge.textContent = passed ? "PASS" : "REVIEW";

        const details = document.createElement("span");
        details.classList.add("check-details");
        details.textContent = `${check.name}: ${check.details}`;

        li.append(badge, details);
        securityChecks.appendChild(li);
    });
}

function displayRecommendations(checks) {
    const missingChecks = checks.filter(
        check => check.status !== "pass"
    );

    const lines = missingChecks.map(
        check => `${check.name}: ${check.recommendation}`
    );

    displayList(
        recommendations,
        lines.length
            ? lines
            : ["No missing security headers were detected."]
    );
}

// Button events must be registered outside the scan form handler.
if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", clearScanHistory);
}

if (exportHistoryButton) {
    exportHistoryButton.addEventListener("click", exportScanHistory);
}

renderScanHistory();

if (!form || !urlInput || !errorMessage || !scanButton) {
    console.error("Required SafeBrowse HTML elements are missing.");
} else {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const url = urlInput.value.trim();

        try {
            const parsedUrl = new URL(url);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                throw new Error("Only HTTP and HTTPS URLs are supported.");
            }
        } catch {
            showMessage(
                "Enter a valid URL beginning with http:// or https://."
            );
            return;
        }

        showMessage("Scanning website. Please wait...");
        scanButton.disabled = true;
        scanButton.textContent = "Scanning...";
        resetResults();

        try {
            const response = await fetch(
                "http://127.0.0.1:8000/scan",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                const message =
                    typeof data.detail === "string"
                        ? data.detail
                        : `Request failed: ${response.status}`;

                throw new Error(message);
            }

            updateSecurityScore(data.score, data.grade);

            updatePrivacyScore(
                data.privacy_score,
                data.privacy_grade
            );

            updatePerformance(data);

            const checks = Array.isArray(data.checks)
                ? data.checks
                : [];

            displaySecurityChecks(checks);
            displayRecommendations(checks);
            saveScan(data);

            showMessage(
                `Scan completed. Security: ${data.grade}. ` +
                `Privacy: ${data.privacy_grade || "Unavailable"}. ` +
                `Performance: ${data.performance_grade || "Unavailable"}. ` +
                `HTTP status: ${data.status_code}.`
            );

            console.log("Full scan response:", data);

        } catch (error) {
            showMessage(`Scan failed: ${error.message}`);

            if (securityScore) securityScore.textContent = "--";
            if (privacyScore) privacyScore.textContent = "--";
            if (performanceScore) performanceScore.textContent = "--";

            if (progressFill) progressFill.style.width = "0%";

            if (securityGrade) securityGrade.textContent = "Scan failed";
            if (privacyGrade) privacyGrade.textContent = "Scan failed";
            if (performanceGrade) performanceGrade.textContent = "Scan failed";
            if (responseTime) responseTime.textContent = "Response time: --";

            displayList(securityChecks, [
                "No results available because the scan failed."
            ]);

            displayList(recommendations, [
                "Check the backend server and try again."
            ]);

            console.error("Scan error:", error);

        } finally {
            scanButton.disabled = false;
            scanButton.textContent = "Scan Website";
        }
    });
}
