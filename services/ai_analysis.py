import os
import json
from openai import AsyncOpenAI

async def call_ai(system_prompt: str, user_prompt: str) -> str:
    # 1. Try DeepSeek first
    ds_key = os.environ.get("DEEPSEEK_API_KEY")
    ds_err = None
    if ds_key and ds_key != "your_deepseek_api_key_here":
        try:
            client = AsyncOpenAI(api_key=ds_key, base_url="https://api.deepseek.com")
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        except Exception as e:
            ds_err = e
            print(f"DeepSeek failed: {e}. Falling back to ChatGPT...")
    
    # 2. Try ChatGPT (OpenAI) as fallback or if DeepSeek key is missing
    oai_key = os.environ.get("OPENAI_API_KEY")
    if oai_key and oai_key != "your_openai_api_key_here":
        try:
            client = AsyncOpenAI(api_key=oai_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"ChatGPT failed: {e}.")
            raise Exception("All AI backends failed or no API keys are provided.")
    
    # If no keys at all
    raise Exception(f"No valid API keys configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY. DeepSeek error (if attempted): {ds_err}")

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

    # Format current metrics
    metrics_str = json.dumps(metrics, indent=2)
    
    # Format history if any
    history_context = "No previous history available."
    if previous_analyses and len(previous_analyses) > 0:
        history_context = "Recent analyses for this territory:\n"
        for a in previous_analyses:
            history_context += f"- Period {a.date_from} to {a.date_to}: Score {a.overall_score} ({a.label}), PM2.5: {a.pm25}, PM10: {a.pm10}, NO2: {a.no2}, SO2: {a.so2}\n"

    system_prompt = "You are an expert environmental and air quality analyst. Provide objective, concise, and structured JSON output. Do NOT include markdown blocks around the JSON; the output MUST be valid raw JSON."
    
    user_prompt = f"""
    Analyze the air quality for the territory '{territory_name}' from {date_from} to {date_to}.
    The overall calculated score is {score}/100 and the label is '{label}'.
    
    Here are the averaged measured pollutants in μg/m³:
    {metrics_str}
    
    Historical Context (for trend and forecast):
    {history_context}
    
    Return a strictly valid JSON object covering the following keys:
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
        content = await call_ai(system_prompt, user_prompt)
        
        # Cleanup
        content = content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "", 1)
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
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

