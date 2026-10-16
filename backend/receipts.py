"""Build a PDF receipt and email it after an admin marks a claim paid."""

from __future__ import annotations

from datetime import datetime
from email.message import EmailMessage
import logging
import os
import smtplib
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _fmt_date(value: Optional[str]) -> str:
    if not value:
        return "—"
    try:
        cleaned = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.strftime("%d %b %Y")
    except ValueError:
        return str(value)[:10]


def build_receipt_pdf(claim: Dict[str, Any], amount_inr: int) -> bytes:
    """Return a simple one-page PDF receipt as bytes."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=18)

    pdf.set_fill_color(228, 87, 46)
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_text_color(255, 248, 240)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_xy(14, 8)
    pdf.cell(0, 12, "Simmer", ln=1)

    pdf.set_text_color(43, 43, 43)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_xy(14, 40)
    pdf.cell(0, 10, "Yearly subscription receipt", ln=1)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(85, 85, 85)
    pdf.set_x(14)
    pdf.multi_cell(
        0,
        6,
        "Thank you for supporting Simmer. This confirms your year of fridge-to-meal suggestions.",
    )

    rows = [
        ("Receipt for", claim.get("email") or "—"),
        ("Amount paid", f"INR {amount_inr}"),
        ("UPI UTR / reference", claim.get("utr") or "—"),
        ("Valid until", _fmt_date(claim.get("paid_until"))),
        ("Claim id", claim.get("id") or "—"),
        ("Issued on", datetime.utcnow().strftime("%d %b %Y")),
    ]
    if claim.get("note"):
        rows.append(("Note", str(claim["note"])[:120]))

    y = 72
    for label, value in rows:
        pdf.set_xy(14, y)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(43, 43, 43)
        pdf.cell(55, 8, label)
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(60, 60, 60)
        pdf.multi_cell(120, 8, str(value))
        y = pdf.get_y() + 2

    pdf.set_y(max(y + 10, 160))
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.set_x(14)
    pdf.multi_cell(
        0,
        5,
        "Keep this email. If you change phones, write to the support address with this UTR and we can restore access.",
    )

    raw = pdf.output()
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)
    return str(raw).encode("latin-1")


def smtp_configured() -> bool:
    return bool(
        (os.getenv("SMTP_HOST") or "").strip()
        and (os.getenv("SMTP_USER") or "").strip()
        and (os.getenv("SMTP_PASSWORD") or "").strip()
    )


def send_receipt_email(claim: Dict[str, Any], amount_inr: int) -> Dict[str, Any]:
    """Email a PDF receipt to the claim email. Raises on hard SMTP failures."""
    to_addr = (claim.get("email") or "").strip()
    if not to_addr:
        raise ValueError("Claim has no email address.")
    if not smtp_configured():
        raise RuntimeError(
            "Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env."
        )

    host = (os.getenv("SMTP_HOST") or "").strip()
    port = int(os.getenv("SMTP_PORT") or "587")
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or "").strip()
    from_addr = (os.getenv("SMTP_FROM") or user).strip()
    support = (os.getenv("SUPPORT_EMAIL") or from_addr).strip()

    pdf_bytes = build_receipt_pdf(claim, amount_inr)
    valid_until = _fmt_date(claim.get("paid_until"))

    message = EmailMessage()
    message["Subject"] = f"Simmer receipt · INR {amount_inr} · valid until {valid_until}"
    message["From"] = from_addr
    message["To"] = to_addr
    message.set_content(
        "\n".join(
            [
                "Thanks for paying for Simmer.",
                "",
                f"Amount: INR {amount_inr}",
                f"UTR: {claim.get('utr')}",
                f"Valid until: {valid_until}",
                "",
                "Your PDF receipt is attached.",
                f"Questions? Write to {support}.",
                "",
                "— Simmer",
            ]
        )
    )
    message.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"simmer-receipt-{claim.get('utr') or 'year'}.pdf",
    )

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        if port != 465:
            smtp.starttls()
            smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(message)

    logger.info("Receipt emailed to %s for claim %s", to_addr, claim.get("id"))
    return {"to": to_addr, "ok": True}
