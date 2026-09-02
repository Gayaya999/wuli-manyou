import os
import unittest
from unittest.mock import patch

os.environ.setdefault("WULI_ALLOWED_HOSTS", "testserver,127.0.0.1,localhost")
os.environ.setdefault("WULI_ALLOWED_ORIGINS", "http://testserver")
os.environ.setdefault("WULI_RATE_PER_MINUTE", "1")
os.environ.setdefault("WULI_IP_DAILY_LIMIT", "2")
os.environ.setdefault("WULI_GLOBAL_DAILY_LIMIT", "3")
os.environ.setdefault("DASHSCOPE_API_KEY", "test-only")

from fastapi.testclient import TestClient

from server import app as app_module


class AgentApiTests(unittest.TestCase):
    def setUp(self):
        app_module.USAGE.minute.clear()
        app_module.USAGE.daily.clear()
        app_module.USAGE.global_daily.clear()
        self.client = TestClient(app_module.app)

    def test_public_profile_never_exposes_internal_prompt(self):
        response = self.client.get("/api/scientists/newton")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("systemPrompt", response.json())

    def test_fixed_question_uses_archive_without_ai(self):
        question = app_module.SCIENTISTS["newton"]["prompts"][0]["question"]
        with patch.object(app_module, "call_qwen", side_effect=AssertionError("AI must not run")):
            response = self.client.post("/api/scientists/newton/chat", json={"message": question})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "archive")

    def test_ai_rate_limit_falls_back_instead_of_spending_again(self):
        model_text = '这是测试回答。\n{"title":"测试","formula":"F","summary":"S","keywords":[]}'
        with patch.object(app_module, "call_qwen", return_value=model_text):
            first = self.client.post("/api/scientists/newton/chat", json={"message": "请谈一个档案没有写过的自由问题A"})
            second = self.client.post("/api/scientists/newton/chat", json={"message": "请谈一个档案没有写过的自由问题B"})
        self.assertEqual(first.json()["source"], "qwen")
        self.assertEqual(second.json()["source"], "quota-fallback")

    def test_security_headers_and_input_limit(self):
        response = self.client.get("/api/scientists")
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        oversized = self.client.post("/api/scientists/newton/chat", json={"message": "x" * 501})
        self.assertEqual(oversized.status_code, 422)


if __name__ == "__main__":
    unittest.main()
