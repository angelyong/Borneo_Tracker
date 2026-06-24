"""
Borneo Tracker — POC progress reporter.

Reads borneo_tracker_poc.csv and prints ESG + SDG coverage across the 4 dashboard
territories (Sabah, Sarawak, Brunei, Kalimantan) as a RAG-style table. This is the
dashboard's progress view in text form. ASCII-only (Windows console safe).
"""

import csv
from pathlib import Path

CSV = Path(__file__).parent / "borneo_tracker_poc.csv"
TERR = ["Sabah", "Sarawak", "Brunei", "Kalimantan"]


def territory_of(t):
    if t.startswith("Kalimantan"):
        return "Kalimantan"
    if t.startswith("Borneo"):
        return "*all*"          # whole-island (e.g. fire) counts for everyone
    if t in TERR:
        return t
    return None                  # country baselines (Malaysia/Indonesia) etc.


# indicator-name matchers -> ESG category / SDG goal
def m_forest(i): return "forest" in i.lower() or "tree cover" in i.lower()
def m_fire(i): return "fire" in i.lower()
def m_air(i): return "air quality" in i.lower()
def m_water_q(i): return i.lower() == "__none__"  # river water quality (gap)
def m_clean_water(i): return "clean water" in i.lower()
def m_employ(i): return "unemployment" in i.lower()
def m_gdp(i): return "gdp" in i.lower()
def m_health(i): return "hospital" in i.lower()
def m_educ(i): return ("enrolment" in i.lower() or "schooling" in i.lower()
                       or "literacy" in i.lower())
def m_poverty(i): return "poverty" in i.lower()
def m_govern(i): return "corruption" in i.lower() or "wgi" in i.lower() or "governance" in i.lower()


ESG = [
    ("E", "Forest cover / loss", m_forest),
    ("E", "Fire hotspots", m_fire),
    ("E", "Air quality", m_air),
    ("E", "River water quality", m_water_q),
    ("S", "Clean water access", m_clean_water),
    ("S", "Employment", m_employ),
    ("S", "GDP", m_gdp),
    ("S", "Healthcare", m_health),
    ("S", "Education", m_educ),
    ("S", "Poverty", m_poverty),
    ("G", "Governance (CPI/WGI)", m_govern),
]
SDG = [
    ("SDG1  No poverty", m_poverty),
    ("SDG4  Education", m_educ),
    ("SDG6  Clean water", m_clean_water),
    ("SDG8  Work + GDP", lambda i: m_employ(i) or m_gdp(i)),
    ("SDG13 Climate", lambda i: m_fire(i) or m_air(i)),
    ("SDG15 Life on land", m_forest),
]


def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))

    def coverage(match):
        s = set()
        for r in rows:
            if match(r["indicator"]):
                t = territory_of(r["territory"])
                if t == "*all*":
                    s.update(TERR)
                elif t in TERR:
                    s.add(t)
        return s

    def rag(n):
        return "GREEN" if n >= 3 else ("AMBER" if n >= 1 else "RED")

    def block(title, items, with_cat=False):
        print(title)
        print(f"  {'indicator':22} " + " ".join(f"{t[:3]:>4}" for t in TERR) + "   cov  RAG")
        filled = total = 0
        for it in items:
            cat, name, match = (it if with_cat else (None,) + it)
            c = coverage(match)
            cells = " ".join(f"{'  Y ' if t in c else '  . '}" for t in TERR)
            tag = f"[{cat}] " if cat else ""
            print(f"  {tag}{name:{22 - len(tag)}} {cells}   {len(c)}/4  {rag(len(c))}")
            filled += len(c)
            total += 4
        print(f"  -> {filled}/{total} cells = {round(100*filled/total)}%\n")

    print(f"=== Borneo Tracker — coverage from {CSV.name} ({len(rows)} rows) ===\n")
    block("ESG", ESG, with_cat=True)
    block("SDG (fed by ESG data)", SDG)


if __name__ == "__main__":
    main()
