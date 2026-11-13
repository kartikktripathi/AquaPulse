# AquaPulse

> **Community-Driven Water Crisis Reporting, Geolocation Mapping & Citizen Response Platform**

[![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-OpenStreetMap-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-kartikktripathi%2FAquaPulse-181717?logo=github&logoColor=white)](https://github.com/kartikktripathi/AquaPulse)

---

## Overview

**AquaPulse** is a mobile and web application that empowers citizens to report, track, and monitor urban water issues in real time. From pipe bursts and street waterlogging to contaminated drinking water and drainage overflows, AquaPulse makes invisible municipal water challenges visible on a shared, interactive map.

Built with **React Native**, **Expo**, and **Supabase**, AquaPulse combines real-time device geolocation, Leaflet OpenStreetMap rendering, and cloud storage to build a transparent, crowd-sourced water health ledger for communities.

---

## Key Features

### 1. Interactive Geolocation Map
- **500m Reporting Zone**: Users can only submit problem reports within a verified 500-meter radius of their current GPS location, preventing false, remote, or speculative claims.
- **Custom Teardrop Pins**: Reports are rendered as color-coded teardrop map pins reflecting issue category and high-severity styling.
- **Rich Popup Cards**: Tapping a pin opens a clean summary card displaying the category, address, landmark, severity, water depth, affected population, date, and distance.
- **One-Tap Locate Me**: Instantly centers the map on the user's location with animated transitions.

### 2. Live Title Search with Instant Autocomplete
- **Dynamic Suggestions**: As the user types into the top search bar, matching report titles appear in an interactive dropdown.
- **Intelligent Ranking**: Prioritizes prefix matches over substring matches, complete with category badges and location hints.
- **Auto-Pan & Inspection**: Selecting a suggestion automatically flies the map to the issue's coordinates and opens its full details modal.
- **Geocoding Fallback**: If no report titles match, pressing search falls back to OpenStreetMap Nominatim to navigate to any city, street, or landmark.

### 3. Detailed Incident Reporting
- **Category Classification**: Covers Urban Flooding, Pipe Leakage, Drain Blockage, Polluted/Stagnant Water, and Overflowing Waterbodies.
- **Impact Metrics**: Collects structured data including water depth (ankle, knee, waist), estimated people affected, and road blockages.
- **Photo Evidence**: Direct in-app camera capture and photo gallery picking.
- **Reverse Geocoding**: Automatically resolves coordinates to road names, neighbourhoods, and landmarks via OpenStreetMap.

### 4. Community Photo Evidence Updates (500m Circle)
- When any citizen is within **500 meters** of an existing reported issue, they can add new photos to the report directly from the detail modal.
- Helps monitor whether a leak is worsening or repairs are underway without creating duplicate tickets.

### 5. Radius Discovery (Nearby Reports)
- Filter community reports by proximity: **500 m**, **1 km**, **5 km**, and **10 km**.
- Accurate distance calculations powered by the Haversine great-circle formula.
- Quick status and category filtering (All, Open, In Review, Resolved).

### 6. Water Outages & Community Alerts
- Quick-filter dashboard highlighting **High Severity** and **Supply-Related** emergencies.
- Chronological sorting prioritizing recent high-impact events.

### 7. Emergency Contacts & Helplines
- Fast access to official verified contacts:
  - **112**: National Emergency Response Support System (ERSS).
  - **1800-1030-222**: Pune Municipal Corporation (PMC) Water & Drainage Helpline.
  - Direct web links to official municipal portals.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native](https://reactnative.dev/) (0.88) with [Expo](https://expo.dev/) (SDK 58) |
| **Routing** | [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation) |
| **Web & Styling** | React Native Web, Safe Area Context, Responsive Layouts |
| **Mapping Engine** | [Leaflet](https://leafletjs.com/) & [OpenStreetMap](https://www.openstreetmap.org/) via bi-directional WebView / iframe bridge |
| **Geocoding** | OpenStreetMap Nominatim API & Haversine Distance Formula |
| **Backend Database** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security) |
| **Object Storage** | Supabase Storage (`report-photos` bucket for public CDN evidence) |
| **Icons & Design** | [`@expo/vector-icons`](https://icons.expo.fyi/) (Ionicons) |

---

## Project Structure

```text
AquaPulse/
├── app.json                  # Expo application configuration & native permissions
├── package.json              # Project dependencies and run scripts
├── src/
│   ├── app/                  # Expo Router file-based screens
│   │   ├── _layout.jsx       # Root layout wrapping global providers & stack navigation
│   │   ├── index.jsx         # Home screen: Fullscreen Leaflet map, search, and sidebar
│   │   ├── reports.jsx       # All reports searchable list & filter view
│   │   ├── nearby-reports.jsx# Geolocation radius discovery (500m - 10km)
│   │   ├── reports-by-category.jsx # Browse issues grouped by category
│   │   ├── alerts.jsx        # Community alerts & high-severity water outages
│   │   ├── helpline.jsx      # Emergency contact directory (ERSS 112, PMC)
│   │   └── about.jsx         # Mission, usage instructions, and version info
│   ├── components/           # Reusable UI components
│   │   ├── ReportModal.jsx   # Form modal to draft and submit new reports
│   │   ├── ReportDetailsModal.jsx # Full-detail viewer & 500m photo contributor
│   │   ├── ReportFilters.jsx # Filter pills for categories, dates, and severity
│   │   ├── ReportsScreen.jsx # Shared list layout for report explorer screens
│   │   ├── ReportCard.jsx    # Report preview card used in lists
│   │   ├── ReportPhoto.jsx   # Secure CDN photo renderer
│   │   └── InfoPage.jsx      # Standardized shell for info and alert views
│   ├── context/
│   │   └── ReportExplorerContext.jsx # Global state for cached reports & filters
│   ├── services/
│   │   ├── reportService.js  # Supabase database queries, inserts & photo uploads
│   │   └── nearbyLocation.js # High-accuracy GPS location requester
│   ├── utils/
│   │   ├── mapHtml.js        # Leaflet HTML/JS bundle with custom teardrop pins
│   │   ├── geo.js            # Haversine distance & Nominatim reverse geocoding
│   │   ├── nearbyReports.js  # Distance formatting, radius filtering & coords parser
│   │   ├── reportListing.js  # Autocomplete title search & list sorting
│   │   ├── reportFilters.js  # Multidimensional report filtering logic
│   │   ├── categoryMeta.js   # Color schemes, icons, and category label normalizers
│   │   ├── communityAlerts.js# Outage modes and urgent issue filters
│   │   └── severity.js       # Severity calculator from depth, people & road impact
│   ├── data/
│   │   └── helpContacts.js   # Official emergency & municipal helpline directory
│   └── lib/
│       └── supabase.js       # Supabase client initialization
└── supabase/
    └── schema.sql            # PostgreSQL schema, RLS policies, and storage setup
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/go) on your physical mobile device, or an iOS Simulator / Android Emulator

### 1. Clone the Repository
```bash
git clone https://github.com/kartikktripathi/AquaPulse.git
cd AquaPulse
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root based on [`.env.example`](.env.example):
```bash
cp .env.example .env
```

Add your Supabase project credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Set Up Supabase Database & Storage
1. Open your [Supabase Dashboard](https://app.supabase.com/).
2. Navigate to the **SQL Editor**.
3. Paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   - Creates the `public."Report"` table with spatial coordinates and metadata.
   - Configures public read, insert, and update Row Level Security (RLS) policies.
   - Creates the `report-photos` storage bucket with public CDN read/write access.

### 5. Run the Application
Start the Expo development server:
```bash
npx expo start
```

From the terminal interface, you can press:
- `w` to open the web version in your browser.
- `a` to open in an Android Emulator.
- `i` to open in an iOS Simulator.
- Scan the displayed QR code with the **Expo Go** app on your phone.

---

## Database Architecture

AquaPulse uses Supabase PostgreSQL. Key columns in the `public."Report"` table:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Unique report identifier |
| `name` | `TEXT NOT NULL` | Title of the water issue |
| `categoryId` | `TEXT NOT NULL` | Normalized category ID (e.g. `pipe_leakage`) |
| `categoryLabel` | `TEXT NOT NULL` | Human-readable label (e.g. `Pipe Leakage`) |
| `latitude` | `DOUBLE PRECISION` | Latitude of the pinned water issue |
| `longitude` | `DOUBLE PRECISION` | Longitude of the pinned water issue |
| `userLatitude` | `DOUBLE PRECISION` | Submitting device's GPS latitude |
| `userLongitude` | `DOUBLE PRECISION` | Submitting device's GPS longitude |
| `distanceFromUser` | `DOUBLE PRECISION` | Distance between user GPS and pinned problem |
| `addressLine1` | `TEXT` | Road / street name |
| `landmark` | `TEXT` | Nearby landmark |
| `description` | `TEXT` | Detailed description of the issue |
| `severity` | `TEXT` | Calculated severity: `low`, `medium`, or `high` |
| `waterDepth` | `TEXT` | `ankle`, `knee`, or `waist` |
| `peopleAffected` | `TEXT` | Number/scale of impacted citizens |
| `roadBlocked` | `TEXT` | `clear`, `partial`, or `blocked` |
| `photos` | `JSONB / TEXT[]` | Array of public CDN photo URLs |
| `status` | `TEXT` | `reported`, `review`, or `fixed` |
| `createdAt` | `TIMESTAMPTZ` | Submission timestamp |

---

## Permissions & Privacy

- **Location (`expo-location`)**: Required to enforce the 500-meter reporting boundary, center the map, and filter nearby reports. Location browsing is opt-in; reports can still be viewed in the list without granting location.
- **Camera & Photos (`expo-image-picker`)**: Used exclusively when attaching visual evidence to a report or contributing evidence to an existing report.
- **Privacy Notice**: AquaPulse is a crowd-sourced civic tool. Photos and descriptions submitted are publicly visible to all app users. Personal private information (such as private house interiors or personal documents) should not be uploaded.

---

## Disclaimer

AquaPulse is an open-source civic technology and educational student project. It is **not** an official municipal agency or emergency rescue dispatcher. Submitting a report does not constitute an official municipal complaint. For life-threatening emergencies or immediate municipal assistance, please contact:
- **National Emergency Response Support System (India):** Dial `112`
- **Pune Municipal Corporation Helpline:** `1800-1030-222`

---

## Contributing & License

Contributions, issue reports, and suggestions are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
