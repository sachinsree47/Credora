"""Settings, database models, crypto helpers and auth dependencies."""
import base64, hashlib, io, json, os, re, secrets, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import serialization
from fastapi import Depends, HTTPException, Request, UploadFile
from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text,
                        create_engine)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
SECRETS_FILE = BASE / ".secrets.json"
# When True, uploaded role letters are accepted automatically so the demo can run without a reviewer.
AUTO_APPROVE = os.getenv("CREDORA_AUTO_APPROVE", "true").lower() == "true"
TOKEN_HOURS = 8
MAX_UPLOAD = 5 * 1024 * 1024
FREE_MAIL = {"gmail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com", "rediffmail.com",
             "protonmail.com", "icloud.com", "aol.com", "ymail.com", "live.com"}


def _load_secrets():
    if SECRETS_FILE.exists():
        return json.loads(SECRETS_FILE.read_text())
    s = {"jwt": secrets.token_urlsafe(48), "data_key": base64.b64encode(AESGCM.generate_key(256)).decode()}
    SECRETS_FILE.write_text(json.dumps(s))
    return s


_S = _load_secrets()
JWT_KEY = os.getenv("CREDORA_JWT_KEY", _S["jwt"])
DATA_KEY = base64.b64decode(_S["data_key"])

engine = create_engine(f"sqlite:///{BASE / 'credora.db'}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class College(Base):
    __tablename__ = "colleges"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    departments: Mapped[list] = mapped_column(JSON, default=list)
    batches: Mapped[list] = mapped_column(JSON, default=list)
    sign_private: Mapped[bytes] = mapped_column(LargeBinary)   # encrypted Ed25519 private key
    sign_public: Mapped[str] = mapped_column(String)           # base64 public key


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    reg_no: Mapped[str] = mapped_column(String, unique=True, index=True)
    domain: Mapped[str] = mapped_column(String, default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String)                  # student | college | recruiter
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    mobile: Mapped[str] = mapped_column(String, default="")
    pw_hash: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="unverified")  # unverified|pending|verified|rejected
    checks: Mapped[list] = mapped_column(JSON, default=list)
    created: Mapped[datetime] = mapped_column(DateTime, default=now)
    college_id: Mapped[int | None] = mapped_column(ForeignKey("colleges.id"), nullable=True)
    college_code: Mapped[str] = mapped_column(String, default="")
    college_name: Mapped[str] = mapped_column(String, default="")   # typed at sign-up when the college is new
    # student
    roll_no: Mapped[str] = mapped_column(String, default="")
    department: Mapped[str] = mapped_column(String, default="")
    batch: Mapped[str] = mapped_column(String, default="")
    state: Mapped[str] = mapped_column(String, default="")
    income: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[str] = mapped_column(String, default="")
    gender: Mapped[str] = mapped_column(String, default="")
    cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    aadhaar_last4: Mapped[str] = mapped_column(String, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=True)
    resume_doc: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_status: Mapped[str] = mapped_column(String, default="none")   # none|pending|verified|rejected
    # college staff
    staff_role: Mapped[str] = mapped_column(String, default="")
    staff_depts: Mapped[list] = mapped_column(JSON, default=list)
    pending_role: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # recruiter
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    designation: Mapped[str] = mapped_column(String, default="")


class Roster(Base):
    __tablename__ = "roster"
    id: Mapped[int] = mapped_column(primary_key=True)
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), index=True)
    batch: Mapped[str] = mapped_column(String, index=True)
    department: Mapped[str] = mapped_column(String, index=True)
    roll_no: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[str] = mapped_column(String, default="")
    cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    dob: Mapped[str] = mapped_column(String, default="")
    category: Mapped[str] = mapped_column(String, default="")
    address: Mapped[str] = mapped_column(String, default="")
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    mime: Mapped[str] = mapped_column(String)
    blob: Mapped[bytes] = mapped_column(LargeBinary)           # AES-256-GCM encrypted
    sha256: Mapped[str] = mapped_column(String)
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Opportunity(Base):
    __tablename__ = "opportunities"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String)                  # scholarship | internship | job
    title: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    amount: Mapped[str] = mapped_column(String, default="")
    deadline: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    criteria: Mapped[dict] = mapped_column(JSON, default=dict)
    sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    opp_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="Submitted")
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class OfferCheck(Base):
    __tablename__ = "offer_checks"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    result: Mapped[dict] = mapped_column(JSON)
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Certificate(Base):
    __tablename__ = "certificates"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("roster.id"))
    payload: Mapped[str] = mapped_column(Text)                 # canonical JSON that was signed
    signature: Mapped[str] = mapped_column(String)
    issued_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class DataRequest(Base):
    __tablename__ = "data_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), index=True)
    purpose: Mapped[str] = mapped_column(String)                   # the title of the opening
    kind: Mapped[str] = mapped_column(String, default="internship")  # internship | job
    amount: Mapped[str] = mapped_column(String, default="")
    deadline: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    min_cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    department: Mapped[str] = mapped_column(String)
    batch: Mapped[str] = mapped_column(String)
    fields: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="open")   # open | fulfilled | declined
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Share(Base):
    __tablename__ = "shares"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("data_requests.id"))
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    sent_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    fields: Mapped[list] = mapped_column(JSON)
    student_ids: Mapped[list] = mapped_column(JSON)
    blob: Mapped[bytes] = mapped_column(LargeBinary)           # encrypted JSON rows
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Notice(Base):
    """An announcement about what happens next: a recruiter tells the placement cell, the placement cell tells students."""
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    share_id: Mapped[int] = mapped_column(ForeignKey("shares.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    side: Mapped[str] = mapped_column(String)                  # recruiter | college
    body: Mapped[str] = mapped_column(Text)
    event_date: Mapped[str] = mapped_column(String, default="")
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class CertUpload(Base):
    """A certificate a student uploaded themselves, waiting for the college to verify and sign it."""
    __tablename__ = "cert_uploads"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String, default="Certificate")
    issuer: Mapped[str] = mapped_column(String, default="")
    doc_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    status: Mapped[str] = mapped_column(String, default="pending")   # pending | verified | rejected
    cert_id: Mapped[str] = mapped_column(String, default="")
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class Audit(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text, default="")
    created: Mapped[datetime] = mapped_column(DateTime, default=now)


class ResetToken(Base):
    __tablename__ = "reset_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String, index=True)
    expires: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


# ------------------------------------------------------------------ crypto
ph = PasswordHasher()


def hash_pw(pw):
    return ph.hash(pw)


def check_pw(h, pw):
    try:
        return ph.verify(h, pw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def password_problems(pw):
    out = []
    if len(pw) < 8: out.append("at least 8 characters")
    if not (re.search(r"[a-z]", pw) and re.search(r"[A-Z]", pw)): out.append("upper and lower case letters")
    if not re.search(r"\d", pw): out.append("a number")
    if not re.search(r"[^A-Za-z0-9]", pw): out.append("a symbol")
    return out


def encrypt(data: bytes) -> bytes:
    nonce = os.urandom(12)
    return nonce + AESGCM(DATA_KEY).encrypt(nonce, data, None)


def decrypt(blob: bytes) -> bytes:
    return AESGCM(DATA_KEY).decrypt(blob[:12], blob[12:], None)


def new_signing_key():
    key = Ed25519PrivateKey.generate()
    priv = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return encrypt(priv), base64.b64encode(pub).decode()


def sign(college: College, payload: str) -> str:
    key = Ed25519PrivateKey.from_private_bytes(decrypt(college.sign_private))
    return base64.b64encode(key.sign(payload.encode())).decode()


def signature_ok(college: College, payload: str, signature: str) -> bool:
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(college.sign_public)).verify(
            base64.b64decode(signature), payload.encode())
        return True
    except Exception:
        return False


# ------------------------------------------------------------------ uploads
MAGIC = {b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg", b"%PDF": "application/pdf"}


async def read_upload(f: UploadFile, pdf_only=False):
    data = await f.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(400, f"{f.filename} is larger than 5 MB")
    mime = next((m for sig, m in MAGIC.items() if data.startswith(sig)), None)
    if not mime or (pdf_only and mime != "application/pdf"):
        raise HTTPException(400, f"{f.filename} must be a {'PDF' if pdf_only else 'PNG, JPG or PDF'} file")
    return data, mime


def save_doc(db: Session, owner_id, kind, filename, data, mime):
    d = Document(owner_id=owner_id, kind=kind, filename=os.path.basename(filename or kind)[:120], mime=mime,
                 blob=encrypt(data), sha256=hashlib.sha256(data).hexdigest())
    db.add(d)
    db.flush()
    return d


def ocr_text(data: bytes, mime: str):
    """Best-effort OCR. Returns None when Tesseract is not installed or the file is not an image."""
    if not mime.startswith("image/"):
        return None
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)), timeout=15)
    except Exception:
        return None


# ------------------------------------------------------------------ auth
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def make_token(user: User):
    return jwt.encode({"sub": str(user.id), "exp": int(time.time()) + TOKEN_HOURS * 3600}, JWT_KEY, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.query_params.get("token", "")
    try:
        uid = int(jwt.decode(token, JWT_KEY, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Please log in again")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(401, "Please log in again")
    return user


def verified(role):
    """Dependency: the user must have this role AND have passed verification."""
    def dep(user: User = Depends(current_user)):
        if user.role != role:
            raise HTTPException(403, "This area is for a different role")
        if user.status != "verified":
            raise HTTPException(403, "Complete verification to open your dashboard")
        return user
    return dep


def audit(db: Session, user_id, action, detail=""):
    db.add(Audit(user_id=user_id, action=action, detail=detail))


_fails: dict[str, list] = {}


def login_guard(email):
    rec = _fails.get(email)
    if rec and rec[0] >= 5 and time.time() < rec[1]:
        raise HTTPException(429, "Too many wrong attempts. Try again in a few minutes.")


def login_failed(email):
    rec = _fails.setdefault(email, [0, 0])
    rec[0] += 1
    rec[1] = time.time() + 300


def login_ok(email):
    _fails.pop(email, None)


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", (s or "").lower()).split()


def names_match(a, b):
    ta, tb = set(norm(a)), set(norm(b))
    if not ta or not tb:
        return False
    full = {t for t in ta if len(t) > 1} & {t for t in tb if len(t) > 1}
    return len(full) >= 1 and len(ta & tb) / min(len(ta), len(tb)) >= 0.5


def load_json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))
