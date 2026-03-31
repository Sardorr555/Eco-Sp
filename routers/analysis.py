from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Territory, Analysis
from auth import get_current_user, User
from services.satellite import fetch_air_quality
from services.score import calc_score, get_label
from services.ai_analysis import run_ai_analysis_safe
import json

router = APIRouter()

class AnalysisBody(BaseModel):
    territory_id: int
    date_from: str
    date_to: str

def format_analysis(a: Analysis, territory_name: str = "") -> dict:
    """Serialize analysis including AI fields"""
    recs = []
    if a.ai_recommendations:
        try:
            recs = json.loads(a.ai_recommendations)
        except:
            recs = []

    return {
        "id": a.id,
        "territory_name": territory_name or (a.territory.name if a.territory else ""),
        "territory_id": a.territory_id,
        "date_from": a.date_from,
        "date_to": a.date_to,
        "overall_score": a.overall_score,
        "label": a.label,
        "pm25": a.pm25, "pm10": a.pm10,
        "no2": a.no2, "so2": a.so2, "co": a.co, "o3": a.o3,
        # AI fields
        "ai_summary":          a.ai_summary or "",
        "ai_risk_level":       a.ai_risk_level or "medium",
        "ai_recommendations":  recs,
        "ai_health_impact":    a.ai_health_impact or "",
        "ai_main_pollutant":   a.ai_main_pollutant or "",
        "ai_trend":            a.ai_trend or "",
        "ai_trend_direction":  a.ai_trend_direction or "baseline",  # ← NEW
        "ai_forecast":         a.ai_forecast or "",                 # ← NEW
        "created_at": a.created_at.isoformat()
    }

@router.post("/")
async def run_analysis(
    body: AnalysisBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    territory = db.query(Territory).filter(
        Territory.id == body.territory_id,
        Territory.user_id == user.id
    ).first()
    if not territory:
        raise HTTPException(404, "Territory not found")

    # 1. Fetch real satellite data
    import httpx
    try:
        metrics = await fetch_air_quality(
            territory.centroid_lat, territory.centroid_lon,
            body.date_from, body.date_to
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Satellite API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data Fetch Error: {str(e)}")

    # 2. Calculate score
    score = calc_score(metrics)
    label = get_label(score)

    # 3. Load previous analyses for trend comparison
    previous_analyses = db.query(Analysis).filter(
        Analysis.territory_id == territory.id
    ).order_by(Analysis.id.desc()).limit(3).all()

    # 4. Run AI analysis via Claude (with historical context)
    ai = await run_ai_analysis_safe(
        territory.name, body.date_from, body.date_to,
        metrics, score, label,
        previous_analyses=previous_analyses
    )

    # 5. Save everything to DB
    a = Analysis(
        territory_id=territory.id,
        date_from=body.date_from,
        date_to=body.date_to,
        status="done",
        overall_score=score,
        label=label,
        **metrics,
        **ai
    )
    db.add(a); db.commit(); db.refresh(a)

    return format_analysis(a, territory.name)


@router.get("/territory/{territory_id}")
def get_analyses(
    territory_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    territory = db.query(Territory).filter(
        Territory.id == territory_id,
        Territory.user_id == user.id
    ).first()
    if not territory:
        raise HTTPException(404, "Not found")
    analyses = db.query(Analysis).filter(
        Analysis.territory_id == territory_id
    ).order_by(Analysis.id.desc()).all()
    return [format_analysis(a, territory.name) for a in analyses]


@router.get("/dashboard")
def dashboard_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    territories = db.query(Territory).filter(Territory.user_id == user.id).all()
    all_analyses = []
    for t in territories:
        last = db.query(Analysis).filter(
            Analysis.territory_id == t.id
        ).order_by(Analysis.id.desc()).first()
        if last:
            all_analyses.append({
                "territory": t.name,
                "score": last.overall_score,
                "label": last.label,
                "risk": last.ai_risk_level or "medium"
            })

    avg_score = round(sum(a["score"] for a in all_analyses) / len(all_analyses)) if all_analyses else 0
    best  = max(all_analyses, key=lambda x: x["score"]) if all_analyses else None
    worst = min(all_analyses, key=lambda x: x["score"]) if all_analyses else None

    t_ids = [t.id for t in territories]
    recent = db.query(Analysis).filter(
        Analysis.territory_id.in_(t_ids)
    ).order_by(Analysis.id.desc()).limit(5).all()

    return {
        "territories_count": len(territories),
        "avg_score": avg_score,
        "best": best,
        "worst": worst,
        "high_risk_count": sum(1 for a in all_analyses if a["risk"] == "high"),
        "recent": [format_analysis(a) for a in recent]
    }
