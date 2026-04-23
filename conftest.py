"""Test configuration with isolated in-memory SQLite."""
import os
import pathlib
import pytest

# Must set before any app imports
os.environ["DATABASE_URL"] = "sqlite:///./eduguard_test.db"
os.environ["SECRET_KEY"] = "test-secret-1234567890abcdef1234567890abcdef"
os.environ["TESTING"] = "1"

# Wipe test DB before anything starts
p = pathlib.Path("eduguard_test.db")
if p.exists():
    p.unlink()
