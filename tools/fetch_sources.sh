#!/bin/sh
# Download the public map sources into vendor/ (only needed to rebuild data/globe.json and data/hiroshima.json;
# the generated files are already in data/).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NE="$ROOT/vendor/natural-earth-vector/geojson"
mkdir -p "$NE"
for f in ne_110m_coastline ne_50m_land ne_10m_admin_1_states_provinces; do
  curl -L -o "$NE/$f.geojson" "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson"
done
# Japanese municipal boundaries (MLIT National Land Numerical Information N03, converted to GeoJSON by niiyz)
cd "$ROOT/vendor"
if [ ! -d JapanCityGeoJson ]; then
  git clone --depth 1 --filter=blob:none --sparse https://github.com/niiyz/JapanCityGeoJson.git
  cd JapanCityGeoJson && git sparse-checkout set geojson/32 geojson/33 geojson/34 geojson/35 geojson/37 geojson/38
fi
echo "sources ready in vendor/"
