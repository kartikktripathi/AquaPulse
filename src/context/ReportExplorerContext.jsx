import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getReportsSnapshot } from '../services/reportService';
import { createReportFilters, filterReports, getMapReports } from '../utils/reportFilters';

const ReportExplorerContext = createContext(null);

export function ReportExplorerProvider({ children }) {
  const [filters, setFilters] = useState(createReportFilters);
  const [snapshot, setSnapshot] = useState({ reports: [], source: null, error: null });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const request = useRef(null);

  const refreshReports = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const next = await getReportsSnapshot({ signal: controller.signal });
      if (!controller.signal.aborted) {
        setSnapshot(next);
        setNow(new Date());
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Keep calendar presets correct when the app remains open across midnight.
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(timer); request.current?.abort(); };
  }, []);

  const resetFilters = useCallback(() => setFilters(createReportFilters()), []);
  const filterClock = ['today', '7days', '30days'].includes(filters.date) ? now : null;
  const filteredReports = useMemo(() => filterReports(snapshot.reports, filters, filterClock || new Date()), [snapshot.reports, filters, filterClock]);
  const mapReports = useMemo(() => getMapReports(filteredReports), [filteredReports]);
  const value = { filters, setFilters, resetFilters, reports: snapshot.reports, filteredReports, mapReports,
    loading, error: snapshot.error, source: snapshot.source, refreshReports, now };

  return <ReportExplorerContext.Provider value={value}>{children}</ReportExplorerContext.Provider>;
}

export function useReportExplorer() {
  const value = useContext(ReportExplorerContext);
  if (!value) throw new Error('ReportExplorerProvider is required.');
  return value;
}
