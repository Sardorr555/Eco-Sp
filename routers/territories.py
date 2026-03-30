from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Territory, Analysis
from auth import get_current_user, User
import json, math

router = APIRouter()

def calc_centroid(geojson_str: str):
    """Calculate centroid of a GeoJSON polygon"""
    try:
        geo = json.loads(geojson_str)
        coords = geo["geometry"]["coordinates"][0]
        lat = sum(c[1] for c in coords) / len(coords)
        lon = sum(c[0] for c in coords) / len(coords)
        return round(lat, 6), round(lon, 6)
    except:
        return 0.0, 0.0

def calc_area_km2(geojson_str: str) -> float:
    """Rough area estimate in km²"""
    try:
        geo = json.loads(geojson_str)
        coords = geo["geometry"]["coordinates"][0]
        # Shoelace formula in degrees → convert to km²
        n = len(coords)
        area = 0
        for i in range(n):
            j = (i + 1) % n
            area += coords[i][0] * coords[j][1]
            area -= coords[j][0] * coords[i][1]
        area_deg2 = abs(area) / 2
        area_km2 = area_deg2 * (111.32 ** 2)
        return round(area_km2, 2)
    except:
        return 0.0

class TerritoryBody(BaseModel):
    name: str
    geojson: str
    color: str = "#00c9a7"

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
            "created_at": t.created_at.isoformat()
        })
    return result

@router.post("/")
def create_territory(body: TerritoryBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lat, lon = calc_centroid(body.geojson)
    area = calc_area_km2(body.geojson)
    t = Territory(user_id=user.id, name=body.name, geojson=body.geojson,
                  centroid_lat=lat, centroid_lon=lon, area_km2=area, color=body.color)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name, "centroid_lat": lat, "centroid_lon": lon, "area_km2": area}

@router.delete("/{id}")
def delete_territory(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(Territory).filter(Territory.id == id, Territory.user_id == user.id).first()
    if not t: raise HTTPException(404, "Not found")
    db.delete(t); db.commit()
    return {"ok": True}
