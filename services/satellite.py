# Uses Open-Meteo Air Quality API — completely free, no API key
import httpx
from datetime import datetime

BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

async def fetch_air_quality(lat: float, lon: float, date_from: str, date_to: str) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
        "start_date": date_from,
        "end_date": date_to,
        "timezone": "auto"
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(BASE_URL, params=params)
        r.raise_for_status()
        data = r.json()

    hourly = data.get("hourly", {})

    def avg(values):
        vals = [v for v in (values or []) if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    return {
        "pm25": avg(hourly.get("pm2_5")),
        "pm10": avg(hourly.get("pm10")),
        "no2":  avg(hourly.get("nitrogen_dioxide")),
        "so2":  avg(hourly.get("sulphur_dioxide")),
        "co":   avg(hourly.get("carbon_monoxide")),
        "o3":   avg(hourly.get("ozone")),
    }
