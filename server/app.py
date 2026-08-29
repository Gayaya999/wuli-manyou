#!/usr/bin/env python3
"""Scientist archive agent for Quantum Odyssey.

Run from the repo root:

    python3 -m pip install -r server/requirements.txt
    python3 -m uvicorn server.app:app --reload --port 8787

Then open the site as usual. The exhibition page reads
`data-scientist-agent-api="http://127.0.0.1:8787"`.

Put the Model Studio key in `.env` (never in the frontend):

    DASHSCOPE_API_KEY=sk-...
    DASHSCOPE_BASE_URL=https://....maas.aliyuncs.com/compatible-mode/v1
    DASHSCOPE_MODEL=qwen3.8-flash

Preset archive questions are answered from data/scientist-agents.json.
Free-text questions call the configured compatible-mode chat model.
"""

from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = ROOT / "data" / "scientist-agents.json"
ARCHIVE = json.loads(ARCHIVE_PATH.read_text(encoding="utf-8"))
SCIENTISTS: dict = ARCHIVE["scientists"]
NOTE_RE = re.compile(r"\{[^{}]*\"title\"[^{}]*\}", re.S)


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

app = FastAPI(title="Quantum Odyssey Scientist Agent", version=str(ARCHIVE.get("version", 1)))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


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
        with urllib.request.urlopen(request, timeout=60, context=ssl_context()) as response:
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
    payload["systemPrompt"] = profile["systemPrompt"]
    return payload


@app.post("/api/scientists/{scientist_id}/chat", response_model=ChatOut)
def scientist_chat(scientist_id: str, body: ChatIn) -> ChatOut:
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

    knowledge = "\n".join(f"- {item}" for item in profile["knowledge"])
    system = (
        f"{profile['systemPrompt']}\n\n"
        f"知识要点：\n{knowledge}\n"
        f"边界：{profile['historicalBoundary']}"
    )
    try:
        raw = call_qwen(system, message)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    answer, note = split_answer_and_note(raw, fallback, "FX")
    if not answer:
        answer = raw.strip()
    return ChatOut(scientistId=scientist_id, answer=answer, note=note, source="qwen")
