export const DEPTH_OPTIONS = [
  { id: 'none', label: 'None', points: 0 },
  { id: 'ankle', label: 'Ankle-deep', points: 1 },
  { id: 'knee', label: 'Knee-deep', points: 2 },
  { id: 'waist', label: 'Waist-deep', points: 3 },
  { id: 'vehicle', label: 'Vehicle-height', points: 4 },
];

export const PEOPLE_OPTIONS = [
  { id: 'none', label: 'None', points: 0 },
  { id: 'some', label: 'A few people', points: 1 },
  { id: 'many', label: 'Many people', points: 2 },
];

export const ROAD_OPTIONS = [
  { id: 'not_blocked', label: 'Not blocked', points: 0 },
  { id: 'blocked', label: 'Road blocked', points: 1 },
];

export const SEVERITY_META = {
  low: { label: 'Low', color: '#34C759', bg: '#eefbf2' },
  medium: { label: 'Medium', color: '#FF9500', bg: '#fff8ed' },
  high: { label: 'High', color: '#FF3B30', bg: '#fff1f0' },
};

export function getSeverity({ waterDepth, peopleAffected, roadBlocked }) {
  const depthOpt = DEPTH_OPTIONS.find((o) => o.id === waterDepth);
  const peopleOpt = PEOPLE_OPTIONS.find((o) => o.id === peopleAffected);
  const roadOpt = ROAD_OPTIONS.find((o) => o.id === roadBlocked);
  const total =
    (depthOpt ? depthOpt.points : 0) +
    (peopleOpt ? peopleOpt.points : 0) +
    (roadOpt ? roadOpt.points : 0);
  if (total <= 2) return 'low';
  if (total <= 4) return 'medium';
  return 'high';
}

