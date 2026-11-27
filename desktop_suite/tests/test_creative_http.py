"""HTTP contracts against real Flask routes, with isolated synthetic storage."""
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import app_engine as engine

BODY = {"kind":"Lore","name":"Test lore","era":"Era","canon":"Draft","body":"Text"}
ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = "/api/bible"
BASE = "http://127.0.0.1:8765"

class HTTPTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = pathlib.Path(temp.name) / "records.json"
        p = patch.object(engine, "_db", return_value=self.path)
        p.start()
        self.addCleanup(p.stop)
        self.client = engine.create_app(8765, ROOT, json.loads((ROOT/"app_meta.json").read_text())).test_client()

    def test_post_and_read_back(self):
        response = self.client.post(URL, json=BODY, base_url=BASE)
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json["ok"], True)
        got = self.client.get(URL, base_url=BASE)
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.json["entries"][0]["name"], BODY["name"])

    def test_corrupt_store_blocks_get_post_and_health(self):
        self.path.write_bytes(b"broken")
        self.assertEqual(self.client.get(URL, base_url=BASE).status_code, 503)
        self.assertEqual(self.client.post(URL, json=BODY, base_url=BASE).status_code, 503)
        self.assertEqual(self.client.get("/api/health", base_url=BASE).status_code, 503)
        self.assertEqual(self.path.read_bytes(), b"broken")

    def test_cross_origin_and_wrong_host(self):
        self.assertEqual(self.client.post(URL, json=BODY, base_url=BASE, headers={"Origin":"https://other.invalid"}).status_code, 403)
        self.assertEqual(self.client.get(URL, base_url="http://other.invalid").status_code, 403)
        self.assertFalse(self.path.exists())

    def test_bad_json_and_content_type(self):
        self.assertEqual(self.client.post(URL, data="bad", base_url=BASE).status_code, 415)
        self.assertEqual(self.client.post(URL, json=[], base_url=BASE).status_code, 400)
        self.assertFalse(self.path.exists())

    def test_health_not_full_engine_claim(self):
        r = self.client.get("/api/health", base_url=BASE)
        self.assertEqual(r.status_code, 200)
        self.assertIs(r.json["full_engine_integrated"], False)

if __name__ == "__main__":
    unittest.main()
