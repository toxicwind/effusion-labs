import os

PORT = int(os.getenv("PORT", "49159"))
TZ = os.getenv("TZ", "UTC")
AUTH_USER = os.getenv("AUTH_USER", "toxic")
AUTH_PASS = os.getenv("AUTH_PASS", "Ann3xx!5G7e5Bmx")
SOLVER_URL = os.getenv("SOLVER_URL", "http://solver:8191/v1")
READABILITY_DEFAULT = os.getenv("READABILITY_DEFAULT", "1") == "1"
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "70.0"))  # seconds
