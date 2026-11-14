export const mapHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #f2efe9;
      }
      #map {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 100%;
        background-color: #f2efe9;
      }
      .user-marker-container {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .user-dot {
        width: 14px;
        height: 14px;
        background-color: #007aff;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        position: absolute;
        z-index: 2;
      }
      .user-pulse {
        width: 36px;
        height: 36px;
        background-color: rgba(0, 122, 255, 0.3);
        border-radius: 50%;
        position: absolute;
        z-index: 1;
        animation: pulse-ring 2s infinite ease-out;
      }
      @keyframes pulse-ring {
        0% {
          transform: scale(0.3);
          opacity: 1;
        }
        80% {
          transform: scale(1.4);
          opacity: 0;
        }
        100% {
          transform: scale(1.4);
          opacity: 0;
        }
      }
      .problem-marker-container {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .problem-pin {
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        background-color: #ff3b30;
        transform: rotate(-45deg);
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: -24px;
        left: -13px;
        cursor: pointer;
      }
      .problem-pin-inner {
        width: 8px;
        height: 8px;
        background-color: #ffffff;
        border-radius: 50%;
      }

      .report-pin-marker {
        width: 28px;
        height: 38px;
        position: relative;
        cursor: pointer;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
        transition: transform 0.15s ease-out;
      }
      .report-pin-marker:hover {
        transform: scale(1.15);
      }
      .report-pin-head {
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #ffffff;
        position: absolute;
        top: 1px;
        left: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .report-pin-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #ffffff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      }
      .report-pin-marker.high-severity .report-pin-head {
        border-color: #ffffff;
        box-shadow: 0 0 0 2px #ff3b30, 0 2px 6px rgba(255, 59, 48, 0.4);
      }

      .leaflet-popup-content-wrapper {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 0;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }
      .leaflet-popup-content {
        margin: 0 !important;
        line-height: 1.4;
        width: 275px !important;
        max-width: 300px;
      }
      .leaflet-popup-tip-container {
        width: 24px;
        height: 12px;
      }
      .leaflet-popup-tip {
        background: #ffffff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
      }
      .leaflet-container a.leaflet-popup-close-button {
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: rgba(0, 0, 0, 0.06);
        color: #475569;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 14px/24px system-ui, -apple-system, sans-serif;
        padding: 0;
        text-decoration: none;
        z-index: 20;
        transition: background-color 0.15s, color 0.15s;
      }
      .leaflet-container a.leaflet-popup-close-button:hover {
        background: rgba(0, 0, 0, 0.14);
        color: #0f172a;
      }

      .report-card-popup {
        padding: 14px 16px;
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #1e293b;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 400px;
        overflow-y: auto;
      }
      .report-card-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        margin: 0;
        padding-right: 20px;
        word-break: break-word;
      }
      .report-card-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .report-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        line-height: 14px;
      }
      .report-badge-category {
        border: 1px solid transparent;
      }
      .report-badge-severity {
        border: 1px solid transparent;
      }
      .report-badge-status {
        border: 1px solid transparent;
      }
      .report-card-desc {
        font-size: 12.5px;
        line-height: 1.45;
        color: #334155;
        word-break: break-word;
        max-height: 62px;
        overflow-y: auto;
      }
      .report-card-loc {
        font-size: 12px;
        color: #1e293b;
        line-height: 1.35;
        padding: 7px 10px;
        background-color: #f8fafc;
        border-radius: 8px;
        border-left: 3px solid #007aff;
        word-break: break-word;
      }
      .report-card-landmark {
        font-size: 11px;
        color: #64748b;
        margin-top: 3px;
        font-weight: 500;
      }
      .report-card-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
        background-color: #f8fafc;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      .report-card-grid-item {
        display: flex;
        flex-direction: column;
      }
      .grid-item-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.4px;
      }
      .grid-item-val {
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
        margin-top: 1px;
      }
      .report-card-meta {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 2px;
        border-top: 1px solid #f1f5f9;
      }
      .report-card-btn {
        width: 100%;
        background-color: #007aff;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: background-color 0.15s ease;
        outline: none;
        box-sizing: border-box;
      }
      .report-card-btn:hover {
        background-color: #0062cc;
      }
      .report-card-btn:active {
        background-color: #004fb0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([20, 0], 2);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      var userMarker = null;
      var radiusCircle = null;
      var problemMarker = null;
      var reportLayer = L.featureGroup().addTo(map);

      function setReports(reports) {
        reportLayer.clearLayers();
        if (!Array.isArray(reports)) return;
        reports.forEach(function(report) {
          if (!report || !Number.isFinite(report.latitude) || !Number.isFinite(report.longitude) ||
              Math.abs(report.latitude) > 90 || Math.abs(report.longitude) > 180) return;

          var pin = document.createElement('div');
          pin.className = 'report-pin-marker' + ((report.severity || '').toLowerCase() === 'high' ? ' high-severity' : '');

          var pinHead = document.createElement('div');
          pinHead.className = 'report-pin-head';
          pinHead.style.backgroundColor = report.color || '#007aff';

          var pinDot = document.createElement('div');
          pinDot.className = 'report-pin-dot';

          pinHead.appendChild(pinDot);
          pin.appendChild(pinHead);

          var icon = L.divIcon({
            html: pin,
            className: 'saved-report-marker',
            iconSize: [28, 36],
            iconAnchor: [14, 33],
            popupAnchor: [0, -32]
          });

          var popup = document.createElement('div');
          popup.className = 'report-card-popup';

          var titleEl = document.createElement('div');
          titleEl.className = 'report-card-title';
          titleEl.textContent = report.name || 'Untitled water issue';
          popup.appendChild(titleEl);

          var badgesEl = document.createElement('div');
          badgesEl.className = 'report-card-badges';

          if (report.category) {
            var catBadge = document.createElement('span');
            catBadge.className = 'report-badge report-badge-category';
            catBadge.textContent = report.category;
            var catCol = report.color || '#007aff';
            catBadge.style.color = catCol;
            catBadge.style.backgroundColor = catCol + '18';
            catBadge.style.borderColor = catCol + '35';
            badgesEl.appendChild(catBadge);
          }

          var sev = (report.severity || '').toLowerCase();
          if (sev && sev !== 'unknown' && sev !== 'not recorded') {
            var sevBadge = document.createElement('span');
            sevBadge.className = 'report-badge report-badge-severity';
            sevBadge.textContent = report.severityLabel || (sev[0].toUpperCase() + sev.slice(1));
            sevBadge.style.color = report.severityColor || (sev === 'high' ? '#dc2626' : sev === 'medium' ? '#d97706' : '#16a34a');
            sevBadge.style.backgroundColor = report.severityBg || (sev === 'high' ? '#fee2e2' : sev === 'medium' ? '#fef3c7' : '#dcfce7');
            sevBadge.style.borderColor = sev === 'high' ? '#fca5a5' : sev === 'medium' ? '#fde68a' : '#bbf7d0';
            badgesEl.appendChild(sevBadge);
          }

          if (report.status) {
            var statusBadge = document.createElement('span');
            statusBadge.className = 'report-badge report-badge-status';
            statusBadge.textContent = report.status;
            statusBadge.style.color = report.statusColor || '#475569';
            statusBadge.style.backgroundColor = report.statusBg || '#f1f5f9';
            statusBadge.style.borderColor = '#e2e8f0';
            badgesEl.appendChild(statusBadge);
          }

          if (badgesEl.children.length > 0) {
            popup.appendChild(badgesEl);
          }

          if (report.description && report.description !== 'No description provided.') {
            var descEl = document.createElement('div');
            descEl.className = 'report-card-desc';
            descEl.textContent = report.description;
            popup.appendChild(descEl);
          }

          var addressText = report.addressLine || report.address || '';
          var landmarkText = report.landmark || '';
          if (addressText || landmarkText) {
            var locEl = document.createElement('div');
            locEl.className = 'report-card-loc';
            var addrSpan = document.createElement('span');
            addrSpan.textContent = addressText || landmarkText;
            locEl.appendChild(addrSpan);
            if (landmarkText && addressText && addressText.indexOf(landmarkText) === -1) {
              var lmDiv = document.createElement('div');
              lmDiv.className = 'report-card-landmark';
              lmDiv.textContent = 'Near ' + landmarkText;
              locEl.appendChild(lmDiv);
            }
            popup.appendChild(locEl);
          }

          var hasDepth = report.waterDepth && report.waterDepth !== 'Not recorded';
          var hasPeople = report.peopleAffected && report.peopleAffected !== 'Not recorded';
          var hasRoad = report.roadBlocked && report.roadBlocked !== 'Not recorded';
          if (hasDepth || hasPeople || hasRoad) {
            var grid = document.createElement('div');
            grid.className = 'report-card-grid';
            var addMetric = function(lbl, val) {
              if (!val || val === 'Not recorded') return;
              var item = document.createElement('div');
              item.className = 'report-card-grid-item';
              var l = document.createElement('span');
              l.className = 'grid-item-label';
              l.textContent = lbl;
              var v = document.createElement('span');
              v.className = 'grid-item-val';
              v.textContent = val;
              item.appendChild(l);
              item.appendChild(v);
              grid.appendChild(item);
            };
            if (hasDepth) addMetric('Water depth', report.waterDepth);
            if (hasPeople) addMetric('Affected', report.peopleAffected);
            if (hasRoad) addMetric('Road access', report.roadBlocked);
            if (grid.children.length > 0) {
              popup.appendChild(grid);
            }
          }

          var metaEl = document.createElement('div');
          metaEl.className = 'report-card-meta';
          var dateSpan = document.createElement('span');
          dateSpan.textContent = report.formattedDate || report.date || 'Date unavailable';
          metaEl.appendChild(dateSpan);
          if (userMarker) {
            var dist = Math.round(map.distance(userMarker.getLatLng(), [report.latitude, report.longitude]));
            var distSpan = document.createElement('span');
            distSpan.textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km away' : dist + ' m away';
            metaEl.appendChild(distSpan);
          }
          popup.appendChild(metaEl);

          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'report-card-btn';
          btn.textContent = 'View full details';
          btn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            postToApp({
              type: 'SELECT_REPORT',
              id: report.id,
              report: report.rawReport || report
            });
          };
          popup.appendChild(btn);

          if (typeof L !== 'undefined' && L.DomEvent && typeof L.DomEvent.disableClickPropagation === 'function') {
            L.DomEvent.disableClickPropagation(popup);
          }

          L.marker([report.latitude, report.longitude], {
            icon: icon,
            title: report.name,
            alt: report.name,
            bubblingMouseEvents: false
          }).bindPopup(popup).addTo(reportLayer);
        });
      }

      function fitReports() {
        if (reportLayer.getLayers().length) {
          map.fitBounds(reportLayer.getBounds(), { paddingTopLeft: [32, 260], paddingBottomRight: [32, 120], maxZoom: 16 });
        }
      }

      var userIcon = L.divIcon({
        className: 'user-marker-container',
        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      var problemIcon = L.divIcon({
        className: 'problem-marker-container',
        html: '<div class="problem-pin"><div class="problem-pin-inner"></div></div>',
        iconSize: [26, 26],
        iconAnchor: [0, 0]
      });

      function postToApp(data) {
        var str = typeof data === 'string' ? data : JSON.stringify(data);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(str);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(data, '*');
        }
      }

      function setUserLocation(lat, lng) {
        if (!userMarker) {
          userMarker = L.marker([lat, lng], { icon: userIcon, title: 'Your Location' }).addTo(map);
        } else {
          userMarker.setLatLng([lat, lng]);
        }

        if (!radiusCircle) {
          radiusCircle = L.circle([lat, lng], {
            radius: 500,
            color: '#007aff',
            weight: 2,
            opacity: 0.85,
            fillColor: '#007aff',
            fillOpacity: 0.10,
            dashArray: '6, 6'
          }).addTo(map);
        } else {
          radiusCircle.setLatLng([lat, lng]);
        }

        if (!problemMarker) {
          setProblemLocation(lat, lng, false);
        }

        map.invalidateSize();
        map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
      }

      function setProblemLocation(lat, lng, notify) {
        if (!problemMarker) {
          problemMarker = L.marker([lat, lng], {
            icon: problemIcon,
            draggable: true,
            title: 'Problem Location'
          }).addTo(map);

          problemMarker.on('dragend', function(e) {
            if (!userMarker) return;
            var pos = e.target.getLatLng();
            var dist = Math.round(map.distance(userMarker.getLatLng(), pos));
            if (dist <= 500) {
              postToApp({
                type: 'PROBLEM_LOCATION_SET',
                latitude: pos.lat,
                longitude: pos.lng,
                distance: dist,
                withinRadius: true
              });
            } else {
              var userPos = userMarker.getLatLng();
              problemMarker.setLatLng(userPos);
              postToApp({
                type: 'PROBLEM_LOCATION_OUTSIDE',
                latitude: pos.lat,
                longitude: pos.lng,
                distance: dist,
                withinRadius: false
              });
            }
          });
        } else {
          problemMarker.setLatLng([lat, lng]);
        }

        if (notify && userMarker) {
          var dist = Math.round(map.distance(userMarker.getLatLng(), [lat, lng]));
          postToApp({
            type: 'PROBLEM_LOCATION_SET',
            latitude: lat,
            longitude: lng,
            distance: dist,
            withinRadius: dist <= 500
          });
        }
      }

      function resetProblemLocation() {
        if (userMarker) {
          var pos = userMarker.getLatLng();
          setProblemLocation(pos.lat, pos.lng, true);
        }
      }

      function fitReportingZone() {
        if (radiusCircle) {
          map.fitBounds(radiusCircle.getBounds(), { padding: [40, 40], animate: true });
        }
      }

      map.on('click', function(e) {
        if (!userMarker) return;
        var userPos = userMarker.getLatLng();
        var dist = Math.round(map.distance(userPos, e.latlng));
        if (dist <= 500) {
          setProblemLocation(e.latlng.lat, e.latlng.lng, true);
        } else {
          postToApp({
            type: 'PROBLEM_LOCATION_OUTSIDE',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
            distance: dist,
            withinRadius: false
          });
        }
      });

      window.setUserLocation = setUserLocation;
      window.setProblemLocation = setProblemLocation;
      window.resetProblemLocation = resetProblemLocation;
      window.fitReportingZone = fitReportingZone;

      function handleMessage(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'SET_LOCATION') {
            setUserLocation(data.latitude, data.longitude);
          } else if (data.type === 'SET_PROBLEM_LOCATION') {
            setProblemLocation(data.latitude, data.longitude, false);
          } else if (data.type === 'RESET_PROBLEM_LOCATION') {
            resetProblemLocation();
          } else if (data.type === 'FIT_REPORTING_ZONE') {
            fitReportingZone();
          } else if (data.type === 'SET_REPORTS') {
            setReports(data.reports);
          } else if (data.type === 'FIT_REPORTS') {
            fitReports();
          } else if (data.type === 'PAN_TO_LOCATION') {
            map.flyTo([data.latitude, data.longitude], 16);
          }
        } catch(e) {}
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      function refreshSize() {
        if (map) {
          map.invalidateSize();
        }
      }

      window.addEventListener('resize', refreshSize);

      function notifyReady() {
        refreshSize();
        postToApp({ type: 'MAP_READY' });
      }

      setTimeout(notifyReady, 100);
      setTimeout(refreshSize, 400);
      setTimeout(refreshSize, 1000);
    </script>
  </body>
</html>`;
