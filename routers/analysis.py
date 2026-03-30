from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Territory, Analysis
from auth import get_current_user, User
from services.satellite import fetch_air_quality
from services.score import calc_score, get_label

router = APIRouter()

class AnalysisBody(BaseModel):
    territory_id: int
    date_from: str   # YYYY-MM-DD
    date_to: str     # YYYY-MM-DD

@router.post("/")
async def run_analysis(body: AnalysisBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    territory = db.query(Territory).filter(Territory.id == body.territory_id, Territory.user_id == user.id).first()
    if not territory:
        raise HTTPException(404, "Territory not found")

    # Fetch real data from Open-Meteo
    metrics = await fetch_air_quality(
        territory.centroid_lat, territory.centroid_lon,
        body.date_from, body.date_to
    )

    score = calc_score(metrics)
    label = get_label(score)

    a = Analysis(
        territory_id=territory.id,
        date_from=body.date_from,
        date_to=body.date_to,
        status="done",
        overall_score=score,
        label=label,
        **metrics
    )
    db.add(a); db.commit(); db.refresh(a)

    return {
        "id": a.id,
        "territory_name": territory.name,
        "date_from": body.date_from,
        "date_to": body.date_to,
        "overall_score": score,
        "label": label,
        "pm25": a.pm25, "pm10": a.pm10,
        "no2": a.no2, "so2": a.so2, "co": a.co, "o3": a.o3,
        "created_at": a.created_at.isoformat()
    }

@router.get("/territory/{territory_id}")
def get_analyses(territory_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    territory = db.query(Territory).filter(Territory.id == territory_id, Territory.user_id == user.id).first()
    if not territory: raise HTTPException(404, "Not found")
    analyses = db.query(Analysis).filter(Analysis.territory_id == territory_id).order_by(Analysis.id.desc()).all()
    return [{"id": a.id, "date_from": a.date_from, "date_to": a.date_to,
             "overall_score": a.overall_score, "label": a.label,
             "pm25": a.pm25, "pm10": a.pm10, "no2": a.no2, "so2": a.so2, "co": a.co, "o3": a.o3} for a in analyses]

@router.get("/dashboard")
def dashboard_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    territories = db.query(Territory).filter(Territory.user_id == user.id).all()
    all_analyses = []
    for t in territories:
        last = db.query(Analysis).filter(Analysis.territory_id == t.id).order_by(Analysis.id.desc()).first()
        if last: all_analyses.append({"territory": t.name, "score": last.overall_score, "label": last.label})

    avg_score = round(sum(a["score"] for a in all_analyses) / len(all_analyses)) if all_analyses else 0
    best = max(all_analyses, key=lambda x: x["score"]) if all_analyses else None
    worst = min(all_analyses, key=lambda x: x["score"]) if all_analyses else None

    # Recent analyses (last 5 across all territories)
    t_ids = [t.id for t in territories]
    recent = db.query(Analysis).filter(Analysis.territory_id.in_(t_ids)).order_by(Analysis.id.desc()).limit(5).all()

    return {
        "territories_count": len(territories),
        "avg_score": avg_score,
        "best": best,
        "worst": worst,
        "recent": [{"id": a.id, "territory_id": a.territory_id,
                    "date_from": a.date_from, "date_to": a.date_to,
                    "score": a.overall_score, "label": a.label} for a in recent]
    }
