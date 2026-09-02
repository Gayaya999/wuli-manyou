#!/usr/bin/env python3
"""Scientist archive agent for Quantum Odyssey.

Run from the repo root:

    python3 -m pip install -r server/requirements.txt
    python3 -m uvicorn server.app:app --reload --port 8787

The exhibition always calls the same-origin `/api` path. During development,
proxy that path to port 8787; production Nginx uses the supplied template.

Put the Model Studio key in `.env` (never in the frontend):

    DASHSCOPE_API_KEY=sk-...
    DASHSCOPE_BASE_URL=https://....maas.aliyuncs.com/compatible-mode/v1
    DASHSCOPE_MODEL=qwen3.8-flash

Preset archive questions are answered from data/scientist-agents.json.
Free-text questions call the configured compatible-mode chat model.
"""

from __future__ import annotations

import json
import logging
import os
import re
import secrets
import ssl
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = ROOT / "data" / "scientist-agents.json"
ARCHIVE = json.loads(ARCHIVE_PATH.read_text(encoding="utf-8"))
SCIENTISTS: dict = ARCHIVE["scientists"]
NOTE_RE = re.compile(r"\{[^{}]*\"title\"[^{}]*\}", re.S)
LOGGER = logging.getLogger("wuli.agent")


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def completions_url() -> str:
    base = os.environ.get(
        "DASHSCOPE_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ).strip().rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def api_key() -> str:
    return os.environ.get("DASHSCOPE_API_KEY", "").strip()


load_dotenv(ROOT / ".env")

ALLOWED_ORIGINS = [item.strip() for item in os.environ.get("WULI_ALLOWED_ORIGINS", "http://127.0.0.1:4176,http://localhost:4176").split(",") if item.strip()]
ALLOWED_HOSTS = [item.strip() for item in os.environ.get("WULI_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if item.strip()]
RATE_PER_MINUTE = int(os.environ.get("WULI_RATE_PER_MINUTE", "10"))
IP_DAILY_LIMIT = int(os.environ.get("WULI_IP_DAILY_LIMIT", "60"))
GLOBAL_DAILY_LIMIT = int(os.environ.get("WULI_GLOBAL_DAILY_LIMIT", "500"))
AI_TIMEOUT_SECONDS = min(45, max(5, int(os.environ.get("WULI_AI_TIMEOUT_SECONDS", "20"))))
AI_MAX_TOKENS = min(1000, max(100, int(os.environ.get("WULI_AI_MAX_TOKENS", "500"))))
AI_MAX_OUTPUT_CHARS = min(6000, max(400, int(os.environ.get("WULI_AI_MAX_OUTPUT_CHARS", "2400"))))


class UsageGate:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.minute: dict[str, deque[float]] = defaultdict(deque)
        self.daily: dict[tuple[str, str], int] = defaultdict(int)
        self.global_daily: dict[str, int] = defaultdict(int)

    def consume(self, key: str) -> tuple[bool, str]:
        now = time.time()
        day = datetime.now(UTC).date().isoformat()
        with self.lock:
            queue = self.minute[key]
            while queue and queue[0] < now - 60:
                queue.popleft()
            if len(queue) >= RATE_PER_MINUTE:
                return False, "提问太快了，请稍后再试"
            if self.daily[(day, key)] >= IP_DAILY_LIMIT:
                return False, "今天的个人 AI 额度已经用完"
            if self.global_daily[day] >= GLOBAL_DAILY_LIMIT:
                return False, "今天的全站 AI 额度已经用完"
            queue.append(now)
            self.daily[(day, key)] += 1
            self.global_daily[day] += 1
        return True, ""


USAGE = UsageGate()

app = FastAPI(title="Quantum Odyssey Scientist Agent", version=str(ARCHIVE.get("version", 1)))
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", "")[:64] or secrets.token_hex(8)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    return response


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class ChatOut(BaseModel):
    scientistId: str
    answer: str
    note: dict
    source: str


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def get_scientist(scientist_id: str) -> dict:
    profile = SCIENTISTS.get(scientist_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Unknown scientist: {scientist_id}")
    return profile


def match_prompt(profile: dict, message: str) -> dict | None:
    needle = compact(message)
    if not needle:
        return None
    for prompt in profile["prompts"]:
        question = compact(prompt["question"])
        if needle == question or needle in question or question in needle:
            return prompt
    return None


def split_answer_and_note(text: str, fallback_note: dict, index: str) -> tuple[str, dict]:
    blob = None
    answer = text.strip()
    marker = answer.rfind("\n{")
    if marker != -1:
        blob = answer[marker + 1 :].strip()
        answer = answer[:marker].strip()
    else:
        match = NOTE_RE.search(answer)
        if match:
            blob = match.group(0)
            answer = f"{answer[:match.start()]}{answer[match.end():]}".strip()
    if not blob:
        return answer, fallback_note
    try:
        note = json.loads(blob)
    except json.JSONDecodeError:
        return text.strip(), fallback_note
    note.setdefault("index", index)
    note.setdefault("title", fallback_note.get("title", ""))
    note.setdefault("formula", fallback_note.get("formula", ""))
    note.setdefault("summary", fallback_note.get("summary", ""))
    note.setdefault("keywords", fallback_note.get("keywords", []))
    if not isinstance(note.get("keywords"), list):
        note["keywords"] = fallback_note.get("keywords", [])
    return answer, note


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def call_qwen(system: str, user: str) -> str:
    key = api_key()
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")
    payload = json.dumps(
        {
            "model": os.environ.get("DASHSCOPE_MODEL", "qwen3.8-flash"),
            "temperature": 0.4,
            "enable_thinking": False,
            "max_tokens": AI_MAX_TOKENS,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        completions_url(),
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=AI_TIMEOUT_SECONDS, context=ssl_context()) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"Qwen HTTP {error.code}: {detail[:300]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Qwen unreachable: {error.reason}") from error
    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError(f"Qwen response missing content: {str(body)[:300]}") from error


def public_profile(profile: dict) -> dict:
    return {
        "id": profile["id"],
        "displayName": profile["displayName"],
        "latinName": profile["latinName"],
        "domain": profile["domain"],
        "lifespan": profile["lifespan"],
        "scope": profile["scope"],
        "historicalBoundary": profile["historicalBoundary"],
        "prompts": [
            {"id": item["id"], "question": item["question"]}
            for item in profile["prompts"]
        ],
    }


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "scientists": list(SCIENTISTS),
        "llm": bool(api_key()),
        "model": os.environ.get("DASHSCOPE_MODEL", "qwen3.8-flash"),
    }


@app.get("/api/scientists")
def list_scientists() -> dict:
    return {"scientists": [public_profile(item) for item in SCIENTISTS.values()]}


@app.get("/api/scientists/{scientist_id}")
def scientist_profile(scientist_id: str) -> dict:
    profile = get_scientist(scientist_id)
    payload = public_profile(profile)
    payload["knowledge"] = profile["knowledge"]
    payload["formulas"] = profile["formulas"]
    return payload


def client_key(request: Request) -> str:
    if os.environ.get("WULI_TRUST_PROXY_HEADERS") == "1":
        forwarded = request.headers.get("X-Real-IP", "").strip()
        if forwarded:
            return forwarded[:64]
    return (request.client.host if request.client else "unknown")[:64]


@app.post("/api/scientists/{scientist_id}/chat", response_model=ChatOut)
def scientist_chat(scientist_id: str, body: ChatIn, request: Request) -> ChatOut:
    profile = get_scientist(scientist_id)
    message = body.message.strip()
    matched = match_prompt(profile, message)
    if matched:
        return ChatOut(
            scientistId=scientist_id,
            answer=matched["answer"],
            note=matched["note"],
            source="archive",
        )

    fallback = profile["defaultNote"]
    if not api_key():
        return ChatOut(
            scientistId=scientist_id,
            answer=(
                f"{profile['greeting']} 自由提问需要接入模型。"
                "现在请先从我已经写在档案里的问题开始，那些答案是针对我自己工作的。"
            ),
            note=fallback,
            source="archive-fallback",
        )

    allowed, reason = USAGE.consume(client_key(request))
    if not allowed:
        LOGGER.info(json.dumps({"event": "ai-quota-fallback", "scientist": scientist_id, "reason": reason}, ensure_ascii=False))
        return ChatOut(
            scientistId=scientist_id,
            answer=f"{reason}。我先把你带回已经核对过的馆藏问题。",
            note=fallback,
            source="quota-fallback",
        )

    knowledge = "\n".join(f"- {item}" for item in profile["knowledge"])
    system = (
        f"{profile['systemPrompt']}\n\n"
        f"知识要点：\n{knowledge}\n"
        f"边界：{profile['historicalBoundary']}"
    )
    try:
        raw = call_qwen(system, message)
    except RuntimeError as error:
        LOGGER.warning(json.dumps({"event": "ai-call-failed", "scientist": scientist_id, "error": str(error)[:180]}, ensure_ascii=False))
        return ChatOut(
            scientistId=scientist_id,
            answer="模型通信暂时中断。我先不编造答案，请从上方已经核对过的馆藏问题继续。",
            note=fallback,
            source="ai-fallback",
        )
    answer, note = split_answer_and_note(raw, fallback, "FX")
    if not answer:
        answer = raw.strip()
    answer = answer[:AI_MAX_OUTPUT_CHARS]
    LOGGER.info(json.dumps({"event": "ai-answer", "scientist": scientist_id, "characters": len(answer)}, ensure_ascii=False))
    return ChatOut(scientistId=scientist_id, answer=answer, note=note, source="qwen")
