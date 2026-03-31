# Analysis Service - 今後実装予定
# FastAPI ベースの分析サービス

from fastapi import FastAPI

app = FastAPI(title="Knowledge Bot Analysis Service")


@app.get("/health")
def health():
    return {"status": "ok"}
