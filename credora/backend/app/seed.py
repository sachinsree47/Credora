"""Demo data so the prototype is usable straight away. Everything here is SAMPLE data."""
import json, random, secrets

from . import exports
from .core import (Application, Certificate, College, Company, DataRequest, Opportunity, Roster, SessionLocal, User,
                   hash_pw, load_json, new_signing_key, now, save_doc, sign)

DEMO_PASSWORD = "Demo@1234"
DEPTS = [("Computer Science and Engineering", "CS", 480), ("Information Technology", "IT", 240),
         ("AI and Data Science", "AD", 180), ("Cyber Security", "CY", 60),
         ("Electronics and Communication", "EC", 360), ("Electrical and Electronics", "EE", 240),
         ("Mechanical Engineering", "ME", 240), ("Civil Engineering", "CE", 200)]
FIRST = ["Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Bhavna", "Deepak", "Divya", "Farhan", "Gauri", "Harish",
         "Ishita", "Jatin", "Kavya", "Lokesh", "Meera", "Nikhil", "Pooja", "Rahul", "Riya", "Sanjay", "Sneha",
         "Tanvi", "Uday", "Varun", "Yamini", "Zoya", "Imran", "Priya", "Rohit"]
LAST = ["Sharma", "Patil", "Iyer", "Khan", "Reddy", "Nair", "Deshmukh", "Joshi", "Gupta", "Verma", "Kulkarni",
        "Menon", "Singh", "Das", "Pillai", "Chavan", "Rao", "Mishra", "Thomas", "Bose"]
FIXED = {"23CY014": "Kishan N", "23CY020": "Aditi Sharma", "23CY031": "Rahul Patil"}


def seed():
    db = SessionLocal()
    if db.query(User).first():
        db.close()
        return
    rnd = random.Random(7)
    priv, pub = new_signing_key()
    col = College(code="SIT-4471", name="Sample Institute of Technology", verified=True,
                  departments=sorted(d[0] for d in DEPTS), batches=["2023-2027"], sign_private=priv, sign_public=pub)
    db.add(col)
    db.flush()
    for dept, code, n in DEPTS:
        for i in range(1, n + 1):
            roll = f"23{code}{i:03d}"
            db.add(Roster(college_id=col.id, batch="2023-2027", department=dept, roll_no=roll,
                          name=FIXED.get(roll) or f"{rnd.choice(FIRST)} {rnd.choice(LAST)}",
                          email=f"{roll.lower()}@sit.example", phone=f"90000{rnd.randint(10000, 99999)}",
                          cgpa=round(rnd.uniform(6.0, 9.6), 2), dob=f"{rnd.randint(1, 28):02d}/{rnd.randint(1, 12):02d}/{rnd.choice([2004, 2005])}",
                          category=rnd.choice(["General", "General", "OBC", "SC", "ST"]), address="Sample address, Nagpur, Maharashtra"))
    db.flush()

    pw = hash_pw(DEMO_PASSWORD)
    locked = hash_pw(secrets.token_urlsafe(24))   # seeded classmates cannot be logged into
    ok = [{"name": "Seeded demo account", "passed": True, "detail": "Created with the sample data."}]
    anita = User(role="college", name="Anita Deshmukh", email="anita@sit.example", mobile="9000011111", pw_hash=pw,
                 status="verified", checks=ok, college_id=col.id, college_code=col.code, staff_role="cpo", staff_depts=[])
    vikram = User(role="college", name="Vikram Joshi", email="vikram@sit.example", mobile="9000022222", pw_hash=pw,
                  status="verified", checks=ok, college_id=col.id, college_code=col.code, staff_role="dpo",
                  staff_depts=["Cyber Security", "Information Technology"])
    co = Company(name="Brightlane Systems Pvt. Ltd.", reg_no="U72900MH2018PTC123456", domain="brightlane.example", verified=True)
    db.add_all([anita, vikram, co])
    db.flush()
    rohan = User(role="recruiter", name="Rohan Mehta", email="rohan@brightlane.example", mobile="9000033333", pw_hash=pw,
                 status="verified", checks=ok, company_id=co.id, designation="HR manager")
    db.add(rohan)
    db.flush()

    # Eight verified students with résumés in every department, so placement sharing can be tried anywhere.
    picked = []
    for dept, _, _ in DEPTS:
        picked += db.query(Roster).filter(Roster.department == dept).order_by(Roster.roll_no).limit(8).all()
    picked += db.query(Roster).filter(Roster.roll_no == "23CY014").all()
    students = {}
    for r in picked:
        demo = r.roll_no == "23CY014"
        s = User(role="student", name=r.name, email="kishan@student.example" if demo else r.email, mobile=r.phone,
                 pw_hash=pw if demo else locked, status="verified", checks=ok, college_id=col.id, college_code=col.code,
                 roll_no=r.roll_no, department=r.department, batch=r.batch, cgpa=r.cgpa, category=r.category,
                 state="Tamil Nadu" if demo else "Maharashtra", income=450000 if demo else rnd.choice([300000, 600000, 900000]),
                 gender="Male" if demo else rnd.choice(["Male", "Female"]), resume_status="verified")
        db.add(s)
        db.flush()
        r.user_id = s.id
        s.resume_doc = save_doc(db, s.id, "resume", f"{r.roll_no}_resume.pdf",
                                exports.sample_resume(r.name, r.roll_no, r.department, col.name), "application/pdf").id
        students[r.roll_no] = (s, r)

    for o in load_json("opportunities.json")["items"]:
        db.add(Opportunity(sample=True, **o))
    intern = Opportunity(kind="internship", title="Security Analyst Internship", provider=co.name, company_id=co.id,
                         amount="₹20,000 per month", deadline="2026-12-05",
                         description="Six-month paid internship with the security operations team. Remote. No fee of any kind.",
                         criteria={"departments": ["Cyber Security", "Information Technology", "Computer Science and Engineering"], "min_cgpa": 6.5})
    job = Opportunity(kind="job", title="Junior Web Developer", provider=co.name, company_id=co.id,
                      amount="₹4.5 LPA", deadline="2026-12-15", description="Full-time role in Nagpur for 2027 graduates.",
                      criteria={"min_cgpa": 6.0})
    db.add_all([intern, job])
    db.flush()

    kishan, krow = students["23CY014"]
    db.add(Application(user_id=kishan.id, opp_id=intern.id, status="Under review"))
    for roll in ("23CY001", "23CY002", "23CY003"):
        db.add(Application(user_id=students[roll][0].id, opp_id=intern.id))
    for i, (title, kind) in enumerate([("Semester 4 Marksheet", "Marksheet"), ("Network Security Workshop", "Workshop certificate")]):
        cid = f"CRD-DEMO{i + 1:06d}"
        payload = json.dumps({"certificate_id": cid, "title": title, "kind": kind, "details": "Sample certificate issued with the demo data.",
                              "student_name": krow.name, "roll_no": krow.roll_no, "department": krow.department,
                              "batch": krow.batch, "college": col.name, "college_code": col.code,
                              "issued_by": "Anita Deshmukh, College placement officer",
                              "issued_on": now().strftime("%d %b %Y")}, sort_keys=True, ensure_ascii=False)
        db.add(Certificate(id=cid, college_id=col.id, student_id=kishan.id, roster_id=krow.id, payload=payload,
                           signature=sign(col, payload), issued_by=anita.id))
    db.add(DataRequest(company_id=co.id, recruiter_id=rohan.id, college_id=col.id, purpose="Security Analyst Internship",
                       kind="internship", amount="₹20,000 per month", deadline="2026-12-05", min_cgpa=6.5,
                       description="Six-month paid internship with the security operations team. Remote. We would like to shortlist students from Cyber Security.",
                       department="Cyber Security", batch="2023-2027",
                       fields=["Full name", "Roll number", "Department", "CGPA", "College email", "Résumé"]))
    db.commit()
    db.close()
