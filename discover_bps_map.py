"""One-off: build a verified BPS var-id map per province per indicator.
With reliable (non-truncating) catalogs, for each province x indicator find the
var that returns a province-total value. Prints a Python dict literal to hardcode."""
import ingest_poc as m

KEY = m.load_env().get("BPS_API_KEY")
PROV = {6100: "Kalimantan Barat", 6200: "Kalimantan Tengah", 6300: "Kalimantan Selatan",
        6400: "Kalimantan Timur", 6500: "Kalimantan Utara"}


def has(t, *subs):
    return all(s in t for s in subs)


IND = {
    "Unemployment rate": lambda t: has(t, "tingkat pengangguran terbuka") and not any(
        b in t for b in ("termasuk", "kelompok umur", "jenis kelamin", "usia kerja", "triwulan", "partisipasi", "2018=")),
    "Poverty rate (P0)": lambda t: has(t, "persentase penduduk miskin") and ("kabupaten" in t or "kab/kota" in t) and "termasuk" not in t,
    "Clean water access": lambda t: has(t, "air minum layak"),
    "Mean years schooling (RLS)": lambda t: has(t, "rata-rata lama sekolah") and not any(b in t for b in ("laki", "perempuan", "termasuk")),
    "GDP growth (PDRB)": lambda t: has(t, "laju pertumbuhan pdrb") and ("kabupaten" in t or "kab/kota" in t),
    "Electrification ratio": lambda t: "rasio elektrifikasi" in t or ("elektrifikasi" in t and "kabupaten" in t),
    "Crop production (paddy)": lambda t: has(t, "produksi padi"),
    "Households": lambda t: has(t, "jumlah rumah tangga") and "perikanan" not in t and ("kabupaten" in t or "kab/kota" in t),
    "Tourist trips (domestic)": lambda t: has(t, "perjalanan wisatawan nusantara", "tujuan"),
    "Life expectancy": lambda t: has(t, "harapan hidup") and not any(b in t for b in ("laki", "perempuan", "termasuk")),
}

amap = {}
for domain, pname in PROV.items():
    cat = m.bps_all_vars(domain, KEY)
    print(f"\n=== {pname} ({domain}) — catalog {len(cat)} vars ===")
    amap[domain] = {}
    for ind, pred in IND.items():
        hit = None
        for vid, title in cat:
            if pred(title.lower()):
                res = m.bps_value(domain, vid, KEY, pname)
                if res is not None:
                    hit = (vid, res)
                    break
        if hit:
            amap[domain][ind] = hit[0]
            print(f"  {ind:26} var={hit[0]:<5} {hit[1][1]} ({hit[1][0]})")
        else:
            print(f"  {ind:26} NO VALUE")

print("\n\nBPS_VAR_MAP = {")
for d, inds in amap.items():
    print(f"    {d}: {{" + ", ".join(f'{k!r}: {v}' for k, v in inds.items()) + "},")
print("}")
print("DONE")
