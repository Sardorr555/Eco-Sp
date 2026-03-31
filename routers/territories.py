from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Territory, Analysis
from auth import get_current_user, User
import json

router = APIRouter()

def calc_centroid(geojson_str):
    try:
        geo = json.loads(geojson_str)
        coords = geo["geometry"]["coordinates"][0]
        return round(sum(c[1] for c in coords)/len(coords), 6), round(sum(c[0] for c in coords)/len(coords), 6)
    except: return 0.0, 0.0

def calc_area_km2(geojson_str):
    try:
        geo = json.loads(geojson_str)
        coords = geo["geometry"]["coordinates"][0]
        n = len(coords); area = 0
        for i in range(n):
            j = (i+1)%n
            area += coords[i][0]*coords[j][1] - coords[j][0]*coords[i][1]
        return round(abs(area)/2 * (111.32**2), 2)
    except: return 0.0

class TerritoryBody(BaseModel):
    name: str; geojson: str; color: str = "#00c9a7"

@router.get("/")
def list_territories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    territories = db.query(Territory).filter(Territory.user_id == user.id).all()
    result = []
    for t in territories:
        last = db.query(Analysis).filter(Analysis.territory_id == t.id).order_by(Analysis.id.desc()).first()
        result.append({
            "id": t.id, "name": t.name, "color": t.color,
            "area_km2": t.area_km2, "centroid_lat": t.centroid_lat, "centroid_lon": t.centroid_lon,
            "geojson": t.geojson,
            "last_score": last.overall_score if last else None,
            "last_label": last.label if last else None,
            "last_risk": last.ai_risk_level if last else None,
            "created_at": t.created_at.isoformat()
        })
    return result

@router.post("/")
def create_territory(body: TerritoryBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lat, lon = calc_centroid(body.geojson)
    t = Territory(user_id=user.id, name=body.name, geojson=body.geojson,
                  centroid_lat=lat, centroid_lon=lon, area_km2=calc_area_km2(body.geojson), color=body.color)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name, "centroid_lat": lat, "centroid_lon": lon}

@router.delete("/{id}")
def delete_territory(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(Territory).filter(Territory.id == id, Territory.user_id == user.id).first()
    if not t: raise HTTPException(404, "Not found")
    db.delete(t); db.commit()
    return {"ok": True}
