# SafeBrowse 🔒

**A Web Security, Privacy, and Performance Assessment Tool**

SafeBrowse is a web application that scans a website and presents basic security-header checks, privacy-related checks, and an estimate of HTTP response time in one dashboard.

## Features

- **Website Scanning:** Submit an HTTP or HTTPS URL for assessment.
- **Security Analysis:** Checks security headers such as HSTS, Content Security Policy (CSP), and X-Content-Type-Options.
- **Privacy Checks:** Examines HTTPS usage, Referrer-Policy, and available cookie security attributes.
- **Performance Estimate:** Measures HTTP request response time.
- **Security Recommendations:** Displays results and recommendations based on detected headers.
- **Recent Scan History:** Saves recent results in browser local storage.
- **Restore Results:** Reopen previously saved scan results without performing another scan.
- **CSV Export:** Download scan history for further analysis.
- **History Management:** Clear saved scan history.

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python, FastAPI
- **HTTP Requests:** HTTPX
- **Data Validation:** Pydantic
- **Storage:** Browser localStorage

## Project Structure

```text
SafeBrowse/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   └── main.py
└── README.md
```

## Run Locally

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd SafeBrowse
```

### 2. Install backend dependencies

```bash
cd backend
python -m pip install fastapi uvicorn httpx
```

### 3. Start the backend

```bash
python -m uvicorn main:app --reload
```

The API should be available at `http://127.0.0.1:8000`.

Interactive API documentation: `http://127.0.0.1:8000/docs`

### 4. Open the frontend

Open `frontend/index.html` using VS Code Live Server or another local web server.

Make sure the backend is running before scanning websites.

## Important Limitations

- SafeBrowse performs a basic assessment based on HTTP response headers; it is not a complete security audit.
- Its performance score is a project-specific estimate based on HTTP request duration, not a full browser performance measurement.
- Website responses and scores can change over time.
- Only scan websites you are authorized to assess.
- The backend is intended for local development until appropriate deployment security controls are added.

## Future Improvements

- Add more security-header checks.
- Improve URL validation and protection against server-side request forgery (SSRF).
- Add automated testing.
- Deploy the frontend and backend securely.
- Improve reporting and accessibility.

## Author

Developed as a student project to practise frontend development, REST APIs, website security checks, and data presentation.
