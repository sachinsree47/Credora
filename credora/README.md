# Credora

**Find real opportunities. Prove real credentials.**

Credora is a web platform that connects verified students, colleges and recruiters, so nobody has to trust an offer or a certificate blindly. Built for HackKumbh 2026 (theme: Tech for Humanity, track: Education).

## What works in this prototype

| Area | What you can do |
|---|---|
| Accounts | Register as student, college staff or recruiter. Live password strength meter, Argon2 password hashing, login lockout after 5 wrong attempts, one-time password reset links. |
| Verification gate | After the first login the dashboard is locked behind one short form. Students upload their college ID card and are matched with the college's student list; staff choose their role and upload a staff ID (plus a letter for sensitive roles); recruiters upload one company document. Each check is shown with its result. |
| New colleges | A staff member can register a college that is not on Credora yet: they name it at sign-up and import its students from a CSV or Excel file during verification. |
| Themes | Light and dark themes with a toggle on every page. The choice is remembered. |
| Student | Opportunities matched to profile, one-click applications and tracker, offer checker with a risk score and reasons, résumé upload, wallet of signed certificates with QR codes, upload of their own certificates for the college to verify and sign, CGPA given at sign-up and editable each semester in Profile settings, a record of every share of their data. |
| College | Batches and departments, add students one by one or by CSV or Excel, confirm students, verify résumés and the certificates students upload, issue Ed25519-signed certificates, placement cell that sends recruiters only the requested fields after an automatic pre-send check. |
| Recruiter | Post openings, review applicants, send a full opening (type, title, pay, closing date, minimum CGPA, description) to a college and request specific student details, open each student's résumé, download received details as PDF (résumés appended), Excel, Word or CSV, or as a full ZIP package (details plus every résumé), verify any certificate. |
| Roles | Role changes happen in Profile settings. Sensitive roles need a signed letter, and when a single-holder role passes to a new person the previous holder is moved back automatically. |
| Sign-up | Students and college staff pick their college from a searchable list of 466 Tamil Nadu engineering colleges with TNEA counselling codes (`backend/data/tn_colleges.json`, from Anna University's district-wise affiliated college lists). A student can sign up before the college has; the account waits and is linked, and verified against the student list, when the college registers. |
| Announcements | After receiving student details, the recruiter announces the rounds and first-round date to the placement cell, which passes it on (edited if needed) to the students concerned. |
| Public | Anyone can check a certificate at `/verify/<certificate id>` without an account. |

## Tech stack

- **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion, React Router, lucide icons
- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Security:** Argon2 (passwords), AES-256-GCM (stored documents and shared data), Ed25519 (certificate signatures), JWT sessions, role checks on every endpoint, audit log
- **Offer checker:** explainable rules, lookups against verified companies, and a small naive Bayes text classifier trained on `backend/data/scam_samples.json`
- **Exports:** openpyxl (Excel), python-docx (Word), reportlab (PDF)

## Run it

You need **Python 3.10 or newer**. Node.js is only needed if you want to change the frontend.

**Windows:** double-click `run.bat`
**macOS / Linux:** `./run.sh`

Then open <http://localhost:8000>. The first start creates the database and the sample data, which takes a few seconds.

Manual steps, if you prefer:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

### Changing the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, talks to the backend on port 8000
npm run build      # rebuilds frontend/dist, which the backend serves
```

`frontend/dist` is committed on purpose so the app runs with Python alone. Run `npm run build` after any frontend change.

### Start again with fresh data

Stop the server, delete `backend/credora.db`, and start it again.

## Demo accounts

Password for all three: `Demo@1234`

| Role | Email | Notes |
|---|---|---|
| Student | `kishan@student.example` | Verified, has 2 certificates and one application |
| College | `anita@sit.example` | College placement officer at Sample Institute of Technology (code `SIT-4471`) |
| Recruiter | `rohan@brightlane.example` | HR manager at Brightlane Systems, with an open request to the college |

A second staff account, `vikram@sit.example`, is a department placement officer for Cyber Security and Information Technology only.

Every department of the sample college has 8 verified students with résumés, so placement sharing can be tried for any department.

To show the verification gate, register a **new student** with college code `SIT-4471`, roll number `23CY020` and the name `Aditi Sharma` (this matches the sample roster). Any PNG, JPG or PDF works as the uploaded ID card.

To create **your own college**, register as College with any new code (for example `1128`), type the college name when asked, and upload a students file in the next step. A template is offered on that screen, and `backend/data/sample_batch_2024.csv` also works. Students can then register with that code and a roll number from the file.

## Suggested 3-minute demo

1. Landing page, then register as a student (`23CY020`, Aditi Sharma). Show the password meter.
2. The locked dashboard and the one-step verification. Upload an ID card, run the check and open the dashboard. Switch to the dark theme.
3. Check an offer: click "Try a sample scam" and show the verdict and reasons.
4. Log in as the college. Open Placement cell, tick a field that was not requested to show the block, fix it and send.
5. Issue a certificate, then open its verify page.
6. Log in as the recruiter. Open Student details, view the received data and download it as Excel or PDF.

## What is simulated

Be upfront about these when presenting.

- **All data is sample data:** the college, its 2,000 students, the company, the scholarships and the recognised-institution list are invented. Replace `backend/data/recognised_institutions.json` and `opportunities.json` with official data before any real use.
- **Role letters are accepted automatically.** The prototype checks that a letter was uploaded but nobody reads it. Set the environment variable `CREDORA_AUTO_APPROVE=false` to hold role changes as pending instead; a reviewer screen is not built yet.
- **Document checks are basic.** Students are verified by matching roll number and name against the college roster; the uploaded ID card is stored but only read by OCR if Tesseract is installed. A student who is not on the roster waits for the college to confirm them. There is no face matching, tamper detection or DigiLocker link yet.
- **Any college can be registered.** A new college code is accepted without checking a government registry, and the result screen says so.
- **Company verification** checks the email domain and notes whether the registration number looks like a CIN or GSTIN. It does not query the government registry, and a number in another format is still accepted.
- **No email is sent.** The password reset link is shown on screen instead.
- **The offer checker** is trained on about 50 hand-written examples. It demonstrates the approach and is not accurate enough for real decisions.

## Project layout

```
backend/
  app/core.py       settings, database models, encryption, signing, login helpers
  app/main.py       every API route
  app/checker.py    offer checker (rules + classifier)
  app/exports.py    PDF, Excel, Word and CSV exports
  app/seed.py       sample data
  data/             sample datasets and a sample CSV for batch upload
frontend/
  src/pages/        Landing, Auth, Gate, Shell, Student, College, Recruiter, Profile, VerifyCert
  src/ui.jsx        shared animated components
  src/api.jsx       API client and login state
```

Interactive API documentation is at <http://localhost:8000/docs> while the server runs.

## Push to GitHub

```bash
git init
git add .
git commit -m "Credora prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/credora.git
git push -u origin main
```

`.gitignore` already keeps the database, the generated secret keys and `node_modules` out of the repository.
