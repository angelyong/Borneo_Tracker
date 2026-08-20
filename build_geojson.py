"""
Build the Borneo district boundary asset: public/data/borneo_districts.geojson

One-off / occasional asset builder (boundaries rarely change — NOT part of the
weekly run_pipeline). Downloads GADM 4.1 ADM2 GeoJSON for Malaysia + Indonesia,
keeps only the Borneo ADM1 units (Sabah, Sarawak, 5 Kalimantan provinces), and
slims each feature's properties to what the map/joins need:

  parent   -> our districts.json parent name (Sabah / Kalimantan Timur / …)
  name     -> readable district name (GADM NAME_2, de-camelCased)
  key      -> normalized join key (lowercase, alphanumeric only)
  gid1/gid2, adm1/adm2 (GADM integers, for the GFW join), cc2 (BPS regency code)

Brunei is intentionally excluded: it stays a national figure (no district data),
so it is not a drill-down parent.

Run:  python build_geojson.py
"""

import io
import json
import re
import zipfile
from pathlib import Path
import urllib.request

from district_keys import (
    district_identity,
    geometry_join_key,
    normalize_name_key,
    usable_polygon_geometry,
)

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "borneo_districts.geojson"
GADM = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{iso}_2.json.zip"
UA = "Mozilla/5.0 (Borneo-Tracker-Geo)"

# GADM GID_1 -> our districts.json parent name. Codes verified against GADM 4.1
# (Kalimantan Timur=34, Utara=35 — the post-split numbering GFW also uses).
PARENT_BY_GID1 = {
    "MYS.13_1": "Sabah",
    "MYS.14_1": "Sarawak",
    "IDN.12_1": "Kalimantan Barat",
    "IDN.13_1": "Kalimantan Selatan",
    "IDN.14_1": "Kalimantan Tengah",
    "IDN.34_1": "Kalimantan Timur",
    "IDN.35_1": "Kalimantan Utara",
}
ISOS = ["MYS", "IDN"]


def norm_key(name):
    # Must match ingest_districts.norm_key so map polygons join to district data.
    return normalize_name_key(name)


def de_camel(name):
    # GADM .json strips spaces from multi-word names ("KotaKinabalu"); restore them.
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", str(name)).strip()


def gid_ints(gid2):
    # "IDN.34.5_1" or "IDN.35.4" -> adm1, adm2 (the "_1" suffix is inconsistent in GADM 4.1)
    m = re.match(r"[A-Z]+\.(\d+)\.(\d+)", str(gid2) or "")
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def fetch_gadm(iso):
    url = GADM.format(iso=iso)
    print(f"  downloading {url}")
    raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=180).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".json"))
        return json.loads(zf.read(name))


def assert_unique_geometry_identities(features):
    """Fail closed when two polygons claim the same dashboard identity.

    Choosing one polygon arbitrarily would hide a boundary/source defect and
    makes choropleth interaction non-deterministic.
    """
    seen = {}
    for feature in features:
        props = feature.get("properties", {})
        identity = district_identity(props.get("parent"), props.get("key"))
        if not all(identity):
            raise ValueError(f"geometry feature has incomplete district identity: {props!r}")
        geometry_ok, geometry_error = usable_polygon_geometry(feature.get("geometry"))
        if not geometry_ok:
            raise ValueError(f"geometry feature {identity!r} is not renderable: {geometry_error}")
        if identity in seen:
            raise ValueError(
                f"duplicate geometry identity {identity!r}: "
                f"{seen[identity]!r} and {props.get('name')!r}"
            )
        seen[identity] = props.get("name")


def main():
    features = []
    for iso in ISOS:
        fc = fetch_gadm(iso)
        kept = 0
        for feat in fc.get("features", []):
            props = feat.get("properties", {})
            parent = PARENT_BY_GID1.get(props.get("GID_1"))
            if not parent:
                continue
            name = de_camel(props.get("NAME_2", ""))
            adm1, adm2 = gid_ints(props.get("GID_2"))
            cc2 = props.get("CC_2")
            # Unified frontend join key: Indonesia joins by BPS/GADM code (immune to
            # the Kota/regency naming mismatch); Malaysia joins by normalized name.
            key = geometry_join_key(parent, name, iso=iso, cc2=cc2)
            feat["properties"] = {
                "parent": parent,
                "name": name,
                "key": key,
                "gid1": props.get("GID_1"),
                "gid2": props.get("GID_2"),
                "adm1": adm1,
                "adm2": adm2,
                "cc2": cc2,
            }
            features.append(feat)
            kept += 1
        print(f"  {iso}: kept {kept} Borneo ADM2 features")

    assert_unique_geometry_identities(features)
    out = {"type": "FeatureCollection", "features": features}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out), encoding="utf-8")
    size_mb = OUTPUT.stat().st_size / 1_048_576
    print(f"Wrote {len(features)} features ({size_mb:.2f} MB) -> {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
