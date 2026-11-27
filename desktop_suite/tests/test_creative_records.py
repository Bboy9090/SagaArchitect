import concurrent.futures
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import app_engine as engine

BODY = {"kind":"Character","name":"Test Hero","era":"First era","canon":"Locked","body":"Original text <img src=x onerror=alert(1)>"}
def rows(data):
    return data["entries"]

class RecordsTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = pathlib.Path(temp.name) / "records.json"
        p = patch.object(engine, "_db", return_value=self.path)
        p.start()
        self.addCleanup(p.stop)

    def load(self):
        return engine.load_bible()

    def test_missing_store_does_not_create_file(self):
        self.assertEqual(rows(self.load()), [])
        self.assertFalse(self.path.exists())

    def test_exact_author_text_round_trip_and_unique_ids(self):
        a = engine.save_record(BODY)
        b = engine.save_record(BODY)
        self.assertEqual(len(rows(b)), 2)
        self.assertNotEqual(rows(a)[0]["id"], rows(b)[0]["id"])
        self.assertEqual(self.load(), b)
        self.assertEqual(rows(b)[0]["body"], BODY["body"])

    def test_legacy_record_and_extra_fields_preserved(self):
        old = engine.new_entry(BODY)
        old["id"] = "legacy1"
        old["extra"] = "keep this"
        data = engine.empty()
        rows(data).append(old)
        self.path.write_text(json.dumps(data))
        new = engine.save_record(BODY)
        self.assertEqual(rows(new)[1], old)

    def test_corrupt_original_never_overwritten(self):
        for bad in (b'{broken', b'null', b'{"entries":[],"entries":[]}', b'\xff'):
            self.path.write_bytes(bad)
            with self.assertRaises(engine.RecordError):
                engine.save_record(BODY)
            self.assertEqual(self.path.read_bytes(), bad)
            self.assertFalse(self.path.with_name("records.json.write-lock").exists())

    def test_wrong_schema_never_overwritten(self):
        self.path.write_text("{\"universe\":\"Name\",\"entries\":[{\"id\":\"broken\"}]}")
        original = self.path.read_bytes()
        with self.assertRaises(engine.RecordError):
            engine.save_record(BODY)
        self.assertEqual(self.path.read_bytes(), original)

    def test_invalid_input_does_not_create_store(self):
        with self.assertRaises(engine.RecordError):
            engine.save_record(dict(BODY, name=""))
        self.assertFalse(self.path.exists())

    def test_lock_conflict_preserves_store(self):
        engine.save_record(BODY)
        before = self.path.read_bytes()
        lock = self.path.with_name("records.json.write-lock")
        lock.touch()
        with self.assertRaises(engine.RecordError):
            engine.save_record(BODY)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertTrue(lock.exists())

    def test_replace_failure_preserves_original(self):
        engine.save_record(BODY)
        before = self.path.read_bytes()
        with patch.object(engine.os, "replace", side_effect=OSError("injected failure")):
            with self.assertRaises(OSError):
                engine.save_record(BODY)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_concurrent_saves_never_silently_drop_accepted_records(self):
        def attempt(i):
            try:
                engine.save_record(dict(BODY, name=str(i)))
                return str(i)
            except engine.RecordError:
                return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            accepted = {x for x in pool.map(attempt, range(24)) if x is not None}
        self.assertTrue(accepted)
        self.assertEqual({r["name"] for r in rows(self.load())}, accepted)

    def test_symlink_rejected(self):
        target = self.path.parent / "original.json"
        target.write_text(json.dumps(engine.empty()))
        self.path.symlink_to(target)
        before = target.read_bytes()
        with self.assertRaises(engine.RecordError):
            engine.save_record(BODY)
        self.assertEqual(target.read_bytes(), before)

if __name__ == "__main__":
    unittest.main()
