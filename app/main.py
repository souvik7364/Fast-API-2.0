import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import post, user, auth, vote, follow, reply
from .config import settings

print(settings.database_username)

#models.Base.metadata.create_all(bind=engine)

app = FastAPI()

local_origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]
configured_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
origins = list(dict.fromkeys([*local_origins, *configured_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(post.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(vote.router)
app.include_router(follow.router)
app.include_router(reply.router)

@app.get("/")
def root():
    return{"message":"Welcome to my website"}
