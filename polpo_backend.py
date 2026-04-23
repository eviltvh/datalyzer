import json
import csv
import re
import math
import hashlib
from collections import defaultdict
from pathlib import Path

AUTH_FILE = Path(__file__).parent / "auth.json"


def load_auth():
    if not AUTH_FILE.exists():
        default = {"users": [{"username": "admin", "password": "changeme"}]}
        with open(AUTH_FILE, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2)
        return default["users"]
    with open(AUTH_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("users", [])


def verify_credentials(username, password):
    users = load_auth()
    for u in users:
        stored = u.get("password", "")
        if u.get("username") != username:
            continue
        if stored.startswith("sha256:"):
            expected = stored[7:]
            given = hashlib.sha256(password.encode()).hexdigest()
            if expected == given:
                return True
        else:
            if stored == password:
                return True
    return False


def parse_stats_csv(path):
    rows = []
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                r["profile_followers"] = int(r.get("profile_followers") or 0)
            except ValueError:
                r["profile_followers"] = 0
            try:
                r["profile_following"] = int(r.get("profile_following") or 0)
            except ValueError:
                r["profile_following"] = 0
            try:
                r["profile_ratio"] = float(r.get("profile_ratio") or 0)
            except ValueError:
                r["profile_ratio"] = 0.0
            try:
                r["days_active"] = int(r.get("days_active") or 0)
            except ValueError:
                r["days_active"] = 0
            m = str(r.get("mutual", "")).strip().lower()
            r["mutual"] = m in ("true", "1", "yes")
            rows.append(r)
    return rows


def parse_self_history(path):
    rows = []
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                r["followers"] = int(r.get("followers") or 0)
            except ValueError:
                r["followers"] = 0
            try:
                r["following"] = int(r.get("following") or 0)
            except ValueError:
                r["following"] = 0
            try:
                r["ratio"] = float(r.get("ratio") or 0)
            except ValueError:
                r["ratio"] = 0.0
            rows.append(r)
    return rows


def score_username(u):
    u = (u or "").lower()
    length = len(u)
    digits = len(re.findall(r"[0-9]", u))
    signs = len(re.findall(r"[^a-z0-9]", u))
    uncommon = len(re.findall(r"[ywz]", u))
    x_count = len(re.findall(r"x", u))
    repeat = 0
    for i in range(1, len(u)):
        if u[i] == u[i - 1] and u[i].isalpha():
            repeat += 1
    penalty = length * 3 + digits * 5 + signs * 5 + uncommon + x_count * 2 + repeat
    return max(0, min(100, 100 - penalty))


def filter_active(rows):
    return [
        r for r in rows
        if r.get("status") == "active"
        and r.get("origen")
        and r.get("origen") not in ("unknown", "@unknown")
    ]


def q1_mutuality_rate(rows):
    active = filter_active(rows)
    bucket = defaultdict(lambda: {"mutuals": 0, "total": 0})
    for r in active:
        o = r["origen"]
        bucket[o]["total"] += 1
        if r["mutual"]:
            bucket[o]["mutuals"] += 1
    result = []
    for o, d in bucket.items():
        if d["total"] < 2:
            continue
        rate = (d["mutuals"] / d["total"]) * 100
        result.append({
            "origen": o,
            "mutuals": d["mutuals"],
            "no_mutuals": d["total"] - d["mutuals"],
            "total": d["total"],
            "tasa_%": round(rate, 2),
        })
    result.sort(key=lambda x: x["tasa_%"], reverse=True)
    return result, ["origen", "mutuals", "no_mutuals", "total", "tasa_%"]


def q2_ratio_stats_by_origin(rows):
    active = filter_active(rows)
    bucket = defaultdict(list)
    usernames = defaultdict(dict)
    for r in active:
        if r["profile_ratio"] > 0:
            bucket[r["origen"]].append(r["profile_ratio"])
            if r["profile_ratio"] > usernames[r["origen"]].get("max", 0):
                usernames[r["origen"]] = {
                    "max": r["profile_ratio"],
                    "user": r.get("username", "—"),
                }
    result = []
    for o, ratios in bucket.items():
        if not ratios:
            continue
        result.append({
            "origen": o,
            "n": len(ratios),
            "ratio_avg": round(sum(ratios) / len(ratios), 4),
            "ratio_max": round(max(ratios), 4),
            "ratio_min": round(min(ratios), 4),
            "top_user": usernames[o]["user"],
        })
    result.sort(key=lambda x: x["ratio_avg"], reverse=True)
    return result, ["origen", "n", "ratio_avg", "ratio_max", "ratio_min", "top_user"]


def q3_ratio_distribution(rows):
    active = filter_active(rows)
    all_ratios = [r["profile_ratio"] for r in active if r["profile_ratio"] > 0]
    if not all_ratios:
        return [], ["bin", "mutuals", "no_mutuals", "total"]
    max_r = min(math.ceil(max(all_ratios)), 20)
    bin_size = 0.5 if max_r <= 5 else 1.0
    bin_count = math.ceil(max_r / bin_size) + 1
    mutuals_bins = [0] * bin_count
    ghosts_bins = [0] * bin_count
    for r in active:
        if r["profile_ratio"] <= 0:
            continue
        idx = min(int(r["profile_ratio"] / bin_size), bin_count - 1)
        if r["mutual"]:
            mutuals_bins[idx] += 1
        else:
            ghosts_bins[idx] += 1
    result = []
    for i in range(bin_count):
        lo, hi = i * bin_size, (i + 1) * bin_size
        result.append({
            "bin": f"{lo:.1f}-{hi:.1f}",
            "mutuals": mutuals_bins[i],
            "no_mutuals": ghosts_bins[i],
            "total": mutuals_bins[i] + ghosts_bins[i],
        })
    return result, ["bin", "mutuals", "no_mutuals", "total"]


def q4_top_mutuals(rows):
    active = filter_active(rows)
    mutuals = [r for r in active if r["mutual"] and r["profile_ratio"] > 0]
    mutuals.sort(key=lambda x: x["profile_ratio"], reverse=True)
    result = [{
        "rank": i + 1,
        "username": r.get("username", "—"),
        "ratio": round(r["profile_ratio"], 4),
        "followers": r["profile_followers"],
        "following": r["profile_following"],
        "origen": r.get("origen", "?"),
    } for i, r in enumerate(mutuals[:20])]
    return result, ["rank", "username", "ratio", "followers", "following", "origen"]


def q5_top_no_mutuals(rows):
    active = filter_active(rows)
    ghosts = [r for r in active if not r["mutual"] and r["profile_ratio"] > 0]
    ghosts.sort(key=lambda x: x["profile_ratio"], reverse=True)
    result = [{
        "rank": i + 1,
        "username": r.get("username", "—"),
        "ratio": round(r["profile_ratio"], 4),
        "followers": r["profile_followers"],
        "following": r["profile_following"],
        "origen": r.get("origen", "?"),
    } for i, r in enumerate(ghosts[:20])]
    return result, ["rank", "username", "ratio", "followers", "following", "origen"]


def q6_username_quality(rows):
    active = filter_active(rows)
    seen = set()
    scored = []
    for r in active:
        u = r.get("username", "")
        if not u or u in seen:
            continue
        seen.add(u)
        scored.append({
            "username": u,
            "score": score_username(u),
            "ratio": round(r["profile_ratio"], 4),
            "mutual": "✓" if r["mutual"] else "✗",
            "origen": r.get("origen", "?"),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    result = [{"rank": i + 1, **s} for i, s in enumerate(scored[:20])]
    return result, ["rank", "username", "score", "ratio", "mutual", "origen"]


def q7_score_ratio_correlation(rows):
    active = filter_active(rows)
    seen = set()
    points = []
    for r in active:
        u = r.get("username", "")
        if not u or u in seen or r["profile_ratio"] <= 0:
            continue
        seen.add(u)
        points.append((score_username(u), r["profile_ratio"]))
    n = len(points)
    if n < 2:
        return [{"metric": "n", "value": n}], ["metric", "value"]
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    sx2 = sum(p[0] ** 2 for p in points)
    sy2 = sum(p[1] ** 2 for p in points)
    denom = n * sx2 - sx * sx
    slope = (n * sxy - sx * sy) / denom if denom else 0
    intercept = (sy - slope * sx) / n
    mean_y = sy / n
    ss_res = sum((p[1] - (slope * p[0] + intercept)) ** 2 for p in points)
    ss_tot = sum((p[1] - mean_y) ** 2 for p in points)
    r2 = 1 - (ss_res / ss_tot) if ss_tot else 0
    denom_r = math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
    pearson = (n * sxy - sx * sy) / denom_r if denom_r else 0
    interpretation = (
        "correlación fuerte positiva" if pearson > 0.5 else
        "correlación moderada positiva" if pearson > 0.2 else
        "sin correlación" if abs(pearson) <= 0.2 else
        "correlación moderada negativa" if pearson > -0.5 else
        "correlación fuerte negativa"
    )
    result = [
        {"metric": "n (pares)", "value": n},
        {"metric": "pendiente (slope)", "value": round(slope, 5)},
        {"metric": "ordenada (intercept)", "value": round(intercept, 5)},
        {"metric": "R²", "value": round(r2, 4)},
        {"metric": "Pearson r", "value": round(pearson, 4)},
        {"metric": "interpretación", "value": interpretation},
        {"metric": "ecuación", "value": f"ratio = {slope:.4f}·score + {intercept:.4f}"},
    ]
    return result, ["metric", "value"]


def q8_monthly_cohort(rows):
    active = filter_active(rows)
    by_month = defaultdict(lambda: {"mutuals": 0, "total": 0})
    for r in active:
        fa = r.get("followed_at", "")
        if not fa or len(fa) < 7:
            continue
        month = fa[:7]
        by_month[month]["total"] += 1
        if r["mutual"]:
            by_month[month]["mutuals"] += 1
    result = []
    for month in sorted(by_month.keys()):
        d = by_month[month]
        rate = (d["mutuals"] / d["total"]) * 100 if d["total"] else 0
        result.append({
            "mes": month,
            "total": d["total"],
            "mutuals": d["mutuals"],
            "no_mutuals": d["total"] - d["mutuals"],
            "tasa_%": round(rate, 2),
        })
    return result, ["mes", "total", "mutuals", "no_mutuals", "tasa_%"]


def q9_suspicious_profiles(rows):
    active = filter_active(rows)
    suspicious = []
    for r in active:
        flags = []
        u = r.get("username", "")
        score = score_username(u) if u else 50
        ratio = r["profile_ratio"]
        followers = r["profile_followers"]
        following = r["profile_following"]
        if score < 20:
            flags.append("username_raro")
        if ratio < 0.1 and following > 500:
            flags.append("ratio_muy_bajo")
        if following > 7000:
            flags.append("following_masivo")
        if followers < 10 and following > 100:
            flags.append("perfil_vacio_siguiendo_mucho")
        if len(re.findall(r"\d", u)) >= 4:
            flags.append("muchos_numeros")
        if flags:
            suspicious.append({
                "username": u,
                "ratio": round(ratio, 4),
                "followers": followers,
                "following": following,
                "score": score,
                "mutual": "✓" if r["mutual"] else "✗",
                "flags": ", ".join(flags),
                "flag_count": len(flags),
            })
    suspicious.sort(key=lambda x: x["flag_count"], reverse=True)
    return suspicious[:30], ["username", "ratio", "followers", "following", "score", "mutual", "flags"]


def q10_self_growth(self_rows):
    if not self_rows:
        return [{"info": "carga self_history.csv para ver esta consulta"}], ["info"]
    sorted_r = sorted(self_rows, key=lambda x: x.get("timestamp", ""))
    if len(sorted_r) < 2:
        return [{"info": "se necesitan al menos 2 snapshots"}], ["info"]
    result = []
    for i, s in enumerate(sorted_r):
        delta_f = s["followers"] - sorted_r[i - 1]["followers"] if i > 0 else 0
        delta_g = s["following"] - sorted_r[i - 1]["following"] if i > 0 else 0
        result.append({
            "timestamp": s.get("timestamp", ""),
            "followers": s["followers"],
            "following": s["following"],
            "ratio": round(s["ratio"], 4),
            "Δ followers": f"{'+' if delta_f >= 0 else ''}{delta_f}",
            "Δ following": f"{'+' if delta_g >= 0 else ''}{delta_g}",
        })
    first = sorted_r[0]
    last = sorted_r[-1]
    result.append({
        "timestamp": "=== RESUMEN ===",
        "followers": f"{first['followers']} → {last['followers']}",
        "following": f"{first['following']} → {last['following']}",
        "ratio": f"{first['ratio']:.4f} → {last['ratio']:.4f}",
        "Δ followers": f"{last['followers'] - first['followers']:+d}",
        "Δ following": f"{last['following'] - first['following']:+d}",
    })
    return result, ["timestamp", "followers", "following", "ratio", "Δ followers", "Δ following"]


QUERIES = [
    ("Q1 · Ranking de orígenes por tasa de mutualidad", q1_mutuality_rate, "stats"),
    ("Q2 · Ratio avg/max/min por origen", q2_ratio_stats_by_origin, "stats"),
    ("Q3 · Distribución de ratios (histograma)", q3_ratio_distribution, "stats"),
    ("Q4 · Top 20 mutuals por ratio", q4_top_mutuals, "stats"),
    ("Q5 · Top 20 no-mutuals por ratio", q5_top_no_mutuals, "stats"),
    ("Q6 · Username quality - top 20 scores", q6_username_quality, "stats"),
    ("Q7 · Correlación username-score vs ratio", q7_score_ratio_correlation, "stats"),
    ("Q8 · Cohort mensual de mutualidad", q8_monthly_cohort, "stats"),
    ("Q9 · Perfiles sospechosos / bots", q9_suspicious_profiles, "stats"),
    ("Q10 · Crecimiento propio (self_history)", q10_self_growth, "self"),
]
