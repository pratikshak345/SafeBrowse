
import time
import socket
import ipaddress
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl


app = FastAPI(title="SafeBrowse API", version="1.0.0")


# Development configuration.
# Restrict origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    url: HttpUrl


def validate_public_url(url: str):
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            400, "Only HTTP and HTTPS URLs are supported."
        )

    host = parsed.hostname

    if not host:
        raise HTTPException(400, "Invalid website hostname.")

    if (
        host.lower() == "localhost"
        or host.lower().endswith(".localhost")
    ):
        raise HTTPException(
            400, "Local websites cannot be scanned."
        )

    try:
        addresses = socket.getaddrinfo(
            host,
            parsed.port or (
                443 if parsed.scheme == "https" else 80
            ),
        )

        ips = {
            ipaddress.ip_address(item[4][0])
            for item in addresses
        }

        if not ips or any(not ip.is_global for ip in ips):
            raise HTTPException(
                400,
                "Private or non-public website addresses are not allowed.",
            )

    except HTTPException:
        raise
    except (OSError, ValueError):
        raise HTTPException(
            400, "Could not resolve the website hostname."
        )

    return parsed


def make_check(name, passed, weight, details, recommendation):
    return {
        "name": name,
        "status": "pass" if passed else "fail",
        "weight": weight,
        "details": details,
        "recommendation": recommendation,
    }


def calculate_grade(score):
    if score >= 80:
        return "Good"
    elif score >= 60:
        return "Moderate"
    return "Needs Improvement"


def calculate_performance_score(response_time_ms):
    """Apply a simple project-specific response-time scoring rule."""
    if response_time_ms <= 500:
        return 100
    elif response_time_ms <= 1000:
        return 80
    elif response_time_ms <= 2000:
        return 60
    elif response_time_ms <= 4000:
        return 40
    return 20


@app.get("/")
def home():
    return {"message": "SafeBrowse API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/scan")
async def scan_website(request: ScanRequest):
    url = str(request.url)
    parsed = validate_public_url(url)

    # Measure the time spent making the HTTP request.
    start_time = time.perf_counter()

    try:
        # Do not automatically follow redirects.
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=False,
            verify=True,
            trust_env=False,
            headers={
                "User-Agent": "SafeBrowse-Scanner/1.0"
            },
        ) as client:
            response = await client.get(url)

    except httpx.TimeoutException:
        raise HTTPException(
            504, "The website took too long to respond."
        )
    except httpx.RequestError:
        raise HTTPException(
            502, "Could not connect securely to the target website."
        )

    response_time_ms = round(
        (time.perf_counter() - start_time) * 1000,
        2,
    )

    performance_score = calculate_performance_score(
        response_time_ms
    )
    performance_grade = calculate_grade(performance_score)

    headers = response.headers
    is_https = parsed.scheme == "https"

    # ---------------- SECURITY CHECKS ----------------

    csp_header = headers.get("content-security-policy", "")

    has_frame_protection = (
        "x-frame-options" in headers
        or "frame-ancestors" in csp_header.lower()
    )

    checks = [
        make_check(
            "HTTPS",
            is_https,
            20,
            (
                "The URL uses HTTPS."
                if is_https
                else "The URL uses unencrypted HTTP."
            ),
            "Use HTTPS with a valid TLS certificate.",
        ),
        make_check(
            "Strict-Transport-Security (HSTS)",
            is_https
            and "strict-transport-security" in headers,
            15,
            (
                "HSTS header detected."
                if "strict-transport-security" in headers
                else "HSTS header not detected."
            ),
            "Configure HSTS on HTTPS websites.",
        ),
        make_check(
            "Content-Security-Policy (CSP)",
            "content-security-policy" in headers,
            20,
            (
                "CSP header detected."
                if "content-security-policy" in headers
                else "CSP header not detected."
            ),
            "Configure a suitable Content-Security-Policy.",
        ),
        make_check(
            "X-Content-Type-Options",
            headers.get(
                "x-content-type-options", ""
            ).lower() == "nosniff",
            15,
            (
                "nosniff is configured."
                if headers.get(
                    "x-content-type-options", ""
                ).lower() == "nosniff"
                else "The expected nosniff value was not detected."
            ),
            "Set X-Content-Type-Options: nosniff.",
        ),
        make_check(
            "Frame protection",
            has_frame_protection,
            10,
            (
                "A common frame-protection header was detected."
                if has_frame_protection
                else (
                    "A common frame-protection header "
                    "was not detected."
                )
            ),
            "Configure X-Frame-Options or CSP frame-ancestors.",
        ),
        make_check(
            "Referrer-Policy",
            "referrer-policy" in headers,
            10,
            (
                "Referrer-Policy header detected."
                if "referrer-policy" in headers
                else "Referrer-Policy header not detected."
            ),
            "Choose an appropriate Referrer-Policy.",
        ),
        make_check(
            "Permissions-Policy",
            "permissions-policy" in headers,
            10,
            (
                "Permissions-Policy header detected."
                if "permissions-policy" in headers
                else "Permissions-Policy header not detected."
            ),
            (
                "Restrict browser features that the website "
                "does not need."
            ),
        ),
    ]

    score = sum(
        check["weight"]
        for check in checks
        if check["status"] == "pass"
    )
    grade = calculate_grade(score)

    # ---------------- COOKIE ANALYSIS ----------------

    cookies = headers.get_list("set-cookie")
    cookie_results = []

    for cookie in cookies:
        lower_cookie = cookie.lower()

        cookie_results.append({
            "secure": "secure" in lower_cookie,
            "httponly": "httponly" in lower_cookie,
            "samesite": "samesite=" in lower_cookie,
        })

    # ---------------- PRIVACY CHECKS ----------------

    has_referrer_policy = "referrer-policy" in headers

    if cookie_results:
        cookies_secure = (
            all(cookie["secure"] for cookie in cookie_results)
            if is_https
            else False
        )

        cookies_httponly = all(
            cookie["httponly"] for cookie in cookie_results
        )

        cookies_samesite = all(
            cookie["samesite"] for cookie in cookie_results
        )

        cookies_protected = (
            cookies_secure
            and cookies_httponly
            and cookies_samesite
        )

        cookie_details = (
            f"{sum(c['secure'] for c in cookie_results)} of "
            f"{len(cookie_results)} cookies have the Secure attribute; "
            f"{sum(c['httponly'] for c in cookie_results)} have "
            f"HttpOnly; "
            f"{sum(c['samesite'] for c in cookie_results)} have "
            f"SameSite."
        )

    else:
        cookies_protected = None
        cookie_details = "The response did not set any cookies."

    privacy_checks = [
        {
            "name": "HTTPS",
            "status": "pass" if is_https else "fail",
            "weight": 40,
            "details": (
                "The URL uses HTTPS."
                if is_https
                else "The URL uses unencrypted HTTP."
            ),
            "recommendation": (
                "Use HTTPS with a valid TLS certificate."
            ),
        },
        {
            "name": "Referrer-Policy",
            "status": (
                "pass" if has_referrer_policy else "fail"
            ),
            "weight": 30,
            "details": (
                "Referrer-Policy header detected."
                if has_referrer_policy
                else "Referrer-Policy header not detected."
            ),
            "recommendation": (
                "Configure an appropriate Referrer-Policy "
                "to control referrer information."
            ),
        },
        {
            "name": "Cookie attributes",
            "status": (
                "not_applicable"
                if cookies_protected is None
                else "pass" if cookies_protected else "fail"
            ),
            "weight": 30,
            "details": cookie_details,
            "recommendation": (
                "Review cookie attributes. Use Secure for HTTPS "
                "cookies, HttpOnly where JavaScript access is "
                "unnecessary, and an appropriate SameSite setting."
            ),
        },
    ]

    # Do not penalize websites that set no cookies.
    applicable_checks = [
        check
        for check in privacy_checks
        if check["status"] != "not_applicable"
    ]

    total_weight = sum(
        check["weight"] for check in applicable_checks
    )

    privacy_score = (
        round(
            100 * sum(
                check["weight"]
                for check in applicable_checks
                if check["status"] == "pass"
            ) / total_weight
        )
        if total_weight
        else 0
    )

    privacy_grade = calculate_grade(privacy_score)

    # ---------------- FINAL API RESPONSE ----------------

    return {
        "url": url,
        "status_code": response.status_code,

        "score": score,
        "grade": grade,
        "checks": checks,

        "privacy_score": privacy_score,
        "privacy_grade": privacy_grade,
        "privacy_checks": privacy_checks,

        "performance_score": performance_score,
        "performance_grade": performance_grade,
        "response_time_ms": response_time_ms,

        "cookies": cookie_results,
        "redirect_location": headers.get("location"),

        "note": (
            "This is a basic header assessment, not a complete "
            "security audit. Redirects are reported but not followed. "
            "Performance is estimated from HTTP request duration, "
            "not browser rendering or Core Web Vitals."
        ),
    }
