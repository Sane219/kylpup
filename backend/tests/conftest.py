import sys
from pathlib import Path

# make `app` and `scripts` importable when running pytest from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
