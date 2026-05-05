"""
fix_ocr_artifacts.py
Cleans OCR exam-artifact noise from questions.json:
  1. For questions with a clean duplicate in questions.json → copy question_text + choices
  2. For questions found in raw source files → use clean raw data
  3. Remaining questions → regex-strip artifacts from question_text only
Also recovers q00290/q00366 (question text completely lost → set to known question).
"""
import json, os, re, shutil
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QS_PATH = os.path.join(ROOT, 'web/public/data/questions.json')
RAW_DIR = os.path.join(ROOT, 'tools/raw')

# ── Load data ──────────────────────────────────────────────────────────────────
qs = json.load(open(QS_PATH, encoding='utf-8'))
q_by_id = {q['id']: q for q in qs}

all_raw = []
for fname in sorted(os.listdir(RAW_DIR)):
    if not fname.endswith('.json'):
        continue
    try:
        data = json.load(open(os.path.join(RAW_DIR, fname), encoding='utf-8'))
        if isinstance(data, list):
            all_raw.extend(data)
    except Exception:
        pass
raw_by_id = {item.get('raw_id', ''): item for item in all_raw}


# ── Helpers ────────────────────────────────────────────────────────────────────
ARTIFACT_PATTERNS = [
    r'\s*(Correct|Incorrect)\s+Mark\s+\d+\.\d+\s+out\s+of(\s+1\.00)?',
    r'\s*Mark\s+\d+\.\d+\s+out\s+of(\s+1\.00)?',
    r'\s*Not answered\s+Marked\s+out\s+of',
    r'\s*Incorrect\s*/9.*',
    r'\s*/9\s+\d+/\s*\d+/\d+.*',
    r'\s*Your answer is (in)?correct\.?',
    r'\s*Question\s+\d+\s*$',
]

def clean_question_text(t):
    for pat in ARTIFACT_PATTERNS:
        t = re.sub(pat, '', t, flags=re.IGNORECASE | re.DOTALL)
    return t.strip()

def clean_raw_question_text(t):
    """Extra cleaning for raw source text which has test-system prefixes."""
    t = re.sub(r'^(Not flagged\s*){1,3}(Flag question\s*|Remove flag\s*)?', '', t).strip()
    t = re.sub(r'^(Flagged\s*){1,3}(Remove flag\s*)?', '', t).strip()
    t = re.sub(r'^\s*(Đúng|Sai)\s+', '', t).strip()
    return clean_question_text(t)

def clean_choice_text(t):
    t = re.sub(r'\s*Your answer is (in)?correct\.?', '', t, flags=re.IGNORECASE).strip()
    return t

def norm(t):
    t = clean_question_text(t)
    return re.sub(r'\s+', ' ', t.strip().lower())[:200]

def has_artifact(q):
    flags = ['Correct Mark', 'Incorrect Mark', 'Mark 0.00', 'Mark 1.00',
             'Không trả lời', 'Not answered', '/9 19/', 'Your answer']
    text = q.get('question_text', '') + ' '.join(c.get('text', '') for c in q.get('choices', []))
    return any(f in text for f in flags)

def choices_ok(q):
    """Return True if none of the choices contain OCR-merged junk."""
    for c in q.get('choices', []):
        t = c.get('text', '')
        # Merged choices often have patterns like " b. text" or " c. text" inside them
        if re.search(r'\s[b-f]\.\s+\S', t):
            return False
        if 'Your answer is' in t:
            return False
    return True

def raw_choices_to_clean(raw_item):
    """Convert raw item choices to the {label, text} format used in questions.json."""
    out = []
    for c in raw_item.get('choices', []):
        out.append({'label': c['label'], 'text': c['text']})
    return out


# ── Build duplicate-pair mapping for Group 1 ──────────────────────────────────
# For each artifact question, check if there is a non-artifact duplicate
groups = defaultdict(list)
for q in qs:
    key = norm(q.get('question_text', ''))
    if key:
        groups[key].append(q['id'])

artifact_ids = {q['id'] for q in qs if has_artifact(q)}

peer_fixes = {}   # artifact_id → clean_peer_id
for qid in artifact_ids:
    q = q_by_id[qid]
    key = norm(q['question_text'])
    group = groups[key]
    clean_peers = [pid for pid in group if pid != qid and pid not in artifact_ids]
    if clean_peers:
        # Pick the peer with highest confidence
        best = max(clean_peers, key=lambda pid: q_by_id[pid].get('confidence', 0))
        peer_fixes[qid] = best


# ── Explicit raw-source fixes for questions with no clean peer ─────────────────
RAW_FIXES = {
    'q00370': 'Trắc nghiệm đã gộp#p33q13',
    'q00394': 'Hoa lần 1#p12q22',
    'q00405': 'Trắc nghiệm đã gộp#p13q21',
    'q00076': 'Phao-tổng-hợp#p66q25',
    'q00367': 'Trắc nghiệm đã gộp#p6q2',
    'q00379': 'TestBank1#p18q1',
    'q00369': 'Hoa lần 1#p8q14',
    'q00403': 'Hoa lần 1#p4q5',
    'q00383': 'Hoa lần 1#p9q17',
    'q00363': 'TestBank1#p72q4',
    'q00392': 'Hoa lần 1#p5q6',
    # q00398 intentionally excluded - raw has a different semaphore variant; use regex-clean instead
    'q00404': 'TestBank1#p9q19',
    'q00371': 'TestBank1#p10q20',
    'q00380': 'TestBank1#p10q20',
    'q00388': 'Trắc nghiệm đã gộp#p47q7',  # choices OK in current, just clean Q text
}

# ── Recovered lost question texts ──────────────────────────────────────────────
# q00290 and q00366: question_text completely lost; multiple sources confirm answer=Round Robin
RECOVERED_QT = {
    'q00290': 'Thuật toán lập lịch CPU nào có thời gian phản hồi trung bình tốt nhất?',
    'q00366': 'Thuật toán lập lịch CPU nào có thời gian phản hồi trung bình tốt nhất?',
}

# ── Apply fixes ───────────────────────────────────────────────────────────────
fixed = 0
skipped = 0

for q in qs:
    qid = q['id']

    # Recovered lost texts
    if qid in RECOVERED_QT:
        q['question_text'] = RECOVERED_QT[qid]
        q['needs_review'] = True
        fixed += 1
        continue

    if not has_artifact(q):
        continue  # nothing to do

    # Group 1: clean peer exists in questions.json
    if qid in peer_fixes:
        peer = q_by_id[peer_fixes[qid]]
        q['question_text'] = peer['question_text']
        q['choices'] = [{'label': c['label'], 'text': c['text']} for c in peer['choices']]
        fixed += 1
        continue

    # Group 2: found in raw source files
    if qid in RAW_FIXES:
        raw_item = raw_by_id.get(RAW_FIXES[qid])
        if raw_item:
            q['question_text'] = clean_raw_question_text(raw_item['question_text'])
            # Only replace choices if current choices have OCR junk; otherwise keep.
            if not choices_ok(q) or len(q.get('choices', [])) != len(raw_item.get('choices', [])):
                q['choices'] = raw_choices_to_clean(raw_item)
            else:
                # Still clean choice texts individually
                for c in q.get('choices', []):
                    c['text'] = clean_choice_text(c['text'])
            fixed += 1
            continue

    # Group 3: regex-clean question_text, clean individual choice texts
    q['question_text'] = clean_question_text(q['question_text'])
    for c in q.get('choices', []):
        c['text'] = clean_choice_text(c['text'])
    # Also strip "Không trả lời" prefix
    q['question_text'] = re.sub(r'^Không trả lời\s+', '', q['question_text']).strip()
    fixed += 1

# Backup and save
shutil.copy(QS_PATH, QS_PATH + '.bak2')
json.dump(qs, open(QS_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'Fixed {fixed} questions (skipped {skipped})')
print(f'Backup at {QS_PATH}.bak2')
