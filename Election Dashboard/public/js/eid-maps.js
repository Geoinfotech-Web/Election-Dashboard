(function (global) {
  const GOOGLE = {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "Map data &copy; Google",
  };

  const TILES = {
    hybrid: { url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", options: GOOGLE },
    satellite: { url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", options: GOOGLE },
    streets: { url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", options: GOOGLE },
    terrain: { url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", options: GOOGLE },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      options: { maxZoom: 20, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" },
    },
    light: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options: { maxZoom: 20, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" },
    },
  };

  const GEO = {
    global: { center: [9.08, 8.68], zoom: 6 },
    ng: { center: [9.08, 8.68], zoom: 6 },
    us: { center: [39.83, -98.58], zoom: 4 },
    gb: { center: [54.5, -3.4], zoom: 5 },
    gh: { center: [7.95, -1.02], zoom: 7 },
    ke: { center: [0.02, 37.91], zoom: 6 },
    in: { center: [22.97, 79.59], zoom: 5 },
    de: { center: [51.16, 10.45], zoom: 6 },
    fr: { center: [46.23, 2.21], zoom: 6 },
    br: { center: [-14.24, -51.93], zoom: 4 },
    za: { center: [-30.56, 22.94], zoom: 5 },
    ekiti: { center: [7.67, 5.31], zoom: 9 },
  };

  const MARKER_LL = {
    ng: [9.08, 8.68],
    us: [39.83, -98.58],
    gb: [54.5, -3.4],
    gh: [7.95, -1.02],
    ke: [0.02, 37.91],
    in: [22.97, 79.59],
    br: [-14.24, -51.93],
  };

  const GRID3 = {
    state: "/api/grid3/state",
    lga: "/api/grid3/lga",
    ward: "/api/grid3/ward",
    health: "/api/grid3/health",
    polling: "/api/polling-unit-points",
  };

  const GRID3_DIRECT = {
    state: "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/NGA_State_Boundaries_V2/FeatureServer/0",
    lga: "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/NGA_LGA_Boundaries_2/FeatureServer/0",
    ward: "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/NGA_Ward_Boundaries/FeatureServer/0",
    health: "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_health_facilities_v2_0/FeatureServer/0",
  };

  const STYLES = {
    state: { color: "#0f766e", weight: 2.5, fillColor: "#0f766e", fillOpacity: 0.12 },
    lga: { color: "#1d4ed8", weight: 1.4, fillColor: "#1d4ed8", fillOpacity: 0.08 },
    ward: { color: "#b45309", weight: 1.1, fillColor: "#b45309", fillOpacity: 0.06 },
  };

  const store = new WeakMap();

  function pickProp(props, keys) {
    if (!props) return "";
    for (let i = 0; i < keys.length; i++) {
      const value = props[keys[i]];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return "";
  }

  function featureLabel(id, props) {
    const state = pickProp(props, ["statename", "state"]);
    const lga = pickProp(props, ["lganame", "lga"]);
    const ward = pickProp(props, ["wardname", "ward"]);
    const unit = pickProp(props, ["pollingUnit", "name", "facility_name"]);
    let parts = [];
    if (id === "state") parts = [state];
    else if (id === "lga") parts = [state, lga];
    else if (id === "ward") parts = [state, lga, ward];
    else if (id === "polling") parts = [unit || "Polling unit", pickProp(props, ["address"]), ward, lga, state];
    else if (id === "health") parts = [unit, lga, state];
    else parts = [state, lga, ward, unit];
    return parts.filter(Boolean).join(" · ");
  }

  function ensure(el) {
    if (!el || !global.L) return null;
    let inst = store.get(el);
    if (inst) return inst;
    const map = global.L.map(el, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    map.createPane("grid3");
    map.getPane("grid3").style.zIndex = 450;
    inst = {
      map,
      tile: null,
      markers: global.L.layerGroup().addTo(map),
      points: global.L.layerGroup().addTo(map),
      overlays: {},
      cfg: {},
    };
    store.set(el, inst);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth, h = el.clientHeight;
        map.invalidateSize();
        if (inst.lastW !== w || inst.lastH !== h) {
          inst.lastW = w;
          inst.lastH = h;
          inst.overlayKey = null;
          refreshOverlays(el);
        }
      });
      ro.observe(el);
      inst.ro = ro;
    }
    global.addEventListener("resize", () => map.invalidateSize());
    let timer = null;
    map.on("moveend", () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshOverlays(el), 320);
    });
    return inst;
  }

  function setBasemap(el, key) {
    const inst = ensure(el);
    if (!inst) return;
    const spec = TILES[key] || TILES.hybrid;
    if (inst.tile) inst.map.removeLayer(inst.tile);
    inst.tile = global.L.tileLayer(spec.url, spec.options).addTo(inst.map);
    inst.basemap = key;
  }

  function clearOverlay(inst, id) {
    if (inst.overlays[id]) {
      inst.map.removeLayer(inst.overlays[id]);
      inst.overlays[id] = null;
    }
  }

  function putGeoJson(inst, id, data, isPoint) {
    clearOverlay(inst, id);
    if (!data || !data.features || !data.features.length) return;
    inst.overlays[id] = global.L.geoJSON(data, {
      pane: "grid3",
      style: () => STYLES[id] || STYLES.state,
      pointToLayer: isPoint
        ? (feat, latlng) =>
            global.L.circleMarker(latlng, {
              pane: "grid3",
              radius: id === "polling" ? 4 : 5,
              color: "#ffffff",
              weight: 1,
              fillColor: id === "health" ? "#be123c" : "#1c8f86",
              fillOpacity: 0.9,
            })
        : undefined,
      onEachFeature: (feat, layer) => {
        const label = featureLabel(id, feat.properties);
        if (label) {
          layer.bindTooltip(label, { sticky: true, direction: "top" });
          layer.bindPopup("<strong>" + label.replace(/</g, "&lt;") + "</strong>");
        }
      },
    }).addTo(inst.map);
  }

  function bboxOf(map) {
    const b = map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(",");
  }

  async function loadJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.error) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function grid3Query(layerId, bbox) {
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      resultRecordCount: "1500",
      geometry: bbox,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
    });
    return GRID3_DIRECT[layerId].replace(/\/$/, "") + "/query?" + params.toString();
  }

  async function loadLayer(layerId, bbox) {
    const proxied = await loadJson(GRID3[layerId] + "?bbox=" + encodeURIComponent(bbox));
    if (proxied && (proxied.features || proxied.points)) return proxied;
    if (GRID3_DIRECT[layerId]) return loadJson(grid3Query(layerId, bbox));
    return null;
  }

  async function refreshOverlays(el) {
    const inst = store.get(el);
    if (!inst || !inst.map) return;
    if (el.clientWidth < 40 || el.clientHeight < 40) {
      inst.overlayKey = null;
      return;
    }
    const layers = inst.cfg.layers || {};
    const zoom = inst.map.getZoom();
    const bbox = bboxOf(inst.map);
    const key = JSON.stringify({ layers, zoom: Math.floor(zoom), bbox });
    if (inst.overlayKey === key) return;
    inst.overlayKey = key;

    if (layers.state) {
      const data = await loadLayer("state", bbox);
      if (inst.overlayKey === key) putGeoJson(inst, "state", data);
    } else clearOverlay(inst, "state");

    if (layers.lga && zoom >= 5) {
      const data = await loadLayer("lga", bbox);
      if (inst.overlayKey === key) putGeoJson(inst, "lga", data);
    } else clearOverlay(inst, "lga");

    if (layers.ward && zoom >= 8) {
      const data = await loadLayer("ward", bbox);
      if (inst.overlayKey === key) putGeoJson(inst, "ward", data);
    } else clearOverlay(inst, "ward");

    if (layers.health && zoom >= 8) {
      const data = await loadLayer("health", bbox);
      if (inst.overlayKey === key) putGeoJson(inst, "health", data, true);
    } else clearOverlay(inst, "health");

    if (layers.polling && zoom >= 9) {
      const data = await loadJson("/api/polling-unit-points?bbox=" + encodeURIComponent(bbox));
      const fc = {
        type: "FeatureCollection",
        features: (data?.points || []).slice(0, 800).map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
          properties: { name: p.pollingUnit, address: p.address || p.name, code: p.code, ward: p.ward, lga: p.lga, state: p.state },
        })),
      };
      if (inst.overlayKey === key) putGeoJson(inst, "polling", fc, true);
    } else if (!inst.cfg.keepLocalPoints) {
      clearOverlay(inst, "polling");
    }
  }

  function attach(el, cfg) {
    const inst = ensure(el);
    if (!inst) return;
    inst.cfg = cfg || {};
    const view = GEO[cfg.scope] || GEO.global;
    const liveView = cfg.live ? GEO.ekiti : view;
    setBasemap(el, cfg.basemap || "hybrid");
    const user = cfg.user && cfg.user.lat != null ? cfg.user : null;
    const focus = cfg.focus && cfg.focus.lat != null ? cfg.focus : null;
    const viewKey = focus
      ? "focus:" + Number(focus.lat).toFixed(5) + "," + Number(focus.lng).toFixed(5)
      : user
        ? "user:" + user.lat.toFixed(4) + "," + user.lng.toFixed(4)
        : (cfg.live ? "ekiti" : cfg.scope) + ":" + (cfg.zoom || liveView.zoom);
    if (inst.viewKey !== viewKey) {
      if (focus) inst.map.flyTo([Number(focus.lat), Number(focus.lng)], cfg.focusZoom || 16, { duration: 0.75 });
      else if (user) inst.map.setView([user.lat, user.lng], 13);
      else inst.map.setView(liveView.center, cfg.zoom || liveView.zoom);
      inst.viewKey = viewKey;
    }
    inst.markers.clearLayers();
    inst.points.clearLayers();
    paintFocus(inst, focus);

    if (user) {
      inst.markers.addLayer(
        global.L.circleMarker([user.lat, user.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#cf3f36",
          fillOpacity: 1,
        }).bindTooltip("You are here")
      );
    }

    (cfg.markers || []).forEach((m) => {
      const ll = MARKER_LL[m.code];
      if (!ll) return;
      const marker = global.L.circleMarker(ll, {
        radius: m.live ? 8 : 6,
        color: "#ffffff",
        weight: 2,
        fillColor: m.live ? "#e0564f" : "#1c8f86",
        fillOpacity: 0.95,
      });
      marker.bindTooltip(m.title || m.label, { direction: "top" });
      if (typeof m.onClick === "function") marker.on("click", m.onClick);
      inst.markers.addLayer(marker);
    });

    (cfg.points || []).slice(0, 800).forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const tip = [p.code, p.address || p.name, p.place].filter(Boolean).join(" · ");
      const marker = global.L.circleMarker([p.lat, p.lng], {
        radius: 3,
        color: "#1c8f86",
        weight: 1,
        fillOpacity: 0.7,
      }).bindPopup("<strong>" + String(p.name || "Polling unit").replace(/</g, "&lt;") + "</strong><br>" + String(tip).replace(/</g, "&lt;"));
      if (typeof p.onClick === "function") marker.on("click", p.onClick);
      inst.points.addLayer(marker);
    });

    refreshOverlays(el);
    requestAnimationFrame(() => inst.map.invalidateSize());
  }

  function paintFocus(inst, focus) {
    if (inst.focusMarker) {
      inst.map.removeLayer(inst.focusMarker);
      inst.focusMarker = null;
    }
    if (!focus || focus.lat == null || focus.lng == null) return;
    const title = String(focus.name || "Polling unit").replace(/</g, "&lt;");
    const addr = String(focus.address || "").replace(/</g, "&lt;");
    const place = [focus.ward, focus.lga, focus.state].filter(Boolean).join(" · ").replace(/</g, "&lt;");
    const html = "<strong>" + title + "</strong>" + (addr ? "<br>" + addr : "") + (place ? "<br>" + place : "");
    inst.focusMarker = global.L.circleMarker([Number(focus.lat), Number(focus.lng)], {
      radius: 10,
      color: "#ffffff",
      weight: 2,
      fillColor: "#cf3f36",
      fillOpacity: 1,
    })
      .bindPopup(html)
      .addTo(inst.map);
    inst.focusMarker.openPopup();
  }

  function focusPoint(el, lat, lng, zoom, name) {
    const inst = ensure(el);
    if (!inst || lat == null || lng == null) return;
    const focus = { lat: Number(lat), lng: Number(lng), name: name || "Polling unit" };
    inst.cfg = inst.cfg || {};
    inst.cfg.focus = focus;
    inst.viewKey = "focus:" + focus.lat.toFixed(5) + "," + focus.lng.toFixed(5);
    paintFocus(inst, focus);
    inst.map.flyTo([focus.lat, focus.lng], zoom || 16, { duration: 0.75 });
  }

  function resetView(el, scope) {
    const inst = store.get(el);
    if (!inst) return;
    if (inst.cfg) inst.cfg.focus = null;
    inst.viewKey = null;
    paintFocus(inst, null);
    const view = GEO[scope] || GEO.ng || GEO.global;
    inst.map.flyTo(view.center, view.zoom, { duration: 0.7 });
  }

  function zoomIn(el) {
    const inst = store.get(el);
    if (inst) inst.map.zoomIn();
  }

  function zoomOut(el) {
    const inst = store.get(el);
    if (inst) inst.map.zoomOut();
  }

  global.EIDMaps = { attach, setBasemap, zoomIn, zoomOut, focusPoint, resetView, GEO };
})(window);
