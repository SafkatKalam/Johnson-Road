from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    location = Column(String, nullable=True)

    road_name = Column(String, nullable=True)

    description = Column(String, nullable=True)

    media_type = Column(String, nullable=True)

    media_path = Column(String, nullable=True)

    status = Column(String, default="Created")

    roi_completed = Column(Boolean, default=False)

    analysis_completed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )