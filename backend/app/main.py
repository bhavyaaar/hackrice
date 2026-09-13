from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


@app.exception_handler(Exception)
async def unhandled_error(_request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return JSONResponse({"detail": f"{type(exc).__name__}: {exc}"}, status_code=500)

app.include_router(student_router.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "northstar"}
