# server/backend/run.py

import uvicorn
from decouple import config

if __name__ == "__main__":
    # Read host and port from .env file, with defaults
    host = config('BACKEND_HOST', default='0.0.0.0')
    port = config('BACKEND_PORT', default=8000, cast=int)
    
    # Check if debug mode is on to enable reload
    reload = config('DEBUG', default=False, cast=bool)

    uvicorn.run(
        "backend.asgi:application",
        host=host,
        port=port,
        reload=reload
    )