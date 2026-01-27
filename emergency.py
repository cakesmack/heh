from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "We are undergoing maintenance. Back shortly!"}
