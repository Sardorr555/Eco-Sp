import os
import json
import httpx
from anthropic import AsyncAnthropic

async def run_ai_analysis_safe(territory_name: str, date_from: str, date_to: str, metrics: dict, score: int, label: str, previous_analyses: list = None) -> dict:
    """Run AI analysis safely, returning default empty values on failure."""
    default_res = {
        "ai_summary": "",
        "ai_risk_level": "medium",
        "ai_recommendations": "[]",
        "ai_health_impact": "",
        "ai_main_pollutant": "",
        "ai_trend": "",
        "ai_trend_direction": "baseline",
        "ai_forecast": ""
    }

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return default_res

    client = AsyncAnthropic(api_key=api_key)
    
    # Format current metrics
    metrics_str = json.dumps(metrics, indent=2)
    
    # Format history if any
    history_context = "No previous history available."
    if previous_analyses and len(previous_analyses) > 0:
        history_context = "Recent analyses for this territory:\n"
        for a in previous_analyses:
            history_context += f"- Period {a.date_from} to {a.date_to}: Score {a.overall_score} ({a.label}), PM2.5: {a.pm25}, PM10: {a.pm10}, NO2: {a.no2}, SO2: {a.so2}\n"

    prompt = f"""
    Analyze the air quality for the territory '{territory_name}' from {date_from} to {date_to}.
    The overall calculated score is {score}/100 and the label is '{label}'.
    
    Here are the averaged measured pollutants in μg/m³:
    {metrics_str}
    
    Historical Context (for trend and forecast):
    {history_context}
    
    Return a strictly valid JSON object covering the following keys, with no markdown formatting around it:
    - summary (string): A brief summary of the air quality (2-3 sentences).
    - risk_level (string): One of 'low', 'medium', 'high'.
    - main_pollutant (string): Name of the main pollutant of concern (e.g. 'pm25').
    - health_impact (string): The health impact.
    - recommendations (list of strings): 3 to 4 recommendations.
    - trend_assessment (string): Assess the trend vs previous periods, if available.
    - trend_direction (string): One of 'improving', 'stable', 'worsening', or 'baseline'.
    - forecast (string): 30-day forecast description based on the situation.
    """

    try:
        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system="You are an expert environmental and air quality analyst. Provide objective, concise, and structured JSON output.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        content = response.content[0].text
        # Optional: cleanup json block formatting if returned
        if content.startswith("```json"):
            content = content.split("```json")[1]
            if content.endswith("```"):
                content = content[:-3]
        content = content.strip().strip('`')
        
        data = json.loads(content)
        
        return {
            "ai_summary": data.get("summary", ""),
            "ai_risk_level": data.get("risk_level", "medium").lower(),
            "ai_recommendations": json.dumps(data.get("recommendations", [])),
            "ai_health_impact": data.get("health_impact", ""),
            "ai_main_pollutant": data.get("main_pollutant", ""),
            "ai_trend": data.get("trend_assessment", ""),
            "ai_trend_direction": data.get("trend_direction", "baseline").lower(),
            "ai_forecast": data.get("forecast", "")
        }
    except Exception as e:
        print("AI Analysis failed:", e)
        return default_res

