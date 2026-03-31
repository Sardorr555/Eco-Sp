from weasyprint import HTML
from models import Analysis
import json, os

REPORTS_DIR = "static/reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

def score_color(score):
    if score >= 80: return "#00c9a7"
    if score >= 60: return "#4f8ef7"
    if score >= 40: return "#f5a623"
    return "#f05252"

def risk_color(risk):
    return {"low": "#00c9a7", "medium": "#f5a623", "high": "#f05252"}.get(risk, "#f5a623")

def pollutant_status(val, good, moderate):
    if val <= good: return ("good", "#00c9a7", "✓ Good")
    if val <= moderate: return ("moderate", "#f5a623", "⚠ Moderate")
    return ("poor", "#f05252", "✗ Poor")

async def generate_pdf(analysis: Analysis, title: str) -> str:
    t = analysis.territory
    color = score_color(analysis.overall_score)
    risk_col = risk_color(analysis.ai_risk_level or "medium")

    # Parse AI recommendations
    recs = []
    if analysis.ai_recommendations:
        try:
            recs = json.loads(analysis.ai_recommendations)
        except:
            recs = []

    recs_html = "".join([
        f'<li style="padding: 6px 0; color: #e8edf5; font-size: 13px;">🔹 {r}</li>'
        for r in recs
    ]) if recs else "<li style='color: #7a8ba0;'>No recommendations available</li>"

    # Pollutants table rows
    WHO = {"pm25": (5, 15), "pm10": (15, 45), "no2": (10, 25), "so2": (40, 125), "co": (100, 1000), "o3": (60, 100)}
    NAMES = {"pm25": "PM2.5", "pm10": "PM10", "no2": "NO₂", "so2": "SO₂", "co": "CO", "o3": "O₃"}
    LIMITS_DISPLAY = {"pm25": 5, "pm10": 15, "no2": 10, "so2": 40, "co": 100, "o3": 60}

    rows = ""
    for k, name in NAMES.items():
        val = getattr(analysis, k) or 0
        good, mod = WHO[k]
        _, col, status_text = pollutant_status(val, good, mod)
        rows += f'<tr><td>{name}</td><td style="font-family: monospace">{val:.1f}</td><td>{LIMITS_DISPLAY[k]}</td><td style="color:{col}; font-weight:600">{status_text}</td></tr>'

    trend_icon = {"improving": "↗", "stable": "→", "worsening": "↘", "baseline": "◎"}.get(
        analysis.ai_trend_direction or "baseline", "◎"
    )
    trend_color = {"improving": "#00c9a7", "stable": "#4f8ef7", "worsening": "#f05252", "baseline": "#7a8ba0"}.get(
        analysis.ai_trend_direction or "baseline", "#7a8ba0"
    )

    ai_section = ""
    if analysis.ai_summary:
        forecast_row = f"""
          <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">30-Day Forecast</div>
            <p style="font-size: 13px; line-height: 1.6; color: #c5cfe0;">{analysis.ai_forecast or '—'}</p>
          </div>
        """ if analysis.ai_forecast else ""

        trend_row = f"""
          <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Trend vs Previous Periods</div>
            <p style="font-size: 13px; line-height: 1.6; color: #c5cfe0;">{analysis.ai_trend or '—'}</p>
          </div>
        """ if analysis.ai_trend else ""

        ai_section = f"""
        <div style="page-break-before: avoid; margin-top: 32px;">
          <div style="background: #111827; border-left: 4px solid #a78bfa; border-radius: 8px; padding: 24px 28px;">
            <h2 style="color: #a78bfa; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">✦ AI Environmental Analysis</h2>

            <p style="font-size: 14px; line-height: 1.7; color: #e8edf5; margin-bottom: 20px;">{analysis.ai_summary}</p>

            <table style="width: 100%; margin-bottom: 20px;">
              <tr>
                <td style="width: 33%; padding-right: 12px;">
                  <div style="background: rgba(167,139,250,0.1); border-radius: 6px; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #7a8ba0; text-transform: uppercase; margin-bottom: 4px;">Risk Level</div>
                    <div style="font-size: 18px; font-weight: 700; color: {risk_col};">{(analysis.ai_risk_level or 'medium').upper()}</div>
                  </div>
                </td>
                <td style="width: 33%; padding-right: 12px;">
                  <div style="background: rgba(167,139,250,0.1); border-radius: 6px; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #7a8ba0; text-transform: uppercase; margin-bottom: 4px;">Trend</div>
                    <div style="font-size: 18px; font-weight: 700; color: {trend_color};">{trend_icon} {(analysis.ai_trend_direction or 'baseline').capitalize()}</div>
                  </div>
                </td>
                <td style="width: 33%;">
                  <div style="background: rgba(167,139,250,0.1); border-radius: 6px; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #7a8ba0; text-transform: uppercase; margin-bottom: 4px;">Primary Concern</div>
                    <div style="font-size: 15px; font-weight: 600; color: #e8edf5;">{analysis.ai_main_pollutant or '—'}</div>
                  </div>
                </td>
              </tr>
            </table>

            {trend_row}
            {forecast_row}

            <div style="margin-bottom: 20px;">
              <div style="font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Health Impact</div>
              <p style="font-size: 13px; line-height: 1.6; color: #c5cfe0;">{analysis.ai_health_impact or '—'}</p>
            </div>

            <div>
              <div style="font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Recommendations</div>
              <ul style="padding-left: 0; list-style: none;">
                {recs_html}
              </ul>
            </div>
          </div>
        </div>
        """

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * {{ box-sizing: border-box; margin: 0; padding: 0; }}
      body {{ font-family: Arial, Helvetica, sans-serif; background: #080d1a; color: #e8edf5; }}
      .cover {{ padding: 56px 48px 40px; background: #0e1525; border-bottom: 3px solid {color}; }}
      .score-circle {{ display: inline-flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 50%; border: 4px solid {color}; font-size: 34px; font-weight: 700; color: {color}; margin-bottom: 20px; }}
      .cover h1 {{ font-size: 26px; color: {color}; margin-bottom: 8px; }}
      .cover .meta {{ color: #7a8ba0; font-size: 13px; }}
      .section {{ padding: 32px 48px; }}
      .section h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: {color}; margin-bottom: 16px; }}
      table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
      th {{ text-align: left; padding: 9px 12px; background: #162036; color: #7a8ba0; font-size: 11px; text-transform: uppercase; }}
      td {{ padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #e8edf5; }}
      .footer {{ padding: 20px 48px; color: #7a8ba0; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.07); }}
    </style></head><body>

    <div class="cover">
      <div class="score-circle">{analysis.overall_score}</div>
      <h1>{title}</h1>
      <div class="meta">
        Territory: {t.name if t else '—'} &nbsp;·&nbsp;
        Period: {analysis.date_from} → {analysis.date_to} &nbsp;·&nbsp;
        Status: <strong style="color:{color}">{analysis.label}</strong>
      </div>
    </div>

    <div class="section">
      <h2>Air Quality Metrics vs WHO Guidelines</h2>
      <table>
        <tr><th>Pollutant</th><th>Measured (μg/m³)</th><th>WHO Limit</th><th>Status</th></tr>
        {rows}
      </table>
    </div>

    {ai_section}

    <div class="footer">
      Data: Open-Meteo Air Quality API (Copernicus CAMS) &nbsp;·&nbsp;
      AI: DeepSeek / ChatGPT &nbsp;·&nbsp;
      Sputnik Eco Platform &nbsp;·&nbsp;
      Generated {analysis.created_at.strftime('%Y-%m-%d')}
    </div>
    </body></html>"""

    path = f"{REPORTS_DIR}/report_{analysis.id}.pdf"
    HTML(string=html).write_pdf(path)
    return path
