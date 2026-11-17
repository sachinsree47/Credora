"""Offer checker: explainable rules + registry lookups + a small naive Bayes text classifier."""
import math, re
from collections import Counter

from .core import FREE_MAIL, Company, load_json

URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"')]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|xyz|top|info|online|site|club|click|live|shop|co)\b[^\s]*", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
MONEY_RE = re.compile(r"(?:₹|rs\.?|inr)\s?[\d,]+", re.I)
BAD_TLDS = {"xyz", "top", "click", "club", "online", "site", "live", "shop", "info", "buzz", "icu", "tk", "ml"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "cutt.ly", "rb.gy", "is.gd", "shorturl.at", "goo.gl"}
BRANDS = ["infosys", "wipro", "tcs", "amazon", "google", "microsoft", "flipkart", "accenture", "deloitte",
          "cognizant", "hcl", "zoho", "reliance", "paytm", "scholarships"]
OFFICIAL_SUFFIX = (".gov.in", ".nic.in", ".ac.in", ".edu.in")

RULES = [
    ("bad", r"(registration|processing|security|training|joining|application|verification|laptop|kit)\s*(fee|fees|charge|charges|deposit|amount)",
     "Asks for an upfront fee. Genuine employers and scholarships do not charge students."),
    ("bad", r"\b(pay|send|transfer|deposit)\b.{0,40}(₹|rs\.?|inr|upi|paytm|gpay|phonepe|google pay)",
     "Asks you to send money, often by UPI."),
    ("bad", r"\b(otp|cvv|upi pin|atm pin|net ?banking password|card number)\b",
     "Asks for an OTP, PIN or card details. No genuine offer needs these."),
    ("warn", r"\b(aadhaar|aadhar|pan card|bank account|passbook)\b.{0,60}(send|share|whatsapp|upload|submit)|(send|share|whatsapp|upload|submit).{0,60}\b(aadhaar|aadhar|pan card|bank account|passbook)\b",
     "Asks for identity or bank documents before any interview or official process."),
    ("warn", r"(within\s+\d+\s*(hours|hrs|minutes)|immediately|urgent|last chance|limited seats|only \d+ (seats|slots)|offer expires|hurry)",
     "Creates time pressure so you act before checking."),
    ("warn", r"(guaranteed|100%|assured)\s*(job|placement|selection|scholarship|internship)|no interview|without interview|direct selection",
     "Promises a guaranteed result or selection without any interview."),
    ("warn", r"(whatsapp|telegram)\s*(only|us|me|number|at|on)|contact.{0,20}(whatsapp|telegram)",
     "Contact is only through WhatsApp or Telegram, not an official channel."),
    ("warn", r"(earn|salary|stipend|income).{0,30}(₹|rs\.?|inr)\s?[\d,]{5,}\s*(per|a|/)\s*(day|week)|work from home.{0,40}(per|a|/)\s*day",
     "Pay is unrealistically high for the work described."),
    ("warn", r"(congratulations|you have been selected|you are selected|shortlisted).{0,80}(without|no)\s*(interview|test|application)|you (have )?won",
     "Says you were selected for something you never applied or interviewed for."),
]


def _tokens(text):
    return re.findall(r"[a-z]{3,}", text.lower())


class NaiveBayes:
    """Multinomial naive Bayes with add-one smoothing, trained on the bundled labelled samples."""

    def __init__(self, samples):
        self.counts = {0: Counter(), 1: Counter()}
        self.docs = {0: 0, 1: 0}
        for s in samples:
            y = 1 if s["label"] == "scam" else 0
            self.docs[y] += 1
            self.counts[y].update(_tokens(s["text"]))
        self.vocab = set(self.counts[0]) | set(self.counts[1])
        self.total = {y: sum(c.values()) for y, c in self.counts.items()}

    def prob_scam(self, text):
        toks = [t for t in _tokens(text) if t in self.vocab]
        if len(toks) < 3:
            return 0.5
        logp = {}
        for y in (0, 1):
            lp = math.log(self.docs[y] / sum(self.docs.values()))
            for t in toks:
                lp += math.log((self.counts[y][t] + 1) / (self.total[y] + len(self.vocab)))
            logp[y] = lp
        m = max(logp.values())
        e0, e1 = math.exp(logp[0] - m), math.exp(logp[1] - m)
        return e1 / (e0 + e1)


MODEL = NaiveBayes(load_json("scam_samples.json"))


def _edit1(a, b):
    """True when a and b differ by one or two edits (lookalike spelling)."""
    if a == b or abs(len(a) - len(b)) > 2:
        return False
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] <= 2


def _host(url):
    return re.sub(r"^https?://", "", url.lower()).split("/")[0].split(":")[0].removeprefix("www.")


def analyse(text, db):
    low = text.lower()
    reasons, points = [], 0

    def add(level, msg):
        nonlocal points
        if any(r["text"] == msg for r in reasons):
            return
        reasons.append({"level": level, "text": msg})
        points += {"bad": 30, "warn": 12, "ok": -12}[level]

    for level, pattern, msg in RULES:
        if re.search(pattern, low, re.S):
            add(level, msg)

    urls = [u.rstrip(".,;") for u in URL_RE.findall(text) if "@" not in u]
    emails = EMAIL_RE.findall(text)
    companies = db.query(Company).filter(Company.verified == True).all()  # noqa: E712
    trusted_domains = {c.domain for c in companies if c.domain}

    for u in urls[:5]:
        host = _host(u)
        tld = host.rsplit(".", 1)[-1]
        label = host.split(".")[0]
        if host.endswith(OFFICIAL_SUFFIX):
            add("ok", f"{host} is an official government or academic domain.")
            continue
        if any(host == d or host.endswith("." + d) for d in trusted_domains):
            add("ok", f"{host} belongs to a company verified on Credora.")
            continue
        if re.fullmatch(r"[\d.]+", host):
            add("bad", "The link points to a raw IP address instead of a website name.")
        if host in SHORTENERS:
            add("warn", f"{host} is a link shortener that hides the real destination.")
        if tld in BAD_TLDS:
            add("warn", f"The link uses .{tld}, a domain ending common in throwaway scam sites.")
        if u.lower().startswith("http://"):
            add("warn", "The link does not use a secure (https) connection.")
        for b in BRANDS:
            parts = re.split(r"[-.]", host)
            if any(_edit1(p, b) for p in parts) or (b in label and label != b and not host.endswith(f"{b}.com")):
                add("bad", f"The link imitates the name \"{b}\" but is not its official website.")
                break
    if re.search(r"(government|govt|ministry|national scholarship|pm scholarship|aicte|ugc)", low) and urls \
            and not any(_host(u).endswith(OFFICIAL_SUFFIX) for u in urls):
        add("bad", "Claims to be from the government, but the link is not on a .gov.in or .nic.in website.")

    for e in emails[:5]:
        dom = e.split("@")[1].lower()
        if dom in FREE_MAIL:
            add("warn", f"The contact address {e} is a free email account, not a company address.")
        elif dom in trusted_domains:
            add("ok", f"The contact address is on {dom}, a company verified on Credora.")
    for c in companies:
        if c.name.lower().split(" pvt")[0] in low and not any(r["level"] == "ok" and "verified on Credora" in r["text"] for r in reasons):
            add("warn", f"Mentions {c.name}, which is verified on Credora, but the contact details do not match its record.")

    p = MODEL.prob_scam(text)
    if p >= 0.75:
        add("warn", f"The wording closely resembles known scam messages (model confidence {round(p * 100)}%).")
    elif p <= 0.25 and len(_tokens(text)) >= 8:
        add("ok", f"The wording resembles genuine opportunity notices (model confidence {round((1 - p) * 100)}%).")
    if not any(r["level"] == "bad" for r in reasons) and not re.search(r"\bfee|pay\b", low) and len(_tokens(text)) >= 8:
        add("ok", "No payment or sensitive detail is requested.")

    score = max(0, min(100, points + round((p - 0.5) * 30)))
    verdict = "likely_scam" if score >= 55 else "suspicious" if score >= 25 else "looks_safe"
    if len(_tokens(text)) < 4 and not urls:
        verdict, score = "not_enough", 0
        reasons = [{"level": "warn", "text": "There is too little text to judge. Paste the full message, link or letter."}]
    order = {"bad": 0, "warn": 1, "ok": 2}
    reasons.sort(key=lambda r: order[r["level"]])
    return {"verdict": verdict, "score": score, "reasons": reasons, "model": round(p, 2),
            "found": {"links": urls[:5], "emails": emails[:5], "amounts": MONEY_RE.findall(text)[:5]}}
