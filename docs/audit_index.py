import json, os, fnmatch
d = json.load(open('docs/knowledge-index.json', encoding='utf-8'))
indexed = {e['path'].replace(os.sep, '/') for e in d['index']}
actual = set()
SKIP = {'node_modules', '.git', 'target', 'dist', '.obsidian', '__pycache__', '.vite', '.claude'}
GLOBS = ('*.java', '*.tsx', '*.ts', '*.md', '*.jsx', '*.js', '*.yml', '*.sql', '*.css', '*.html', '*.xml', '*.json', '*.config', '*.py')
for root, dirs, files in os.walk('.'):
    dirs[:] = [x for x in dirs if x not in SKIP]
    for f in files:
        p = os.path.relpath(os.path.join(root, f)).replace(os.sep, '/')
        if any(fnmatch.fnmatch(f, g) for g in GLOBS):
            actual.add(p)
IGNORE = {'frontend/package-lock.json', 'knowledge-index.json'}  # lockfile noise + stale root duplicate (pending deletion)
missing = sorted(a for a in actual if a not in indexed and a not in IGNORE)
stale = sorted(i for i in indexed if i not in actual and not i.startswith('.claude'))
print("MISSING FROM INDEX:", len(missing))
for m in missing:
    print(" ", m)
print("STALE (in index, not on disk):", len(stale))
for s in stale:
    print(" ", s)
