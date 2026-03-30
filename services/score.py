# WHO Air Quality Guidelines 2021

WHO = {
    "pm25": {"good": 5,   "moderate": 15,  "max": 75},
    "pm10": {"good": 15,  "moderate": 45,  "max": 150},
    "no2":  {"good": 10,  "moderate": 25,  "max": 200},
    "so2":  {"good": 40,  "moderate": 125, "max": 500},
    "co":   {"good": 100, "moderate": 1000,"max": 10000},
    "o3":   {"good": 60,  "moderate": 100, "max": 240},
}

WEIGHTS = {"pm25": 0.30, "pm10": 0.20, "no2": 0.20, "so2": 0.10, "co": 0.10, "o3": 0.10}

def calc_score(metrics: dict) -> int:
    total = 0.0
    for key, weight in WEIGHTS.items():
        val = metrics.get(key, 0) or 0
        limits = WHO[key]
        if val <= limits["good"]:
            pts = 100
        elif val <= limits["moderate"]:
            pts = 100 - 40 * (val - limits["good"]) / (limits["moderate"] - limits["good"])
        else:
            pts = max(0, 60 - 60 * (val - limits["moderate"]) / (limits["max"] - limits["moderate"]))
        total += pts * weight
    return round(total)

def get_label(score: int) -> str:
    if score >= 80: return "Excellent"
    if score >= 60: return "Good"
    if score >= 40: return "Moderate"
    if score >= 20: return "Poor"
    return "Hazardous"

def get_pollutant_status(key: str, val: float) -> str:
    limits = WHO.get(key, {})
    if val <= limits.get("good", 0): return "good"
    if val <= limits.get("moderate", 0): return "moderate"
    return "poor"
