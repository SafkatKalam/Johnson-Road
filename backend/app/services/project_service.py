from sqlalchemy.orm import Session

from app.database.models import Project
from app.schemas.project import ProjectCreate


def create_project(db: Session, project: ProjectCreate):
    db_project = Project(
        name=project.name,
        location=project.location,
        road_name=project.road_name,
        description=project.description,
    )

    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    return db_project


def get_projects(db: Session):
    return db.query(Project).order_by(Project.created_at.desc()).all()