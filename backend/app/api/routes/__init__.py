from app.api.routes import auth, dashboard, focus_sessions, habits, health, tasks

#__init__.py tells python that this directory is a package. (deprecated in latest version python 3.3+)



__all__ = ["auth", "dashboard", "focus_sessions", "habits", "health", "tasks"] #if someone imports * from app/api/routes import these files.

