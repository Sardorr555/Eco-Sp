from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    company = Column(String)
    plan = Column(String, default="free")  # free / pro
    created_at = Column(DateTime, default=datetime.utcnow)
    territories = relationship("Territory", back_populates="user")

class Territory(Base):
    __tablename__ = "territories"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    geojson = Column(Text)          # GeoJSON polygon string
    centroid_lat = Column(Float)    # calculated centroid
    centroid_lon = Column(Float)
    area_km2 = Column(Float)
    color = Column(String, default="#00c9a7")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="territories")
    analyses = relationship("Analysis", back_populates="territory")

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True)
    territory_id = Column(Integer, ForeignKey("territories.id"))
    date_from = Column(String)
    date_to = Column(String)
    status = Column(String, default="done")  # done / error
    # Pollutants (μg/m³)
    pm25 = Column(Float)
    pm10 = Column(Float)
    no2  = Column(Float)
    so2  = Column(Float)
    co   = Column(Float)
    o3   = Column(Float)
    # Derived
    overall_score = Column(Integer)   # 0–100
    label = Column(String)            # Excellent/Good/Moderate/Poor/Hazardous
    
    # AI fields
    ai_summary = Column(Text)
    ai_risk_level = Column(String)
    ai_recommendations = Column(Text) # JSON string
    ai_health_impact = Column(Text)
    ai_main_pollutant = Column(String)
    ai_trend = Column(Text)
    ai_trend_direction = Column(String)
    ai_forecast = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    territory = relationship("Territory", back_populates="analyses")
    report = relationship("Report", back_populates="analysis", uselist=False)

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    pdf_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    analysis = relationship("Analysis", back_populates="report")
