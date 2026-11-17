"""Turn a shared set of student rows into CSV, Excel, Word or PDF."""
import csv, io

from docx import Document as Docx
from docx.enum.section import WD_ORIENT
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def to_csv(fields, rows, meta):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(fields)
    for r in rows:
        w.writerow([r.get(f, "") for f in fields])
    return buf.getvalue().encode("utf-8-sig"), "text/csv", "csv"


def to_xlsx(fields, rows, meta):
    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    ws.append([meta["title"]])
    ws.append([meta["subtitle"]])
    ws.append([])
    ws.append(fields)
    ws["A1"].font = Font(bold=True, size=14)
    for c in ws[4]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="2456D6")
        c.alignment = Alignment(horizontal="center")
    for r in rows:
        ws.append([r.get(f, "") for f in fields])
    for i, f in enumerate(fields, 1):
        width = max([len(f)] + [len(str(r.get(f, ""))) for r in rows]) + 4
        ws.column_dimensions[ws.cell(4, i).column_letter].width = min(width, 45)
    ws.freeze_panes = "A5"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"


def to_docx(fields, rows, meta):
    d = Docx()
    sec = d.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = sec.page_height, sec.page_width
    d.add_heading(meta["title"], level=1)
    d.add_paragraph(meta["subtitle"])
    t = d.add_table(rows=1, cols=len(fields))
    t.style = "Light Grid Accent 1"
    for i, f in enumerate(fields):
        t.rows[0].cells[i].text = f
    for r in rows:
        cells = t.add_row().cells
        for i, f in enumerate(fields):
            cells[i].text = str(r.get(f, ""))
    d.add_paragraph()
    d.add_paragraph(meta["footer"])
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"


def to_pdf(fields, rows, meta):
    buf = io.BytesIO()
    styles = getSampleStyleSheet()
    small = styles["BodyText"]
    small.fontSize = 8
    small.leading = 10

    def watermark(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 38)
        canvas.setFillColorRGB(0.14, 0.34, 0.84, alpha=0.07)
        canvas.translate(landscape(A4)[0] / 2, landscape(A4)[1] / 2)
        canvas.rotate(25)
        canvas.drawCentredString(0, 0, meta["watermark"])
        canvas.restoreState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        canvas.drawString(15 * mm, 8 * mm, meta["footer"])

    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm, title=meta["title"])
    data = [fields] + [[Paragraph(str(r.get(f, "")), small) for f in fields] for r in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2456D6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9E1F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F7FF")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    doc.build([Paragraph(meta["title"], styles["Title"]), Paragraph(meta["subtitle"], styles["BodyText"]),
               Spacer(1, 6 * mm), table], onFirstPage=watermark, onLaterPages=watermark)
    return buf.getvalue(), "application/pdf", "pdf"


def append_pdfs(first: bytes, others: list):
    """Join PDFs into one file. Falls back to the first file alone if pypdf is missing or a file cannot be read."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return first
    out = PdfWriter()
    for raw in [first] + others:
        try:
            for page in PdfReader(io.BytesIO(raw)).pages:
                out.add_page(page)
        except Exception:
            continue
    buf = io.BytesIO()
    out.write(buf)
    return buf.getvalue()


FORMATS = {"csv": to_csv, "xlsx": to_xlsx, "docx": to_docx, "pdf": to_pdf}


def sample_resume(name, roll, dept, college):
    """A one-page placeholder résumé used only for seeded demo students."""
    buf = io.BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"Resume - {name}")
    doc.build([
        Paragraph(name, styles["Title"]),
        Paragraph(f"{dept} | Roll number {roll} | {college}", styles["BodyText"]),
        Spacer(1, 8 * mm),
        Paragraph("Sample résumé", styles["Heading2"]),
        Paragraph("This document is generated demo data for the Credora prototype. A real student uploads their own résumé as a PDF.", styles["BodyText"]),
        Spacer(1, 4 * mm),
        Paragraph("Skills", styles["Heading2"]),
        Paragraph("Networking basics, Python, Linux, web security fundamentals", styles["BodyText"]),
    ])
    return buf.getvalue()
