"""Credora API. Run with:  uvicorn app.main:app --reload  (from the backend folder)."""
import csv, hashlib, io, json, re, secrets, uuid, zipfile
from datetime import timedelta
from pathlib import Path

import segno
from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import checker, exports
from .core import (AUTO_APPROVE, FREE_MAIL, Application, Audit, Base, CertUpload, Certificate, Notice, College, Company, DataRequest,
                   Document, OfferCheck, Opportunity, ResetToken, Roster, Share, User, audit, check_pw,
                   current_user, decrypt, encrypt, engine, get_db, hash_pw, load_json, login_failed, login_guard,
                   login_ok, make_token, names_match, new_signing_key, now, ocr_text, password_problems,
                   read_upload, save_doc, sign, signature_ok, verified)
from .seed import seed

Base.metadata.create_all(engine)
seed()

app = FastAPI(title="Credora API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


STAFF_ROLES = {"staff": "Staff member", "dpo": "Department placement officer", "cpo": "College placement officer",
               "hod": "Head of department", "principal": "Principal"}
WHOLE_COLLEGE = {"cpo", "principal"}
REC_ROLES = ["Team member", "HR manager", "Hiring manager", "Head of HR", "Company admin"]
REC_UNIQUE = {"Head of HR", "Company admin"}
SHARE_FIELDS = ["Full name", "Roll number", "Department", "Batch", "CGPA", "College email", "Mobile number",
                "Date of birth", "Category", "Home address", "Résumé"]
STATES = ["Andhra Pradesh", "Bihar", "Delhi", "Gujarat", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
          "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal", "Other"]
EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
CIN_RE = re.compile(r"^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")
GST_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$")


def parse_cgpa(v):
    try:
        g = round(float(str(v).strip()), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "Enter your current CGPA, for example 8.2")
    if not 0 <= g <= 10:
        raise HTTPException(400, "CGPA must be between 0 and 10")
    return g


DIRECTORY = {c["code"]: c for c in load_json("tn_colleges.json")["colleges"]}


def link_waiting_students(db, col):
    """Students may sign up before their college does. Attach them once the college exists, and verify roster matches."""
    linked = verified_now = 0
    for st in db.query(User).filter(User.role == "student", User.college_code == col.code, User.status == "pending"):
        if st.college_id != col.id:
            st.college_id, linked = col.id, linked + 1
        row = db.query(Roster).filter(Roster.college_id == col.id, Roster.roll_no == st.roll_no).first()
        if row and not row.user_id and names_match(row.name, st.name):
            st.status, row.user_id = "verified", st.id
            st.department, st.batch = row.department, row.batch
            if st.cgpa is None:
                st.cgpa = row.cgpa
            row.cgpa = st.cgpa
            st.checks = (st.checks or []) + [chk("Found on the college roster", True, f"{col.name} added you to its student list.")]
            verified_now += 1
    return linked, verified_now


def chk(name, passed, detail):
    return {"name": name, "passed": passed, "detail": detail}


def user_out(u: User, db: Session):
    out = {k: getattr(u, k) for k in ("id", "role", "name", "email", "mobile", "status", "checks", "college_code", "college_name",
                                      "roll_no", "department", "batch", "state", "income", "category", "gender",
                                      "cgpa", "consent", "resume_status", "staff_role",
                                      "staff_depts", "pending_role", "designation")}
    out["staff_role_name"] = STAFF_ROLES.get(u.staff_role, "")
    col = db.get(College, u.college_id) if u.college_id else None
    out["college"] = {"id": col.id, "name": col.name, "code": col.code, "verified": col.verified,
                      "departments": col.departments, "batches": col.batches} if col else None
    co = db.get(Company, u.company_id) if u.company_id else None
    out["company"] = {"id": co.id, "name": co.name, "reg_no": co.reg_no, "domain": co.domain,
                      "verified": co.verified} if co else None
    return out


# ================================================================== meta + auth
@app.get("/api/meta")
def meta(db: Session = Depends(get_db)):
    return {"staff_roles": STAFF_ROLES, "recruiter_roles": REC_ROLES, "share_fields": SHARE_FIELDS, "states": STATES,
            "auto_approve": AUTO_APPROVE,
            "batches": sorted({b for c in db.query(College).all() for b in c.batches}) or ["2023-2027"]}


@app.post("/api/auth/register")
def register(p: dict = Body(...), db: Session = Depends(get_db)):
    role = p.get("role")
    name, email = (p.get("name") or "").strip(), (p.get("email") or "").strip().lower()
    mobile, pw = re.sub(r"\D", "", p.get("mobile") or ""), p.get("password") or ""
    if role not in ("student", "college", "recruiter"):
        raise HTTPException(400, "Choose a role")
    if len(name) < 2:
        raise HTTPException(400, "Enter your name")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    if len(mobile) != 10:
        raise HTTPException(400, "Enter a 10-digit mobile number")
    probs = password_problems(pw)
    if probs:
        raise HTTPException(400, "Password needs " + ", ".join(probs))
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "An account with this email already exists")
    domain = email.split("@")[1]
    u = User(role=role, name=name, email=email, mobile=mobile, pw_hash=hash_pw(pw))
    if role in ("student", "college"):
        code = (p.get("college_code") or "").strip().upper()
        if not code:
            raise HTTPException(400, "Enter your college code")
        u.college_code = code
        col = db.query(College).filter(College.code == code).first()
        u.college_id = col.id if col else None
        u.college_name = col.name if col else DIRECTORY[code]["name"] if code in DIRECTORY else (p.get("college_name") or "").strip()[:120]
        if not col and len(u.college_name) < 3:
            raise HTTPException(400, "Choose your college from the list, or enter its code and full name")
    if role == "student":
        u.roll_no = (p.get("roll_no") or "").strip().upper()
        u.department = (p.get("department") or "").strip()
        u.batch = (p.get("batch") or "").strip()
        if not u.roll_no or not u.department or not u.batch:
            raise HTTPException(400, "Enter your roll number, department and batch")
        u.cgpa = parse_cgpa(p.get("cgpa"))
    if role == "college" and domain in FREE_MAIL:
        raise HTTPException(400, "Use your official college email, not a personal address")
    if role == "recruiter":
        if domain in FREE_MAIL:
            raise HTTPException(400, "Use your work email, not a personal address")
        cname, reg = (p.get("company_name") or "").strip(), (p.get("reg_no") or "").strip().upper()
        if len(cname) < 2 or not reg:
            raise HTTPException(400, "Enter the company name and its CIN or GST number")
        if p.get("designation") not in REC_ROLES:
            raise HTTPException(400, "Choose your role in the company")
        co = db.query(Company).filter(Company.reg_no == reg).first()
        if not co:
            co = Company(name=cname, reg_no=reg, domain=domain)
            db.add(co)
            db.flush()
        u.company_id, u.designation = co.id, p["designation"]
    db.add(u)
    db.flush()
    audit(db, u.id, "register", role)
    db.commit()
    return {"token": make_token(u), "user": user_out(u, db)}


@app.post("/api/auth/login")
def login(p: dict = Body(...), db: Session = Depends(get_db)):
    email = (p.get("email") or "").strip().lower()
    login_guard(email)
    u = db.query(User).filter(User.email == email).first()
    if not u or not check_pw(u.pw_hash, p.get("password") or ""):
        login_failed(email)
        raise HTTPException(401, "Wrong email or password")
    login_ok(email)
    audit(db, u.id, "login")
    db.commit()
    return {"token": make_token(u), "user": user_out(u, db)}


@app.post("/api/auth/forgot")
def forgot(p: dict = Body(...), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == (p.get("email") or "").strip().lower()).first()
    out = {"message": "If an account exists for this email, a reset link has been sent."}
    if u:
        token = secrets.token_urlsafe(32)
        db.add(ResetToken(user_id=u.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                          expires=now() + timedelta(minutes=30)))
        audit(db, u.id, "password_reset_requested")
        db.commit()
        # The prototype has no mail server, so the one-time link is returned to the screen instead of emailed.
        out["demo_token"] = token
    return out


@app.post("/api/auth/reset")
def reset(p: dict = Body(...), db: Session = Depends(get_db)):
    h = hashlib.sha256((p.get("token") or "").encode()).hexdigest()
    t = db.query(ResetToken).filter(ResetToken.token_hash == h).first()
    if not t or t.used or t.expires < now():
        raise HTTPException(400, "This reset link is invalid or has expired")
    probs = password_problems(p.get("password") or "")
    if probs:
        raise HTTPException(400, "Password needs " + ", ".join(probs))
    u = db.get(User, t.user_id)
    u.pw_hash, t.used = hash_pw(p["password"]), True
    audit(db, u.id, "password_reset")
    db.commit()
    return {"message": "Password changed. You can log in now."}


@app.get("/api/me")
def me(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(u, db)


@app.patch("/api/profile")
def update_profile(p: dict = Body(...), u: User = Depends(current_user), db: Session = Depends(get_db)):
    if "name" in p and len(p["name"].strip()) >= 2:
        u.name = p["name"].strip()
    if "mobile" in p:
        m = re.sub(r"\D", "", p["mobile"])
        if len(m) != 10:
            raise HTTPException(400, "Enter a 10-digit mobile number")
        u.mobile = m
    if u.role == "student":
        for k in ("state", "category", "gender"):
            if k in p:
                setattr(u, k, str(p[k])[:40])
        if "income" in p:
            u.income = int(p["income"]) if str(p["income"]).strip().isdigit() else None
        if "cgpa" in p:
            u.cgpa = parse_cgpa(p["cgpa"])
            row = db.query(Roster).filter(Roster.user_id == u.id).first()
            if row:                       # keep the college's roster in step, so recruiters receive the current value
                row.cgpa = u.cgpa
            audit(db, u.id, "cgpa_updated", str(u.cgpa))
        if "consent" in p:
            u.consent = bool(p["consent"])
    if u.role == "college" and "staff_depts" in p and u.staff_role in ("staff", ""):
        col = db.get(College, u.college_id)
        u.staff_depts = [d for d in p["staff_depts"] if col and d in col.departments]
    audit(db, u.id, "profile_updated")
    db.commit()
    return user_out(u, db)


@app.post("/api/profile/password")
def change_password(p: dict = Body(...), u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not check_pw(u.pw_hash, p.get("current") or ""):
        raise HTTPException(400, "Current password is wrong")
    probs = password_problems(p.get("new") or "")
    if probs:
        raise HTTPException(400, "Password needs " + ", ".join(probs))
    u.pw_hash = hash_pw(p["new"])
    audit(db, u.id, "password_changed")
    db.commit()
    return {"message": "Password changed"}


# ================================================================== verification gate
@app.post("/api/verify/student")
async def verify_student(college_id_card: UploadFile = File(...), name: str = Form(""), college_code: str = Form(""),
                         roll_no: str = Form(""), u: User = Depends(current_user), db: Session = Depends(get_db)):
    if u.role != "student":
        raise HTTPException(403, "Only students use this step")
    if u.status == "verified":
        return user_out(u, db)
    # The student may correct a typo from sign-up before the checks run.
    if len(name.strip()) >= 2: u.name = name.strip()
    if college_code.strip(): u.college_code = college_code.strip().upper()
    if roll_no.strip(): u.roll_no = roll_no.strip().upper()
    id_data, id_mime = await read_upload(college_id_card)
    save_doc(db, u.id, "college_id", college_id_card.filename, id_data, id_mime)
    checks = [chk("College ID card", True, "Your ID card was accepted and stored encrypted.")]
    col = db.query(College).filter(College.code == u.college_code).first()
    cname = col.name if col else DIRECTORY.get(u.college_code, {}).get("name") or u.college_name or f"The college with code {u.college_code}"
    if not col:
        u.college_id, u.college_name = None, cname
    checks.append(chk("College is on Credora", True if col and col.verified else None,
                      f"{col.name} is a verified college." if col and col.verified
                      else f"{cname} has not joined Credora yet. Your account is saved. As soon as your placement cell registers, "
                           "you will appear on its list and your dashboard will open."))
    row = None
    if col:
        u.college_id = col.id
        row = db.query(Roster).filter(Roster.college_id == col.id, Roster.roll_no == u.roll_no).first()
    taken = bool(row and row.user_id and row.user_id != u.id)
    if col:
        checks.append(chk("Roll number on the college roster", (True if row and not taken else False if taken else None),
                          f"{u.roll_no} found in {row.department}, batch {row.batch}." if row and not taken
                          else "This roll number is already linked to another account." if taken
                          else "Not on the roster yet, so your college has been asked to confirm you."))
    name_ok = bool(row and names_match(row.name, u.name))
    if row and not taken:
        checks.append(chk("Name matches the college record", name_ok,
                          "Your name matches the roster entry." if name_ok
                          else f"The roster has a different name for {u.roll_no}. Correct your name and try again."))
    text = ocr_text(id_data, id_mime)
    if text and text.strip():
        hit = u.roll_no.lower() in text.lower() or any(t in text.lower() for t in u.name.lower().split() if len(t) > 2)
        checks.append(chk("ID card text", True if hit else None, "Your name or roll number was read from the ID card."
                          if hit else "Your name could not be read from the image, so the roster match was used instead."))
    if not (col and col.verified):
        u.status = "pending"
    elif taken or (row and not name_ok):
        u.status = "rejected"
    elif row:
        u.status, row.user_id = "verified", u.id
        u.department, u.batch = row.department, row.batch
        if u.cgpa is None:
            u.cgpa = row.cgpa
        row.cgpa = u.cgpa
        u.category = u.category or row.category
        for c in db.query(Certificate).filter(Certificate.roster_id == row.id):
            c.student_id = u.id
    else:
        u.status = "pending"
    u.checks = checks
    audit(db, u.id, "verification", u.status)
    db.commit()
    return user_out(u, db)


def apply_staff_role(db: Session, u: User, role: str, depts: list):
    """Give a staff member a role and move anyone who held it before back to Staff member."""
    demoted = []
    if role in WHOLE_COLLEGE or role == "hod":
        for other in db.query(User).filter(User.college_id == u.college_id, User.role == "college",
                                           User.staff_role == role, User.id != u.id):
            if role in WHOLE_COLLEGE or set(other.staff_depts) & set(depts):
                other.staff_role = "staff"
                demoted.append(other.name)
                audit(db, other.id, "role_revoked", f"{STAFF_ROLES[role]} passed to {u.name}")
    u.staff_role, u.staff_depts, u.pending_role = role, depts, None
    audit(db, u.id, "role_granted", STAFF_ROLES[role])
    return demoted


@app.post("/api/verify/college")
async def verify_college(staff_role: str = Form(...), depts: str = Form("[]"), college_name: str = Form(""),
                         batch: str = Form(""), staff_id: UploadFile = File(...), letter: UploadFile | None = File(None),
                         students: UploadFile | None = File(None),
                         u: User = Depends(current_user), db: Session = Depends(get_db)):
    if u.role != "college":
        raise HTTPException(403, "Only college staff use this step")
    if staff_role not in STAFF_ROLES:
        raise HTTPException(400, "Choose your role")
    sensitive = staff_role != "staff"
    if sensitive and not letter:
        raise HTTPException(400, f"Upload the college letter naming you as {STAFF_ROLES[staff_role]}")
    data, mime = await read_upload(staff_id)
    save_doc(db, u.id, "staff_id", staff_id.filename, data, mime)
    checks = [chk("Staff ID card", True, "Your staff ID was accepted and stored encrypted."),
              chk("Official email", True, f"{u.email.split('@')[1]} is not a personal email provider.")]
    col = db.query(College).filter(College.code == u.college_code).first()
    if col:
        checks.append(chk("College", True, f"{col.name} is already registered on Credora. You have joined it."))
    else:
        known = {c: d["name"] for c, d in DIRECTORY.items()}
        cname = known.get(u.college_code) or (college_name or u.college_name).strip()
        if len(cname) < 3:
            raise HTTPException(400, "Enter your college name")
        priv, pub = new_signing_key()
        col = College(code=u.college_code, name=cname, verified=True, departments=[], batches=[],
                      sign_private=priv, sign_public=pub)
        db.add(col)
        db.flush()
        checks.append(chk("College registered", True if u.college_code in known else None,
                          f"{cname} is registered with the code {col.code}. " +
                          ("The code is on the Tamil Nadu engineering colleges list." if u.college_code in known else
                           "Prototype note: the code is not on the bundled college list, so it was accepted without a registry check.")))
    u.college_id = col.id
    if students and students.filename:
        label = batch.strip()
        if not re.fullmatch(r"\d{4}-\d{4}", label):
            raise HTTPException(400, "Write the batch as start-end years, for example 2023-2027")
        rows = parse_roster(await students.read(), students.filename)
        col.batches = sorted(set(col.batches) | {label})
        added = sum(1 for rec in rows if upsert_roster(db, col, label, rec))
        checks.append(chk("Students imported", True, f"{added} students added to batch {label} across {len(col.departments)} departments."))
    db.flush()
    linked, auto = link_waiting_students(db, col)
    if linked:
        checks.append(chk("Students who signed up earlier", True if auto == linked else None,
                          f"{linked} student(s) had already signed up with your college code. {auto} matched your student list and are verified"
                          + (f"; {linked - auto} are waiting for you under Approvals." if linked - auto else ".")))
    if sensitive:
        ldata, lmime = await read_upload(letter)
        save_doc(db, u.id, "role_letter", letter.filename, ldata, lmime)
    mine = [d for d in json.loads(depts) if d in col.departments]
    demoted = apply_staff_role(db, u, staff_role, [] if staff_role in WHOLE_COLLEGE else mine)
    checks.append(chk(f"Role confirmed: {STAFF_ROLES[staff_role]}", True,
                      (f"{', '.join(demoted)} moved to Staff member. " if demoted else "") +
                      ("Letter received." if sensitive else "No letter needed for this role.")))
    u.status, u.checks = "verified", checks
    audit(db, u.id, "verification", u.status)
    db.commit()
    return user_out(u, db)


@app.post("/api/verify/recruiter")
async def verify_recruiter(document: UploadFile = File(...), u: User = Depends(current_user), db: Session = Depends(get_db)):
    if u.role != "recruiter":
        raise HTTPException(403, "Only recruiters use this step")
    data, mime = await read_upload(document)
    save_doc(db, u.id, "authorisation", document.filename, data, mime)
    co = db.get(Company, u.company_id)
    fmt = "CIN" if CIN_RE.match(co.reg_no) else "GSTIN" if GST_RE.match(co.reg_no) else None
    domain = u.email.split("@")[1]
    same_domain = not co.domain or co.domain == domain
    checks = [
        chk("Company document", True, "Your company ID or authorisation letter was accepted and stored encrypted."),
        chk("Work email domain", same_domain, f"{domain} is a company domain, not a personal email provider." if same_domain
            else f"Your email domain differs from the company's registered domain ({co.domain})."),
        chk("Registration number", True if fmt else None, f"{co.reg_no} is a valid {fmt} format." if fmt else
            "Prototype note: the number is not in CIN or GSTIN format, so it was accepted without a registry check."),
        chk("Fraud reports", True, "No fraud reports against this company on Credora."),
    ]
    ok = all(c["passed"] is not False for c in checks)
    if ok:
        co.verified, co.domain = True, co.domain or domain
        if u.designation in REC_UNIQUE:
            for other in db.query(User).filter(User.company_id == co.id, User.designation == u.designation, User.id != u.id):
                other.designation = "Team member"
    u.status, u.checks = ("verified" if ok else "rejected"), checks
    audit(db, u.id, "verification", u.status)
    db.commit()
    return user_out(u, db)


# ================================================================== role changes (profile settings)
@app.post("/api/profile/staff-role")
async def change_staff_role(new_role: str = Form(...), depts: str = Form("[]"), letter: UploadFile | None = File(None),
                            u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    if new_role not in STAFF_ROLES:
        raise HTTPException(400, "Choose a role")
    col = db.get(College, u.college_id)
    mine = [d for d in json.loads(depts) if d in col.departments]
    if new_role in ("dpo", "hod") and not mine:
        raise HTTPException(400, "Tick at least one department for this role")
    if new_role == "staff":
        apply_staff_role(db, u, "staff", mine)
        db.commit()
        return {"message": "You are now a Staff member.", "user": user_out(u, db)}
    if not letter:
        raise HTTPException(400, f"Upload a signed college letter naming you as {STAFF_ROLES[new_role]}")
    data, mime = await read_upload(letter)
    save_doc(db, u.id, "role_letter", letter.filename, data, mime)
    if AUTO_APPROVE:
        demoted = apply_staff_role(db, u, new_role, [] if new_role in WHOLE_COLLEGE else mine)
        msg = f"Letter verified. You are now {STAFF_ROLES[new_role]}."
        if demoted:
            msg += f" {', '.join(demoted)} moved to Staff member."
    else:
        u.pending_role = {"role": new_role, "depts": mine}
        msg = "Letter received. Your current role stays active until it is verified."
    db.commit()
    return {"message": msg, "user": user_out(u, db)}


@app.post("/api/profile/designation")
async def change_designation(designation: str = Form(...), letter: UploadFile | None = File(None),
                             u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    if designation not in REC_ROLES:
        raise HTTPException(400, "Choose a role")
    if designation != "Team member":
        if not letter:
            raise HTTPException(400, f"Upload a signed company letter naming you as {designation}")
        data, mime = await read_upload(letter)
        save_doc(db, u.id, "role_letter", letter.filename, data, mime)
    moved = []
    if designation in REC_UNIQUE:
        for other in db.query(User).filter(User.company_id == u.company_id, User.designation == designation, User.id != u.id):
            other.designation = "Team member"
            moved.append(other.name)
            audit(db, other.id, "role_revoked", f"{designation} passed to {u.name}")
    u.designation = designation
    audit(db, u.id, "role_granted", designation)
    db.commit()
    return {"message": f"You are now {designation}." + (f" {', '.join(moved)} moved to Team member." if moved else ""),
            "user": user_out(u, db)}


# ================================================================== student
def eligibility(u: User, o: Opportunity):
    c, why, need, ok = o.criteria or {}, [], [], True
    if "max_income" in c:
        if u.income is None: need.append("family income")
        elif u.income <= c["max_income"]: why.append(f"family income within ₹{c['max_income']:,}")
        else: ok = False
    if "min_cgpa" in c:
        if u.cgpa is None: need.append("CGPA")
        elif u.cgpa >= c["min_cgpa"]: why.append(f"CGPA {u.cgpa} meets the minimum {c['min_cgpa']}")
        else: ok = False
    if "departments" in c:
        if u.department in c["departments"]: why.append(f"open to {u.department}")
        else: ok = False
    for key, attr, label in (("gender", "gender", "gender"), ("categories", "category", "category"), ("states", "state", "home state")):
        if key in c:
            val = getattr(u, attr)
            if not val: need.append(label)
            elif val in c[key]: why.append(f"{label}: {val}")
            else: ok = False
    if not c:
        why.append("open to all students")
    return ("not_eligible" if not ok else "incomplete" if need else "eligible"), why, need


def opp_out(o: Opportunity, u: User = None, applied=frozenset()):
    d = {"id": o.id, "kind": o.kind, "title": o.title, "provider": o.provider, "amount": o.amount,
         "deadline": o.deadline, "description": o.description, "sample": o.sample, "verified_company": bool(o.company_id)}
    if u:
        d["match"], d["why"], d["need"] = eligibility(u, o)
        d["applied"] = o.id in applied
    return d


@app.get("/api/student/overview")
def student_overview(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    opps = db.query(Opportunity).all()
    apps = db.query(Application).filter(Application.user_id == u.id).count()
    shares = [s for s in db.query(Share).all() if u.id in s.student_ids]
    return {"eligible": sum(1 for o in opps if eligibility(u, o)[0] == "eligible"), "applications": apps,
            "certificates": db.query(Certificate).filter(Certificate.student_id == u.id).count(),
            "checks": db.query(OfferCheck).filter(OfferCheck.user_id == u.id).count(), "shares": len(shares),
            "announcements": [dict(n, company=db.get(Company, s.company_id).name, purpose=db.get(DataRequest, s.request_id).purpose)
                              for s in sorted(shares, key=lambda x: x.created, reverse=True) for n in notices_for(db, s.id, "college")][:5]}


@app.get("/api/student/opportunities")
def student_opps(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    applied = {a.opp_id for a in db.query(Application).filter(Application.user_id == u.id)}
    rank = {"eligible": 0, "incomplete": 1, "not_eligible": 2}
    out = [opp_out(o, u, applied) for o in db.query(Opportunity).order_by(Opportunity.deadline)]
    return sorted(out, key=lambda o: rank[o["match"]])


@app.post("/api/student/apply/{opp_id}")
def apply(opp_id: int, u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    o = db.get(Opportunity, opp_id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    if eligibility(u, o)[0] == "not_eligible":
        raise HTTPException(400, "You do not meet the eligibility rules for this opportunity")
    if db.query(Application).filter(Application.user_id == u.id, Application.opp_id == opp_id).first():
        raise HTTPException(400, "You have already applied")
    if o.company_id and u.resume_status != "verified":
        raise HTTPException(400, "Upload your résumé and have your college verify it before applying to companies")
    db.add(Application(user_id=u.id, opp_id=opp_id))
    audit(db, u.id, "applied", o.title)
    db.commit()
    return {"message": "Application submitted"}


@app.get("/api/student/applications")
def my_applications(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    out = []
    for a in db.query(Application).filter(Application.user_id == u.id).order_by(Application.created.desc()):
        o = db.get(Opportunity, a.opp_id)
        out.append({"id": a.id, "title": o.title, "provider": o.provider, "kind": o.kind, "status": a.status,
                    "date": a.created.strftime("%d %b %Y")})
    return out


@app.post("/api/student/check")
async def check_offer(text: str = Form(""), file: UploadFile | None = File(None),
                      u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    if file:
        data, mime = await read_upload(file)
        text = (text + "\n" + (ocr_text(data, mime) or "")).strip()
        if not text:
            raise HTTPException(400, "The file could not be read. Paste the text of the offer instead.")
    text = text.strip()[:6000]
    if not text:
        raise HTTPException(400, "Paste a message or link, or upload an image of the offer")
    result = checker.analyse(text, db)
    db.add(OfferCheck(user_id=u.id, text=text[:500], result=result))
    db.commit()
    return result


@app.get("/api/student/checks")
def my_checks(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    return [{"id": c.id, "text": c.text, "verdict": c.result["verdict"], "score": c.result["score"],
             "date": c.created.strftime("%d %b %Y")}
            for c in db.query(OfferCheck).filter(OfferCheck.user_id == u.id).order_by(OfferCheck.created.desc()).limit(8)]


def cert_out(c: Certificate):
    p = json.loads(c.payload)
    return {"id": c.id, **p}


@app.get("/api/student/certificates")
def my_certs(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    return [cert_out(c) for c in db.query(Certificate).filter(Certificate.student_id == u.id).order_by(Certificate.created.desc())]


@app.post("/api/student/cert-uploads")
async def upload_certificate(title: str = Form(...), kind: str = Form("Certificate"), issuer: str = Form(""),
                             file: UploadFile = File(...), u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    if len(title.strip()) < 3:
        raise HTTPException(400, "Enter the certificate title")
    data, mime = await read_upload(file)
    d = save_doc(db, u.id, "certificate_upload", file.filename, data, mime)
    db.add(CertUpload(student_id=u.id, college_id=u.college_id, title=title.strip()[:120], kind=kind.strip()[:40] or "Certificate",
                      issuer=issuer.strip()[:120], doc_id=d.id))
    audit(db, u.id, "certificate_uploaded", title.strip())
    db.commit()
    return {"message": "Uploaded. Your college will verify it."}


@app.get("/api/student/cert-uploads")
def my_cert_uploads(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    return [{"id": c.id, "title": c.title, "kind": c.kind, "issuer": c.issuer, "status": c.status, "cert_id": c.cert_id,
             "doc_id": c.doc_id, "date": c.created.strftime("%d %b %Y")}
            for c in db.query(CertUpload).filter(CertUpload.student_id == u.id).order_by(CertUpload.created.desc())]


@app.post("/api/student/resume")
async def upload_resume(file: UploadFile = File(...), u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    data, mime = await read_upload(file, pdf_only=True)
    d = save_doc(db, u.id, "resume", file.filename, data, mime)
    u.resume_doc, u.resume_status = d.id, "pending"
    audit(db, u.id, "resume_uploaded")
    db.commit()
    return user_out(u, db)


@app.get("/api/student/shares")
def my_shares(u: User = Depends(verified("student")), db: Session = Depends(get_db)):
    out = []
    for s in db.query(Share).order_by(Share.created.desc()):
        if u.id in s.student_ids:
            out.append({"company": db.get(Company, s.company_id).name, "fields": s.fields,
                        "purpose": db.get(DataRequest, s.request_id).purpose, "date": s.created.strftime("%d %b %Y"),
                        "notices": notices_for(db, s.id, "college")})
    return out


@app.get("/api/student/documents")
def my_docs(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": d.id, "kind": d.kind, "filename": d.filename, "date": d.created.strftime("%d %b %Y")}
            for d in db.query(Document).filter(Document.owner_id == u.id).order_by(Document.created.desc())]


@app.get("/api/documents/{doc_id}")
def get_doc(doc_id: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d or d.owner_id != u.id:
        raise HTTPException(404, "Document not found")
    return Response(decrypt(d.blob), media_type=d.mime, headers={"Content-Disposition": f'inline; filename="{d.filename}"'})


# ================================================================== college
def staff_scope(u: User, col: College):
    """Whole-college roles, and staff who ticked no department, see every department."""
    mine = [d for d in u.staff_depts if d in col.departments]
    return col.departments if u.staff_role in WHOLE_COLLEGE or not mine else mine


def can(u: User, action):
    """Every verified staff member may issue certificates and share data for the departments in their scope."""
    return True


def roster_out(r: Roster, db: Session):
    su = db.get(User, r.user_id) if r.user_id else None
    return {"id": r.id, "roll_no": r.roll_no, "name": r.name, "department": r.department, "batch": r.batch,
            "email": r.email, "phone": r.phone, "cgpa": r.cgpa, "dob": r.dob, "category": r.category,
            "address": r.address, "claimed": bool(su), "consent": bool(su and su.consent),
            "resume_status": su.resume_status if su else "none", "user_id": r.user_id}


@app.get("/api/college/overview")
def college_overview(batch: str = "", u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    batch = batch or (col.batches[-1] if col.batches else "")
    scope = staff_scope(u, col)
    rows = db.query(Roster).filter(Roster.college_id == col.id, Roster.batch == batch).all()
    users = {x.id: x for x in db.query(User).filter(User.college_id == col.id, User.role == "student")}
    depts = {d: {"name": d, "total": 0, "claimed": 0, "resumes": 0, "mine": d in scope} for d in col.departments}
    for r in rows:
        d = depts.setdefault(r.department, {"name": r.department, "total": 0, "claimed": 0, "resumes": 0, "mine": r.department in scope})
        d["total"] += 1
        su = users.get(r.user_id)
        if su:
            d["claimed"] += 1
            d["resumes"] += su.resume_status == "verified"
    return {"college": {"name": col.name, "code": col.code}, "batch": batch, "batches": col.batches,
            "departments": list(depts.values()), "scope": scope,
            "can_certify": can(u, "certify"), "can_share": can(u, "share"),
            "pending_students": db.query(User).filter(User.college_id == col.id, User.role == "student", User.status == "pending").count(),
            "pending_resumes": sum(1 for x in users.values() if x.resume_status == "pending" and x.department in scope),
            "pending_certs": db.query(CertUpload).filter(CertUpload.college_id == col.id, CertUpload.status == "pending").count(),
            "open_requests": db.query(DataRequest).filter(DataRequest.college_id == col.id, DataRequest.status == "open").count()}


@app.post("/api/college/batches")
def add_batch(p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    label = (p.get("label") or "").strip()
    if not re.fullmatch(r"\d{4}-\d{4}", label):
        raise HTTPException(400, "Write the batch as start-end years, for example 2024-2028")
    col = db.get(College, u.college_id)
    col.batches = sorted(set(col.batches) | {label})
    db.commit()
    return col.batches


@app.post("/api/college/departments")
def add_department(p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    name = (p.get("name") or "").strip()
    if len(name) < 2:
        raise HTTPException(400, "Enter the department name")
    col = db.get(College, u.college_id)
    col.departments = sorted(set(col.departments) | {name})
    if u.staff_role not in WHOLE_COLLEGE and p.get("mine"):
        u.staff_depts = sorted(set(u.staff_depts) | {name})
    db.commit()
    return col.departments


ALIASES = {"roll_no": ["roll_no", "roll no", "roll number", "rollno", "roll", "register number", "register no", "reg no", "regno", "usn", "enrollment no"],
           "name": ["name", "student name", "full name", "student"],
           "department": ["department", "dept", "branch", "course", "programme", "program"],
           "email": ["email", "college email", "email id", "mail"],
           "phone": ["phone", "mobile", "mobile number", "phone number", "contact"],
           "cgpa": ["cgpa", "gpa", "cpi"], "dob": ["dob", "date of birth", "birth date"],
           "category": ["category", "caste category"], "address": ["address", "home address"]}


def parse_roster(raw: bytes, filename: str):
    """Read a CSV or Excel sheet of students into dictionaries with our standard column names."""
    if (filename or "").lower().endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        try:
            ws = load_workbook(io.BytesIO(raw[:8_000_000]), read_only=True, data_only=True).active
            table = [["" if c is None else str(c).strip() for c in row] for row in ws.iter_rows(values_only=True)]
        except Exception:
            raise HTTPException(400, "The Excel file could not be read. Save it again as .xlsx or .csv.")
    else:
        text = raw[:8_000_000].decode("utf-8-sig", errors="replace")
        table = [[c.strip() for c in row] for row in csv.reader(io.StringIO(text))]
    table = [r for r in table if any(r)]
    if not table:
        raise HTTPException(400, "The file is empty")
    lookup = {a: key for key, names in ALIASES.items() for a in names}
    head = [lookup.get(re.sub(r"[_.]+", " ", h.lower()).strip()) for h in table[0]]
    if not {"roll_no", "name", "department"} <= set(head):
        raise HTTPException(400, "The file needs columns for roll number, name and department in its first row")
    return [{h: (row[i] if i < len(row) else "") for i, h in enumerate(head) if h} for row in table[1:]]


def upsert_roster(db, col, batch, rec):
    roll = (rec.get("roll_no") or "").strip().upper()
    name = (rec.get("name") or "").strip()
    dept = (rec.get("department") or "").strip()
    if not roll or not name or not dept:
        return False
    r = db.query(Roster).filter(Roster.college_id == col.id, Roster.roll_no == roll).first()
    if not r:
        r = Roster(college_id=col.id, roll_no=roll, batch=batch, department=dept, name=name)
        db.add(r)
    r.name, r.department, r.batch = name, dept, batch
    r.email, r.phone = (rec.get("email") or "").strip(), (rec.get("phone") or "").strip()
    r.dob, r.category, r.address = (rec.get("dob") or "").strip(), (rec.get("category") or "").strip(), (rec.get("address") or "").strip()
    try:
        r.cgpa = float(rec["cgpa"]) if str(rec.get("cgpa") or "").strip() else None
    except ValueError:
        r.cgpa = None
    if dept not in col.departments:
        col.departments = sorted(set(col.departments) | {dept})
    return True


@app.post("/api/college/roster")
def add_student(p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    if p.get("batch") not in col.batches:
        raise HTTPException(400, "Choose a batch")
    if p.get("department") not in staff_scope(u, col):
        raise HTTPException(403, "You can add students only to your own departments")
    if not upsert_roster(db, col, p["batch"], p):
        raise HTTPException(400, "Roll number, name and department are required")
    db.flush()
    link_waiting_students(db, col)
    audit(db, u.id, "roster_add", p.get("roll_no", ""))
    db.commit()
    return {"message": "Student saved"}


@app.post("/api/college/roster/upload")
async def upload_roster(batch: str = Form(...), file: UploadFile = File(...),
                        u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    if batch not in col.batches:
        raise HTTPException(400, "Choose a batch")
    scope, added, skipped = None if u.staff_role in WHOLE_COLLEGE or not u.staff_depts else set(u.staff_depts), 0, 0
    for rec in parse_roster(await file.read(), file.filename):
        if scope is not None and (rec.get("department") or "").strip() not in scope:
            skipped += 1
            continue
        if upsert_roster(db, col, batch, rec): added += 1
        else: skipped += 1
    db.flush()
    link_waiting_students(db, col)
    audit(db, u.id, "roster_upload", f"{added} rows, batch {batch}")
    db.commit()
    return {"added": added, "skipped": skipped}


@app.get("/api/college/roster")
def list_roster(batch: str = "", department: str = "", q: str = "", page: int = 1,
                u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    qry = db.query(Roster).filter(Roster.college_id == col.id, Roster.department.in_(staff_scope(u, col)))
    if batch: qry = qry.filter(Roster.batch == batch)
    if department: qry = qry.filter(Roster.department == department)
    if q: qry = qry.filter(Roster.name.ilike(f"%{q}%") | Roster.roll_no.ilike(f"%{q}%"))
    total = qry.count()
    rows = qry.order_by(Roster.roll_no).offset((max(page, 1) - 1) * 25).limit(25).all()
    return {"total": total, "page": page, "pages": max(1, -(-total // 25)), "rows": [roster_out(r, db) for r in rows]}


@app.get("/api/college/pending")
def pending(u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    scope = staff_scope(u, col)
    studs = db.query(User).filter(User.college_id == col.id, User.role == "student").all()
    return {"students": [{"id": s.id, "name": s.name, "roll_no": s.roll_no, "department": s.department, "batch": s.batch,
                          "email": s.email} for s in studs if s.status == "pending"],
            "resumes": [{"id": s.id, "name": s.name, "roll_no": s.roll_no, "department": s.department}
                        for s in studs if s.resume_status == "pending" and s.department in scope],
            "certificates": [{"id": c.id, "title": c.title, "kind": c.kind, "issuer": c.issuer, "name": st.name, "roll_no": st.roll_no,
                              "department": st.department}
                             for c in db.query(CertUpload).filter(CertUpload.college_id == col.id, CertUpload.status == "pending")
                             for st in [db.get(User, c.student_id)] if st.department in scope]}


def get_cert_upload(cid, u, db):
    c = db.get(CertUpload, cid)
    if not c or c.college_id != u.college_id:
        raise HTTPException(404, "Certificate not found")
    return c


@app.get("/api/college/cert-uploads/{cid}/file")
def cert_upload_file(cid: int, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    d = db.get(Document, get_cert_upload(cid, u, db).doc_id)
    return Response(decrypt(d.blob), media_type=d.mime)


@app.post("/api/college/cert-uploads/{cid}/{action}")
def decide_cert_upload(cid: int, action: str, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    c = get_cert_upload(cid, u, db)
    if c.status != "pending" or action not in ("approve", "reject"):
        raise HTTPException(404, "Request not found")
    if action == "reject":
        c.status = "rejected"
    else:
        col, st = db.get(College, u.college_id), db.get(User, c.student_id)
        row = db.query(Roster).filter(Roster.user_id == st.id).first()
        cid_new = "CRD-" + uuid.uuid4().hex[:10].upper()
        payload = json.dumps({"certificate_id": cid_new, "title": c.title, "kind": c.kind,
                              "details": ("Originally issued by " + c.issuer + ". " if c.issuer else "") +
                                         "Uploaded by the student and verified against the original by the college.",
                              "student_name": st.name, "roll_no": st.roll_no, "department": st.department, "batch": st.batch,
                              "college": col.name, "college_code": col.code,
                              "issued_by": f"{u.name}, {STAFF_ROLES[u.staff_role]}", "issued_on": now().strftime("%d %b %Y")},
                             sort_keys=True, ensure_ascii=False)
        db.add(Certificate(id=cid_new, college_id=col.id, student_id=st.id, roster_id=row.id, payload=payload,
                           signature=sign(col, payload), issued_by=u.id))
        c.status, c.cert_id = "verified", cid_new
    audit(db, u.id, f"certificate_upload_{action}", c.title)
    db.commit()
    return {"message": "Done"}


@app.post("/api/college/students/{sid}/{action}")
def decide_student(sid: int, action: str, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    s = db.get(User, sid)
    col = db.get(College, u.college_id)
    if not s or s.college_id != col.id or s.status != "pending" or action not in ("approve", "reject"):
        raise HTTPException(404, "Request not found")
    if action == "approve":
        if s.batch not in col.batches:
            col.batches = sorted(set(col.batches) | {s.batch})
        upsert_roster(db, col, s.batch, {"roll_no": s.roll_no, "name": s.name, "department": s.department, "email": s.email, "phone": s.mobile})
        db.flush()
        row = db.query(Roster).filter(Roster.college_id == col.id, Roster.roll_no == s.roll_no).first()
        row.user_id, s.status = s.id, "verified"
        s.checks = s.checks + [chk("Confirmed by the college", True, f"Approved by {u.name}.")]
    else:
        s.status = "rejected"
        s.checks = s.checks + [chk("Confirmed by the college", False, "Your college did not confirm this roll number.")]
    audit(db, u.id, f"student_{action}", s.roll_no)
    db.commit()
    return {"message": "Done"}


@app.get("/api/college/resumes/{sid}/file")
def resume_file(sid: int, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    s = db.get(User, sid)
    if not s or s.college_id != u.college_id or not s.resume_doc:
        raise HTTPException(404, "Résumé not found")
    d = db.get(Document, s.resume_doc)
    return Response(decrypt(d.blob), media_type="application/pdf")


@app.post("/api/college/resumes/{sid}/{action}")
def decide_resume(sid: int, action: str, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    s = db.get(User, sid)
    if not s or s.college_id != u.college_id or s.resume_status != "pending" or action not in ("approve", "reject"):
        raise HTTPException(404, "Request not found")
    s.resume_status = "verified" if action == "approve" else "rejected"
    audit(db, u.id, f"resume_{action}", s.roll_no)
    db.commit()
    return {"message": "Done"}


@app.post("/api/college/certificates")
def issue_cert(p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    if not can(u, "certify"):
        raise HTTPException(403, "Only a principal, head of department or college placement officer can issue certificates")
    col = db.get(College, u.college_id)
    r = db.get(Roster, p.get("roster_id") or 0)
    title = (p.get("title") or "").strip()
    if not r or r.college_id != col.id or r.department not in staff_scope(u, col):
        raise HTTPException(404, "Student not found in your departments")
    if len(title) < 3:
        raise HTTPException(400, "Enter the certificate title")
    cid = "CRD-" + uuid.uuid4().hex[:10].upper()
    payload = json.dumps({"certificate_id": cid, "title": title, "kind": p.get("kind") or "Certificate",
                          "details": (p.get("details") or "").strip()[:300], "student_name": r.name,
                          "roll_no": r.roll_no, "department": r.department, "batch": r.batch,
                          "college": col.name, "college_code": col.code, "issued_by": f"{u.name}, {STAFF_ROLES[u.staff_role]}",
                          "issued_on": now().strftime("%d %b %Y")}, sort_keys=True, ensure_ascii=False)
    db.add(Certificate(id=cid, college_id=col.id, student_id=r.user_id, roster_id=r.id, payload=payload,
                       signature=sign(col, payload), issued_by=u.id))
    audit(db, u.id, "certificate_issued", f"{cid} for {r.roll_no}")
    db.commit()
    return {"id": cid}


@app.get("/api/college/certificates")
def college_certs(u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    return [cert_out(c) for c in db.query(Certificate).filter(Certificate.college_id == u.college_id)
            .order_by(Certificate.created.desc()).limit(50)]


def notice_out(n: Notice, db: Session):
    a = db.get(User, n.author_id)
    org = db.get(Company, a.company_id).name if n.side == "recruiter" else db.get(College, a.college_id).name
    return {"id": n.id, "side": n.side, "author": a.name, "org": org, "body": n.body, "event_date": n.event_date,
            "date": n.created.strftime("%d %b %Y")}


def notices_for(db, share_id, side=None):
    q = db.query(Notice).filter(Notice.share_id == share_id)
    if side:
        q = q.filter(Notice.side == side)
    return [notice_out(n, db) for n in q.order_by(Notice.created.desc())]


def add_notice(db, share, u, side, p):
    body = (p.get("body") or "").strip()
    when = (p.get("event_date") or "").strip()
    if len(body) < 10:
        raise HTTPException(400, "Write the announcement, for example the rounds and when the first one is")
    if len(body) > 2000:
        raise HTTPException(400, "Keep the announcement under 2,000 characters")
    if when and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", when):
        raise HTTPException(400, "Choose a valid date")
    if re.search(r"(registration|processing|security|training|joining)\s*(fee|charge|deposit)", body.lower()):
        raise HTTPException(400, "Announcements cannot ask students for any fee")
    db.add(Notice(share_id=share.id, author_id=u.id, side=side, body=body, event_date=when))
    audit(db, u.id, "announcement", f"share {share.id} by {side}")
    db.commit()


def req_out(r: DataRequest, db: Session):
    return {"id": r.id, "company": db.get(Company, r.company_id).name, "recruiter": db.get(User, r.recruiter_id).name,
            "college": db.get(College, r.college_id).name, "purpose": r.purpose, "department": r.department,
            "batch": r.batch, "fields": r.fields, "status": r.status, "date": r.created.strftime("%d %b %Y"),
            "kind": r.kind, "amount": r.amount, "deadline": r.deadline, "description": r.description, "min_cgpa": r.min_cgpa}


@app.get("/api/college/requests")
def college_requests(u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    col = db.get(College, u.college_id)
    scope = staff_scope(u, col)
    rows = db.query(DataRequest).filter(DataRequest.college_id == col.id).order_by(DataRequest.created.desc()).all()
    out = []
    for r in rows:
        if r.department not in scope:
            continue
        d = req_out(r, db)
        sh = db.query(Share).filter(Share.request_id == r.id).first()
        d["students"] = len(sh.student_ids) if sh else 0
        d["notices"] = notices_for(db, sh.id) if sh else []
        out.append(d)
    return out


@app.post("/api/college/requests/{rid}/announce")
def college_announce(rid: int, p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    r, col = get_request(rid, u, db)
    sh = db.query(Share).filter(Share.request_id == r.id).first()
    if not sh:
        raise HTTPException(400, "Send the student details first, then announce the next steps")
    add_notice(db, sh, u, "college", p)
    return {"message": f"Announced to {len(sh.student_ids)} students."}


def field_value(f, r: Roster, su: User | None):
    return {"Full name": r.name, "Roll number": r.roll_no, "Department": r.department, "Batch": r.batch,
            "CGPA": str(r.cgpa) if r.cgpa is not None else str(su.cgpa) if su and su.cgpa is not None else "", "College email": r.email, "Mobile number": r.phone,
            "Date of birth": r.dob, "Category": r.category, "Home address": r.address,
            "Résumé": "Verified résumé attached" if su and su.resume_status == "verified" else ""}[f]


def get_request(rid, u, db):
    col = db.get(College, u.college_id)
    r = db.get(DataRequest, rid)
    if not r or r.college_id != col.id or r.department not in staff_scope(u, col):
        raise HTTPException(404, "Request not found")
    return r, col


@app.get("/api/college/requests/{rid}/candidates")
def candidates(rid: int, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    r, col = get_request(rid, u, db)
    out = []
    for row in db.query(Roster).filter(Roster.college_id == col.id, Roster.department == r.department,
                                       Roster.batch == r.batch).order_by(Roster.roll_no):
        su = db.get(User, row.user_id) if row.user_id else None
        missing = [f for f in r.fields if not field_value(f, row, su)]
        d = roster_out(row, db)
        d["missing"] = missing
        d["ready"] = bool(su) and su.consent and not missing
        out.append(d)
    return out


def precheck_share(r: DataRequest, col, roster_ids, fields, db):
    """The pre-send check: what goes out must match the request exactly, for verified, consenting students."""
    issues = []
    for f in r.fields:
        if f not in fields:
            issues.append({"level": "bad", "tag": "Missing", "text": f"{f} was requested but is not selected."})
    for f in fields:
        if f not in r.fields:
            issues.append({"level": "warn", "tag": "Not asked", "text": f"{f} was not requested. Remove it to protect student privacy."})
    rows = db.query(Roster).filter(Roster.id.in_(roster_ids or [0]), Roster.college_id == col.id,
                                   Roster.department == r.department, Roster.batch == r.batch).all()
    if not rows:
        issues.append({"level": "bad", "tag": "Students", "text": "Select at least one student."})
    unverified = no_consent = incomplete = 0
    for row in rows:
        su = db.get(User, row.user_id) if row.user_id else None
        if not su: unverified += 1
        elif not su.consent: no_consent += 1
        elif any(not field_value(f, row, su) for f in fields if f in r.fields): incomplete += 1
    if unverified:
        issues.append({"level": "bad", "tag": "Identity", "text": f"{unverified} selected student(s) have not verified their identity on Credora."})
    if no_consent:
        issues.append({"level": "bad", "tag": "Consent", "text": f"{no_consent} selected student(s) have switched off sharing with recruiters."})
    if incomplete:
        issues.append({"level": "bad", "tag": "Incomplete", "text": f"{incomplete} selected student(s) are missing one or more requested details."})
    passed = []
    if rows and not (unverified or no_consent or incomplete):
        passed.append({"level": "ok", "tag": "Complete", "text": f"All {len(rows)} selected students are verified, consenting and have every requested detail."})
    if not any(i["tag"] in ("Missing", "Not asked") for i in issues):
        passed.append({"level": "ok", "tag": "Match", "text": f"All {len(r.fields)} requested details are selected and nothing extra is included."})
    company = db.get(Company, r.company_id)
    passed.append({"level": "ok" if company.verified else "bad", "tag": "Recruiter",
                   "text": f"{company.name} is a verified company." if company.verified else f"{company.name} is not verified."})
    return rows, issues + passed, not any(i["level"] in ("bad", "warn") for i in issues) and company.verified


@app.post("/api/college/requests/{rid}/precheck")
def precheck(rid: int, p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    r, col = get_request(rid, u, db)
    _, issues, ready = precheck_share(r, col, p.get("roster_ids"), p.get("fields") or [], db)
    return {"issues": issues, "ready": ready and can(u, "share") and r.status == "open", "can_share": can(u, "share")}


@app.post("/api/college/requests/{rid}/send")
def send_share(rid: int, p: dict = Body(...), u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    if not can(u, "share"):
        raise HTTPException(403, "Only a placement officer or the principal can send student details")
    r, col = get_request(rid, u, db)
    if r.status != "open":
        raise HTTPException(400, "This request is already closed")
    rows, issues, ready = precheck_share(r, col, p.get("roster_ids"), p.get("fields") or [], db)
    if not ready:
        raise HTTPException(400, "The pre-send check did not pass: " + "; ".join(i["text"] for i in issues if i["level"] != "ok"))
    rows = sorted(rows, key=lambda x: x.roll_no)
    data = [{f: field_value(f, row, db.get(User, row.user_id)) for f in r.fields} for row in rows]
    db.add(Share(request_id=r.id, college_id=col.id, company_id=r.company_id, sent_by=u.id, fields=r.fields,
                 student_ids=[row.user_id for row in rows], blob=encrypt(json.dumps(data, ensure_ascii=False).encode())))
    r.status = "fulfilled"
    audit(db, u.id, "share_sent", f"request {r.id}: {len(rows)} students, {len(r.fields)} fields")
    db.commit()
    return {"message": f"Sent {len(r.fields)} details for {len(rows)} students."}


@app.post("/api/college/requests/{rid}/decline")
def decline(rid: int, u: User = Depends(verified("college")), db: Session = Depends(get_db)):
    r, _ = get_request(rid, u, db)
    r.status = "declined"
    audit(db, u.id, "request_declined", str(r.id))
    db.commit()
    return {"message": "Request declined"}


# ================================================================== recruiter
@app.get("/api/recruiter/overview")
def recruiter_overview(u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    opps = db.query(Opportunity).filter(Opportunity.company_id == u.company_id).order_by(Opportunity.created.desc()).all()
    counts = {o.id: db.query(Application).filter(Application.opp_id == o.id).count() for o in opps}
    return {"openings": [{**opp_out(o), "applicants": counts[o.id]} for o in opps],
            "applicants": sum(counts.values()),
            "requests": db.query(DataRequest).filter(DataRequest.company_id == u.company_id).count(),
            "shares": db.query(Share).filter(Share.company_id == u.company_id).count()}


@app.post("/api/recruiter/openings")
def post_opening(p: dict = Body(...), u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    title, desc = (p.get("title") or "").strip(), (p.get("description") or "").strip()
    if len(title) < 3 or p.get("kind") not in ("internship", "job"):
        raise HTTPException(400, "Enter a title and choose internship or job")
    if re.search(r"(registration|processing|security|training|joining)\s*(fee|charge|deposit)", (title + " " + desc).lower()):
        raise HTTPException(400, "Openings on Credora cannot ask students for any fee or deposit")
    crit = {}
    if p.get("min_cgpa"): crit["min_cgpa"] = float(p["min_cgpa"])
    if p.get("departments"): crit["departments"] = p["departments"]
    co = db.get(Company, u.company_id)
    db.add(Opportunity(kind=p["kind"], title=title, provider=co.name, company_id=co.id, amount=(p.get("amount") or "").strip(),
                       deadline=(p.get("deadline") or "").strip(), description=desc, criteria=crit))
    audit(db, u.id, "opening_posted", title)
    db.commit()
    return {"message": "Opening posted"}


@app.get("/api/recruiter/openings/{oid}/applicants")
def applicants(oid: int, u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    o = db.get(Opportunity, oid)
    if not o or o.company_id != u.company_id:
        raise HTTPException(404, "Opening not found")
    out = []
    for a in db.query(Application).filter(Application.opp_id == oid).order_by(Application.created.desc()):
        s = db.get(User, a.user_id)
        col = db.get(College, s.college_id)
        out.append({"application_id": a.id, "name": s.name, "college": col.name if col else "", "department": s.department,
                    "batch": s.batch, "cgpa": s.cgpa, "resume_status": s.resume_status, "status": a.status,
                    "certificates": db.query(Certificate).filter(Certificate.student_id == s.id).count(),
                    "date": a.created.strftime("%d %b %Y")})
    return {"opening": opp_out(o), "applicants": out}


@app.get("/api/recruiter/applications/{aid}/resume")
def applicant_resume(aid: int, u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    a = db.get(Application, aid)
    o = db.get(Opportunity, a.opp_id) if a else None
    s = db.get(User, a.user_id) if a else None
    if not o or o.company_id != u.company_id or not s.resume_doc or s.resume_status != "verified":
        raise HTTPException(404, "Verified résumé not available")
    audit(db, u.id, "resume_downloaded", f"application {aid}")
    db.commit()
    return Response(decrypt(db.get(Document, s.resume_doc).blob), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{s.roll_no}_resume.pdf"'})


@app.post("/api/recruiter/applications/{aid}/status")
def set_app_status(aid: int, p: dict = Body(...), u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    a = db.get(Application, aid)
    o = db.get(Opportunity, a.opp_id) if a else None
    if not o or o.company_id != u.company_id or p.get("status") not in ("Under review", "Shortlisted", "Not selected", "Selected"):
        raise HTTPException(404, "Application not found")
    a.status = p["status"]
    db.commit()
    return {"message": "Updated"}


@app.get("/api/recruiter/colleges")
def colleges(u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name, "departments": c.departments, "batches": c.batches}
            for c in db.query(College).filter(College.verified == True)]  # noqa: E712


@app.post("/api/recruiter/requests")
def create_request(p: dict = Body(...), u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    col = db.get(College, p.get("college_id") or 0)
    fields = [f for f in SHARE_FIELDS if f in (p.get("fields") or [])]
    if not col or p.get("department") not in col.departments or p.get("batch") not in col.batches:
        raise HTTPException(400, "Choose a college, department and batch")
    if p.get("kind") not in ("internship", "job") or len((p.get("purpose") or "").strip()) < 3:
        raise HTTPException(400, "Choose internship or job and give the opening a title")
    desc = (p.get("description") or "").strip()
    if len(desc) < 10:
        raise HTTPException(400, "Describe the opening so the college knows what it is for")
    if re.search(r"(registration|processing|security|training|joining)\s*(fee|charge|deposit)", (p["purpose"] + " " + desc).lower()):
        raise HTTPException(400, "Openings on Credora cannot ask students for any fee or deposit")
    if not fields:
        raise HTTPException(400, "Choose at least one student detail")
    db.add(DataRequest(company_id=u.company_id, recruiter_id=u.id, college_id=col.id, purpose=p["purpose"].strip(),
                       kind=p["kind"], amount=(p.get("amount") or "").strip(), deadline=(p.get("deadline") or "").strip(),
                       description=desc, min_cgpa=float(p["min_cgpa"]) if str(p.get("min_cgpa") or "").strip() else None,
                       department=p["department"], batch=p["batch"], fields=fields))
    audit(db, u.id, "data_requested", f"{col.name}: {', '.join(fields)}")
    db.commit()
    return {"message": "Request sent to the placement cell"}


@app.get("/api/recruiter/requests")
def my_requests(u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    out = []
    for r in db.query(DataRequest).filter(DataRequest.company_id == u.company_id).order_by(DataRequest.created.desc()):
        d = req_out(r, db)
        s = db.query(Share).filter(Share.request_id == r.id).first()
        d["share_id"], d["students"] = (s.id, len(s.student_ids)) if s else (None, 0)
        d["notices"] = notices_for(db, s.id, "recruiter") if s else []
        out.append(d)
    return out


def get_share(sid, u, db):
    s = db.get(Share, sid)
    if not s or s.company_id != u.company_id:
        raise HTTPException(404, "Not found")
    return s


@app.get("/api/recruiter/shares/{sid}")
def share_detail(sid: int, u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    s = get_share(sid, u, db)
    r = db.get(DataRequest, s.request_id)
    return {"id": s.id, "fields": s.fields, "rows": json.loads(decrypt(s.blob)), "college": db.get(College, s.college_id).name,
            "purpose": r.purpose, "date": s.created.strftime("%d %b %Y"), "has_resumes": "Résumé" in s.fields,
            "opening": req_out(r, db), "notices": notices_for(db, s.id, "recruiter")}


@app.post("/api/recruiter/shares/{sid}/announce")
def recruiter_announce(sid: int, p: dict = Body(...), u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    s = get_share(sid, u, db)
    add_notice(db, s, u, "recruiter", p)
    return {"message": f"Sent to the placement cell of {db.get(College, s.college_id).name}."}


def share_resumes(s: Share, db: Session):
    """(file name, PDF bytes) for every student in the share who has a verified résumé, in row order."""
    out = []
    for uid in s.student_ids:
        st = db.get(User, uid)
        if st and st.resume_doc and st.resume_status == "verified":
            out.append((f"{st.roll_no}_{re.sub(r'[^A-Za-z]+', '_', st.name)}.pdf", decrypt(db.get(Document, st.resume_doc).blob)))
        else:
            out.append(None)
    return out


@app.get("/api/recruiter/shares/{sid}/resume/{index}")
def share_resume(sid: int, index: int, u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    s = get_share(sid, u, db)
    files = share_resumes(s, db) if "Résumé" in s.fields else []
    if not 0 <= index < len(files) or not files[index]:
        raise HTTPException(404, "No résumé was shared for this student")
    audit(db, u.id, "resume_downloaded", f"share {s.id}, row {index + 1}")
    db.commit()
    return Response(files[index][1], media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{files[index][0]}"'})


@app.get("/api/recruiter/shares/{sid}/download")
def share_download(sid: int, format: str = "xlsx", u: User = Depends(verified("recruiter")), db: Session = Depends(get_db)):
    s = get_share(sid, u, db)
    r, col, co = db.get(DataRequest, s.request_id), db.get(College, s.college_id), db.get(Company, s.company_id)
    name = f"credora_{re.sub(r'[^a-z0-9]+', '_', col.name.lower())}_{s.id}"
    audit(db, u.id, "share_downloaded", f"share {s.id} as {format}")
    db.commit()
    meta = {"title": f"{col.name}: {r.department}, batch {r.batch}",
            "subtitle": f"Shared with {co.name} for: {r.purpose}. Sent on {s.created.strftime('%d %b %Y')}.",
            "watermark": f"Shared with {co.name}",
            "footer": f"Shared through Credora with {co.name}. Downloaded by {u.name}. Do not forward without consent."}
    rows = json.loads(decrypt(s.blob))
    resumes = [f for f in share_resumes(s, db) if f] if "Résumé" in s.fields else []
    if format == "zip":
        # One package: the details as PDF and Excel, plus every résumé as its own file.
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("student_details.pdf", exports.to_pdf(s.fields, rows, meta)[0])
            z.writestr("student_details.xlsx", exports.to_xlsx(s.fields, rows, meta)[0])
            for fname, data in resumes:
                z.writestr(f"resumes/{fname}", data)
        return Response(buf.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="{name}_full_package.zip"'})
    if format not in exports.FORMATS:
        raise HTTPException(400, "Choose pdf, xlsx, docx, csv or zip")
    data, mime, ext = exports.FORMATS[format](s.fields, rows, meta)
    if format == "pdf" and resumes:
        data = exports.append_pdfs(data, [d for _, d in resumes])   # the résumés follow the table, one after another
    return Response(data, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{name}.{ext}"'})


# ================================================================== public certificate check
@app.get("/api/public/college/{code}")
def college_lookup(code: str, db: Session = Depends(get_db)):
    code = code.strip().upper()
    col = db.query(College).filter(College.code == code).first()
    return {"found": bool(col), "listed": code in DIRECTORY, "name": col.name if col else DIRECTORY.get(code, {}).get("name", "")}


@app.get("/api/public/colleges")
def college_directory(db: Session = Depends(get_db)):
    """Every Tamil Nadu engineering college with its counselling code, plus any other college already on Credora."""
    reg = {c.code: c for c in db.query(College).all()}
    out = [{"code": c["code"], "name": c["name"], "district": c["district"], "registered": c["code"] in reg} for c in DIRECTORY.values()]
    out += [{"code": c.code, "name": c.name, "district": "", "registered": True} for c in reg.values() if c.code not in DIRECTORY]
    return sorted(out, key=lambda c: c["name"].lower())


@app.get("/api/public/roster-template.csv")
def roster_template():
    text = ("roll_no,name,department,email,phone,cgpa,dob,category,address\n"
            "23CS001,Student Name,Computer Science and Engineering,23cs001@college.example,9000000001,8.2,14/05/2005,General,City\n"
            "23IT001,Student Name,Information Technology,23it001@college.example,9000000002,7.6,02/11/2005,OBC,City\n")
    return Response(text, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="credora_students_template.csv"'})


@app.get("/api/public/verify/{cert_id}")
def verify_cert(cert_id: str, db: Session = Depends(get_db)):
    c = db.get(Certificate, cert_id.strip().upper())
    if not c:
        return {"found": False}
    col = db.get(College, c.college_id)
    return {"found": True, "valid": signature_ok(col, c.payload, c.signature), "certificate": cert_out(c),
            "college_verified": col.verified, "public_key": col.sign_public, "signature": c.signature}


@app.get("/api/public/qr/{cert_id}.svg")
def cert_qr(cert_id: str, origin: str = ""):
    if not re.fullmatch(r"https?://[\w.:\-]+", origin or ""):
        origin = "http://localhost:8000"
    buf = io.BytesIO()
    segno.make(f"{origin}/verify/{cert_id}", error="m").save(buf, kind="svg", scale=6, border=2, dark="#0F0067")
    return Response(buf.getvalue(), media_type="image/svg+xml")


# ================================================================== serve the built frontend (if present)
DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        f = (DIST / path).resolve()
        return FileResponse(f if path and f.is_file() and DIST in f.parents else DIST / "index.html")
