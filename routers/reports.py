from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Report, Analysis, Territory
from auth import get_current_user, User
from services.pdf_gen import generate_pdf
import os, json

router = APIRouter()

class ReportBody(BaseModel):
    analysis_id: int; title: str = ""

@router.post("/generate")
async def generate_report(body: ReportBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    analysis = db.query(Analysis).join(Territory).filter(
        Analysis.id == body.analysis_id, Territory.user_id == user.id
    ).first()
    if not analysis: raise HTTPException(404, "Analysis not found")
    title = body.title or f"{analysis.territory.name} — {analysis.date_from}"
    pdf_path = await generate_pdf(analysis, title)
    report = Report(analysis_id=analysis.id, user_id=user.id, title=title, pdf_path=pdf_path)
    db.add(report); db.commit(); db.refresh(report)
    return {"id": report.id, "title": title, "pdf_url": f"/api/reports/{report.id}/download"}

@router.get("/")
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = db.query(Report).filter(Report.user_id == user.id).order_by(Report.id.desc()).all()
    result = []
    for r in reports:
        a = r.analysis
        recs = []
        if a and a.ai_recommendations:
            try: recs = json.loads(a.ai_recommendations)
            except: pass
        result.append({
            "id": r.id, "title": r.title,
            "territory": a.territory.name if a and a.territory else "",
            "score": a.overall_score if a else None,
            "label": a.label if a else None,
            "risk": a.ai_risk_level if a else None,
            "ai_summary": (a.ai_summary or "")[:120] + "..." if a and a.ai_summary and len(a.ai_summary) > 120 else (a.ai_summary or ""),
            "date_from": a.date_from if a else None,
            "date_to": a.date_to if a else None,
            "created_at": r.created_at.isoformat(),
            "pdf_url": f"/api/reports/{r.id}/download"
        })
    return result

@router.get("/{id}/download")
def download_report(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id, Report.user_id == user.id).first()
    if not report or not os.path.exists(report.pdf_path):
        raise HTTPException(404, "Not found")
    return FileResponse(report.pdf_path, media_type="application/pdf", filename=f"{report.title}.pdf")
