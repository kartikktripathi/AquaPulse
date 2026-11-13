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
          pin.style.cssText = 'width:22px;height:22px;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px #0006;';
          pin.style.backgroundColor = report.color;
          var icon = L.divIcon({ html: pin, className: 'saved-report-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
          var popup = document.createElement('div');
          popup.style.cssText = 'min-width:160px;max-width:240px;font:13px/1.5 system-ui;';
          // Report text is untrusted: use textContent, never HTML interpolation.
          [report.name, report.category, 'Severity: ' + report.severity, 'Status: ' + report.status,
            report.date, report.address].forEach(function(value, index) {
              if (!value) return;
              var line = document.createElement(index === 0 ? 'strong' : 'div');
              line.textContent = String(value);
              popup.appendChild(line);
            });
          L.marker([report.latitude, report.longitude], { icon: icon, title: report.name,
            alt: report.name, bubblingMouseEvents: false }).bindPopup(popup).addTo(reportLayer);
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

        // Draw / update 500m radius circle around user
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
