
"use strict";

// ==========================================
// SafeBrowse — Frontend Application
// ==========================================

// DOM elements
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
const privacyChecks = document.getElementById("privacyChecks");
const cookieChecks = document.getElementById("cookieChecks");

const progressFill = document.getElementById("securityProgressFill");
const progressTrack = document.getElementById("securityProgressTrack");
const securityGrade = document.getElementById("securityGrade");
const privacyGrade = document.getElementById("privacyGrade");

const privacyProgressFill =
    document.getElementById("privacyProgressFill");
const privacyProgressTrack =
    document.getElementById("privacyProgressTrack");

const performanceProgressFill =
    document.getElementById("performanceProgressFill");
const performanceProgressTrack =
    document.getElementById("performanceProgressTrack");

const scanHistory = document.getElementById("scanHistory");
const historyMessage = document.getElementById("historyMessage");

const clearHistoryButton =
    document.getElementById("clearHistoryButton");
const exportHistoryButton =
    document.getElementById("exportHistoryButton");

// Configuration
const HISTORY_KEY = "safebrowse_scan_history";
const MAX_HISTORY = 10;
const API_URL = "http://127.0.0.1:8000/scan";

console.log("SafeBrowse JavaScript loaded");

// ==========================================
// General helpers
// ==========================================

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
        li.textContent = String(item);
        element.appendChild(li);
    });
}

function clampScore(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        return null;
    }

    return Math.max(0, Math.min(100, Number(value)));
}

function formatScore(value) {
    const score = clampScore(value);
    return score === null ? "--" : `${score}/100`;
}

function formatResponseTime(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
    ) {
        return "Response time: Unavailable";
    }

    return `Response time: ${Number(value)} ms`;
}

function getScoreColor(score) {
    if (score === null) return "#9ca3af";
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
}

function updateScoreCardStatus(scoreElement, score) {
    if (!scoreElement) return;

    const card = scoreElement.closest(".score-card");
    if (!card) return;

    card.classList.remove(
        "score-good",
        "score-moderate",
        "score-low",
        "score-unavailable"
    );

    if (score === null) {
        card.classList.add("score-unavailable");
    } else if (score >= 80) {
        card.classList.add("score-good");
    } else if (score >= 60) {
        card.classList.add("score-moderate");
    } else {
        card.classList.add("score-low");
    }
}

function updateProgressBar(element, score) {
    if (!element) return;

    element.style.width =
        score === null ? "0%" : `${score}%`;

    element.style.backgroundColor = getScoreColor(score);
}

function updateProgressAccessibility(track, score, label) {
    if (!track) return;

    track.setAttribute(
        "aria-valuenow",
        score === null ? "0" : String(score)
    );

    track.setAttribute(
        "aria-valuetext",
        score === null
            ? `${label} unavailable`
            : `${score} out of 100`
    );
}

// ==========================================
// Scan history: localStorage
// ==========================================

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

function saveScan(data) {
    const history = getScanHistory();

    const entry = {
        url: data.url,
        statusCode: data.status_code,

        securityScore: data.score,
        securityGrade: data.grade || "Unavailable",
        checks: Array.isArray(data.checks) ? data.checks : [],

        privacyScore: data.privacy_score ?? null,
        privacyGrade: data.privacy_grade || "Unavailable",
        privacyChecks: Array.isArray(data.privacy_checks)
            ? data.privacy_checks
            : [],

        performanceScore: data.performance_score ?? null,
        performanceGrade: data.performance_grade || "Unavailable",
        responseTime: data.response_time_ms ?? null,

        cookies: Array.isArray(data.cookies) ? data.cookies : [],

        scannedAt: new Date().toISOString()
    };

    // Keep the latest scan for each URL at the top.
    const updatedHistory = history.filter(function (item) {
        return item.url !== entry.url;
    });

    updatedHistory.unshift(entry);

    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(updatedHistory.slice(0, MAX_HISTORY))
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

// ==========================================
// Render recent scans
// ==========================================

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

            if (
                ["http:", "https:"].includes(parsed.protocol) &&
                parsed.hostname
            ) {
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
    cell.textContent = String(value);
    row.appendChild(cell);
}

// ==========================================
// Restore saved results
// ==========================================

function restoreScan(index) {
    const history = getScanHistory();
    const entry = history[index];

    if (!entry) return;

    if (urlInput) {
        urlInput.value = entry.url || "";
    }

    // Each function also updates its score-card color.
    updateSecurityScore(entry.securityScore, entry.securityGrade);

    updatePrivacyScore(entry.privacyScore, entry.privacyGrade);

    updatePerformance({
        performance_score: entry.performanceScore,
        performance_grade: entry.performanceGrade,
        response_time_ms: entry.responseTime
    });

    displaySecurityChecks(entry.checks || []);
    displayRecommendations(entry.checks || []);
    displayPrivacyChecks(entry.privacyChecks || []);
    displayCookieChecks(entry.cookies || []);

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

// ==========================================
// Clear history
// ==========================================

function clearScanHistory() {
    const history = getScanHistory();

    if (history.length === 0) {
        if (historyMessage) {
            historyMessage.textContent =
                "There is no scan history to clear.";
        }
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to clear all saved scan history?"
    );

    if (!confirmed) return;

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

// ==========================================
// Export history to CSV
// ==========================================

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

    const rows = history.map(function (scan) {
        return [
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
        ];
    });

    // Escape CSV values and mitigate spreadsheet formula injection.
    const csvContent = [headers, ...rows]
        .map(function (row) {
            return row.map(function (value) {
                let safeValue = String(value ?? "");

                if (/^[\t\r ]*[=+\-@]/.test(safeValue)) {
                    safeValue = "'" + safeValue;
                }

                safeValue = safeValue.replace(/"/g, '""');

                return `"${safeValue}"`;
            }).join(",");
        })
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "safebrowse-scan-history.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
        URL.revokeObjectURL(downloadUrl);
    }, 1000);

    if (historyMessage) {
        historyMessage.textContent =
            "Scan history exported successfully.";
    }
}

// ==========================================
// Security score
// ==========================================

function updateSecurityScore(score, grade) {
    const safeScore = clampScore(score);

    if (securityScore) {
        securityScore.textContent =
            safeScore === null ? "--" : safeScore;
    }

    if (securityGrade) {
        securityGrade.textContent =
            safeScore === null
                ? "Unavailable"
                : grade || "Score calculated";
    }

    updateProgressBar(progressFill, safeScore);
    updateScoreCardStatus(securityScore, safeScore);
    updateProgressAccessibility(progressTrack, safeScore, "Security score");
}

// ==========================================
// Privacy score
// ==========================================

function updatePrivacyScore(score, grade) {
    const safeScore = clampScore(score);

    if (privacyScore) {
        privacyScore.textContent =
            safeScore === null ? "--" : safeScore;
    }

    if (privacyGrade) {
        privacyGrade.textContent =
            safeScore === null
                ? "Unavailable"
                : grade || "Score calculated";
    }

    updateProgressBar(privacyProgressFill, safeScore);
    updateScoreCardStatus(privacyScore, safeScore);
    updateProgressAccessibility(
        privacyProgressTrack,
        safeScore,
        "Privacy score"
    );
}

// ==========================================
// Performance score
// ==========================================

function updatePerformance(data) {
    const score = clampScore(data.performance_score);
    const time = data.response_time_ms;

    const validTime =
        time !== null &&
        time !== undefined &&
        time !== "" &&
        Number.isFinite(Number(time)) &&
        Number(time) >= 0;

    if (performanceScore) {
        performanceScore.textContent =
            score === null ? "--" : score;
    }

    if (performanceGrade) {
        performanceGrade.textContent =
            score === null
                ? "Unavailable"
                : data.performance_grade || "Score calculated";
    }

    if (responseTime) {
        responseTime.textContent = formatResponseTime(
            validTime ? time : null
        );
    }

    updateProgressBar(performanceProgressFill, score);
    updateScoreCardStatus(performanceScore, score);
    updateProgressAccessibility(
        performanceProgressTrack,
        score,
        "Performance score"
    );
}

// ==========================================
// Display security checks
// ==========================================

function displaySecurityChecks(checks) {
    if (!securityChecks) return;

    securityChecks.replaceChildren();

    if (!Array.isArray(checks) || checks.length === 0) {
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
        details.textContent =
            `${check.name || "Security check"}: ` +
            `${check.details || "No details available."}`;

        li.append(badge, details);
        securityChecks.appendChild(li);
    });
}

// ==========================================
// Display recommendations
// ==========================================

function displayRecommendations(checks) {
    if (!Array.isArray(checks)) {
        displayList(recommendations, [
            "No recommendations are available."
        ]);
        return;
    }

    const missingChecks = checks.filter(function (check) {
        return check.status !== "pass";
    });

    const lines = missingChecks.map(function (check) {
        return `${check.name || "Security check"}: ` +
            `${check.recommendation || "Review this security setting."}`;
    });

    displayList(
        recommendations,
        lines.length > 0
            ? lines
            : ["No missing security headers were detected."]
    );
}

// ==========================================
// NEW: Display privacy checks
// ==========================================

function displayPrivacyChecks(checks) {
    if (!privacyChecks) return;

    privacyChecks.replaceChildren();

    if (!Array.isArray(checks) || checks.length === 0) {
        displayList(privacyChecks, [
            "No privacy check details were returned by the server."
        ]);
        return;
    }

    checks.forEach(function (check) {
        const li = document.createElement("li");
        li.classList.add("security-check-item");

        // A check that is not explicitly passed needs review.
        const passed = check.status === "pass";
        const notApplicable = check.status === "not_applicable";

        const badge = document.createElement("span");

        badge.classList.add(
            "status-badge",
            passed ? "status-pass" : "status-review"
        );

        badge.textContent = notApplicable
            ? "N/A"
            : passed
                ? "PASS"
                : "REVIEW";

        const details = document.createElement("span");
        details.classList.add("check-details");
        details.textContent =
            `${check.name || "Privacy check"}: ` +
            `${check.details || "No details available."}`;

        li.append(badge, details);
        privacyChecks.appendChild(li);
    });
}

// ==========================================
// NEW: Display cookie findings
// ==========================================

function displayCookieChecks(cookies) {
    if (!cookieChecks) return;

    cookieChecks.replaceChildren();

    if (!Array.isArray(cookies) || cookies.length === 0) {
        displayList(cookieChecks, [
            "No cookies were reported by the server. " +
            "This does not prove the website uses no cookies."
        ]);
        return;
    }

    cookies.forEach(function (cookie, index) {
        const li = document.createElement("li");
        li.classList.add("security-check-item");

        const details = document.createElement("span");
        details.classList.add("check-details");

        if (typeof cookie === "string") {
            // Support a backend that returns cookie findings as strings.
            details.textContent = cookie;
        } else if (cookie && typeof cookie === "object") {
            // Support structured cookie objects.
            const name = cookie.name || `Cookie ${index + 1}`;
            const flags = [];

            if (cookie.secure === true) {
                flags.push("Secure");
            }

            if (cookie.httponly === true) {
                flags.push("HttpOnly");
            }

            if (
                typeof cookie.samesite === "string" &&
                cookie.samesite.length > 0
            ) {
                flags.push(`SameSite=${cookie.samesite}`);
            }

            const reportedFlags = flags.length
                ? flags.join(", ")
                : "No recognized security flags reported";

            details.textContent = `${name}: ${reportedFlags}`;
        } else {
            details.textContent = `Cookie ${index + 1}: Unrecognized finding`;
        }

        li.appendChild(details);
        cookieChecks.appendChild(li);
    });
}

// ==========================================
// Reset dashboard while scanning
// ==========================================

function resetResults() {
    if (securityScore) securityScore.textContent = "--";
    if (privacyScore) privacyScore.textContent = "--";
    if (performanceScore) performanceScore.textContent = "--";

    if (performanceGrade) performanceGrade.textContent = "Scanning...";
    if (securityGrade) securityGrade.textContent = "Scanning...";
    if (privacyGrade) privacyGrade.textContent = "Scanning...";

    if (responseTime) {
        responseTime.textContent = "Response time: --";
    }

    updateProgressBar(progressFill, null);
    updateProgressBar(privacyProgressFill, null);
    updateProgressBar(performanceProgressFill, null);

    updateScoreCardStatus(securityScore, null);
    updateScoreCardStatus(privacyScore, null);
    updateScoreCardStatus(performanceScore, null);

    updateProgressAccessibility(progressTrack, null, "Security score");
    updateProgressAccessibility(
        privacyProgressTrack, null, "Privacy score"
    );
    updateProgressAccessibility(
        performanceProgressTrack, null, "Performance score"
    );

    displayList(securityChecks, [
        "Waiting for scan results..."
    ]);

    displayList(recommendations, [
        "Analyzing security configuration..."
    ]);

    displayList(privacyChecks, [
        "Analyzing privacy settings..."
    ]);

    displayList(cookieChecks, [
        "Checking reported cookie findings..."
    ]);
}

// ==========================================
// Failed scan handling
// ==========================================

function showScanFailure(error) {
    const message = error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    showMessage(`Scan failed: ${message}`);

    if (securityScore) securityScore.textContent = "--";
    if (privacyScore) privacyScore.textContent = "--";
    if (performanceScore) performanceScore.textContent = "--";

    if (securityGrade) securityGrade.textContent = "Scan failed";
    if (privacyGrade) privacyGrade.textContent = "Scan failed";
    if (performanceGrade) performanceGrade.textContent = "Scan failed";

    if (responseTime) {
        responseTime.textContent = "Response time: --";
    }

    updateProgressBar(progressFill, null);
    updateProgressBar(privacyProgressFill, null);
    updateProgressBar(performanceProgressFill, null);

    updateScoreCardStatus(securityScore, null);
    updateScoreCardStatus(privacyScore, null);
    updateScoreCardStatus(performanceScore, null);

    updateProgressAccessibility(progressTrack, null, "Security score");
    updateProgressAccessibility(
        privacyProgressTrack, null, "Privacy score"
    );
    updateProgressAccessibility(
        performanceProgressTrack, null, "Performance score"
    );

    displayList(securityChecks, [
        "No results available because the scan failed."
    ]);

    displayList(recommendations, [
        "Check the backend server and try again."
    ]);

    displayList(privacyChecks, [
        "Privacy checks are unavailable because the scan failed."
    ]);

    displayList(cookieChecks, [
        "Cookie findings are unavailable because the scan failed."
    ]);

    console.error("Scan error:", error);
}

// ==========================================
// Button event listeners
// ==========================================

if (clearHistoryButton) {
    clearHistoryButton.addEventListener(
        "click",
        clearScanHistory
    );
}

if (exportHistoryButton) {
    exportHistoryButton.addEventListener(
        "click",
        exportScanHistory
    );
}

// Render saved history when the page opens.
renderScanHistory();

// ==========================================
// Website scan form
// ==========================================

if (!form || !urlInput || !errorMessage || !scanButton) {
    console.error(
        "Required SafeBrowse HTML elements are missing."
    );
} else {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const url = urlInput.value.trim();

        // Validate URL format and protocol.
        let parsedUrl;

        try {
            parsedUrl = new URL(url);
        } catch {
            showMessage(
                "Enter a valid URL beginning with http:// or https://."
            );
            urlInput.focus();
            return;
        }

        if (
            !["http:", "https:"].includes(parsedUrl.protocol) ||
            !parsedUrl.hostname
        ) {
            showMessage(
                "Only valid HTTP and HTTPS website URLs are supported."
            );
            urlInput.focus();
            return;
        }

        showMessage(
            "Scanning website and checking security headers..."
        );

        scanButton.disabled = true;

        const buttonText = scanButton.querySelector("span");

        if (buttonText) {
            buttonText.textContent = "Scanning...";
        } else {
            scanButton.textContent = "Scanning...";
        }

        resetResults();

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            });

            let data;

            try {
                data = await response.json();
            } catch {
                throw new Error(
                    "The server returned an invalid response."
                );
            }

            if (!response.ok) {
                const message =
                    typeof data.detail === "string"
                        ? data.detail
                        : `Request failed with status ${response.status}.`;

                throw new Error(message);
            }

            if (
                data.score === null ||
                data.score === undefined ||
                !Number.isFinite(Number(data.score))
            ) {
                throw new Error(
                    "The server response did not include a valid security score."
                );
            }

            // Update all three score cards.
            updateSecurityScore(data.score, data.grade);

            updatePrivacyScore(
                data.privacy_score,
                data.privacy_grade
            );

            updatePerformance(data);

            // Render security checks and recommendations.
            const checks = Array.isArray(data.checks)
                ? data.checks
                : [];

            displaySecurityChecks(checks);
            displayRecommendations(checks);

            // Render the new privacy and cookie sections.
            displayPrivacyChecks(data.privacy_checks);
            displayCookieChecks(data.cookies);

            // Save results for later restoration.
            saveScan(data);

            showMessage(
                `Scan completed! ` +
                `Security: ${data.grade || "Unavailable"} | ` +
                `Privacy: ${data.privacy_grade || "Unavailable"} | ` +
                `Performance: ${data.performance_grade || "Unavailable"} | ` +
                `HTTP status: ${data.status_code ?? "Unknown"}.`
            );

            console.log("Full scan response:", data);

        } catch (error) {
            if (
                error instanceof TypeError &&
                /fetch/i.test(error.message)
            ) {
                showScanFailure(
                    new Error(
                        "Could not connect to the SafeBrowse backend. " +
                        "Make sure FastAPI is running at " +
                        "http://127.0.0.1:8000."
                    )
                );
            } else {
                showScanFailure(error);
            }

        } finally {
            scanButton.disabled = false;

            if (buttonText) {
                buttonText.textContent = "Scan website";
            } else {
                scanButton.textContent = "Scan website";
            }
        }
    });
}
