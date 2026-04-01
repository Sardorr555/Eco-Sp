# Dual-source Air Quality: WAQI (real sensors) + Open-Meteo (satellite fallback)
import httpx
import os
from datetime import datetime

OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WAQI_URL = "https://api.waqi.info/feed/geo:{lat};{lon}/"


async def _fetch_waqi(lat: float, lon: float) -> dict | None:
    """
    Fetch real-time air quality from WAQI (World Air Quality Index).
    Returns sensor data from the nearest physical monitoring station.
    More accurate than satellite data, especially for Uzbekistan / Central Asia.
    """
    token = os.getenv("WAQI_API_KEY", "")
    if not token:
        return None

    url = WAQI_URL.format(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params={"token": token})
            r.raise_for_status()
            data = r.json()

        if data.get("status") != "ok":
            return None

        aqi_data = data.get("data", {})
        iaqi = aqi_data.get("iaqi", {})

        # WAQI returns individual AQI sub-indices per pollutant.
        # We extract raw values. Some stations may not report all pollutants.
        def get_val(key):
            entry = iaqi.get(key)
            if entry and "v" in entry:
                return round(float(entry["v"]), 2)
            return None

        result = {
            "pm25": get_val("pm25"),
            "pm10": get_val("pm10"),
            "no2":  get_val("no2"),
            "so2":  get_val("so2"),
            "co":   get_val("co"),
            "o3":   get_val("o3"),
        }

        # Station info for transparency
        station = aqi_data.get("city", {}).get("name", "Unknown")
        result["_source"] = "waqi"
        result["_station"] = station

        # Check if we got at least PM2.5 or PM10 (most basic metrics)
        if result["pm25"] is None and result["pm10"] is None:
            return None

        return result

    except Exception:
        return None


async def _fetch_open_meteo(lat: float, lon: float, date_from: str, date_to: str) -> dict:
    """
    Fetch air quality from Open-Meteo (satellite/model data).
    Always available globally, but less accurate than real sensors.
    Used as fallback when WAQI has no nearby stations.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
        "start_date": date_from,
        "end_date": date_to,
        "timezone": "auto"
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(OPEN_METEO_URL, params=params)
        r.raise_for_status()
        data = r.json()

    hourly = data.get("hourly", {})

    def avg(values):
        vals = [v for v in (values or []) if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    result = {
        "pm25": avg(hourly.get("pm2_5")),
        "pm10": avg(hourly.get("pm10")),
        "no2":  avg(hourly.get("nitrogen_dioxide")),
        "so2":  avg(hourly.get("sulphur_dioxide")),
        "co":   avg(hourly.get("carbon_monoxide")),
        "o3":   avg(hourly.get("ozone")),
    }
    result["_source"] = "open-meteo"
    result["_station"] = "Satellite Model"
    return result


async def fetch_air_quality(lat: float, lon: float, date_from: str, date_to: str) -> dict:
    """
    Main entry point. Tries WAQI first (real sensors), falls back to Open-Meteo.
    If WAQI returns partial data, fills missing values from Open-Meteo.
    """

    waqi_data = await _fetch_waqi(lat, lon)
    open_meteo_data = await _fetch_open_meteo(lat, lon, date_from, date_to)

    if waqi_data is None:
        # No WAQI data available — use Open-Meteo only
        return open_meteo_data

    # WAQI is primary. Fill any missing pollutants from Open-Meteo
    merged = {}
    pollutants = ["pm25", "pm10", "no2", "so2", "co", "o3"]
    sources_used = set()

    for p in pollutants:
        if waqi_data.get(p) is not None:
            merged[p] = waqi_data[p]
            sources_used.add("waqi")
        else:
            merged[p] = open_meteo_data.get(p, 0.0)
            sources_used.add("open-meteo")

    # Mark data source for transparency in UI/AI
    if len(sources_used) > 1:
        merged["_source"] = "waqi+open-meteo"
        merged["_station"] = waqi_data.get("_station", "Mixed Sources")
    else:
        merged["_source"] = "waqi"
        merged["_station"] = waqi_data.get("_station", "WAQI Station")

    return merged
