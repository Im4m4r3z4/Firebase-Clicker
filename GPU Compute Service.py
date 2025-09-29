import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn

EXPECTED_TOKEN = os.getenv("GPU_SERVICE_TOKEN", "your-super-secret-token")

auth_scheme = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    if not credentials or credentials.scheme != "Bearer" or credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            details="Invalid or missing authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return credentials

class ComputeRequest(BaseModel):
    userId: string
    usercount: int

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "GPU Service is running"}

@app.post("/compute")
async def run_compute(
    request: ComputeRequest,
    token: HTTPAuthorizationCredentials = Depends(verify_token())
):

    print(f"Received compute request for user: {request.userId}")
    print(f"Current click count: {request.usercount}")

    print("Simutating lightweight GPU compute... done.")

    return{
    "message": "Compute task received successfully",
    "userId": request.userId,
    "status": "processed"
}

if __name__ == "__main__":
    port = int(os.getenv("PORT, 8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)