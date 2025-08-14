from fastapi import HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from . import settings

security = HTTPBasic()

def require_auth(credentials: HTTPBasicCredentials):
    if credentials.username != settings.AUTH_USER or credentials.password != settings.AUTH_PASS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
