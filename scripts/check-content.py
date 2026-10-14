from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
pattern=re.compile(r"開発前|開発中|コンセプト|coming[ -]soon|in development|under development|prototype|concept",re.I)
for path in [*root.glob("*.html"),root/"language.js"]:
    assert not pattern.search(path.read_text()), str(path)
assert "WAITING LIST" in (root/"index.html").read_text()
print("PASS: bilingual status-copy guard and waiting list")
