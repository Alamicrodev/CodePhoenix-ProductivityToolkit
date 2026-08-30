from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router              
from app.core.config import get_settings


settings = get_settings()   
app = FastAPI(title=settings.app_name)

# put middleware here 
app.add_middleware(
    CORSMiddleware,      
    allow_origins=settings.cors_origins,
    allow_credentials=True,     #allows sending sensitive data like cookies from server to a client of different origin
    allow_methods=["*"],      
    allow_headers=["*"],      
)


# main router along with prefix 
app.include_router(api_router, prefix=settings.api_v1_prefix)



@app.get("/", tags=["root"])     #tags are used in FASTAPI to group routes in auto-generated swagger docs 
def root() -> dict[str, str]:    #this is called a Route Handler Function or Path operation function
    return {"message": settings.app_name}

#How is the decorator intaking arguments? Don't fall into the trap!!!
# app.get() is not a decorator, it returns some decorator lets call it X 
# so it becomes @X 
# the X then wraps the root() controller(Route Handler Function).  