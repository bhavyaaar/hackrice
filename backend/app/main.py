from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agents, documents, purchases
from app.routers import student as student_router

app = FastAPI(title="Northstar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(student_router.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "northstar"}
