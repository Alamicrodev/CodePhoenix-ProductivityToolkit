from fastapi import APIRouter

router = APIRouter(tags=["health"])  #health tag applies to all routes using this router

#Health check path operation
@router.get("/health")
def health_check() -> dict[str, str]:         #returns a dictionary where keys and values are strings
    return {"status": "ok", "service": "backend"}

