export function getAreaName(report) {
  if (!report || !report.addressLine2) {
    return 'Not recorded';
  }
  const parts = String(report.addressLine2)
    .split(',')
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);

  if (parts.length === 0) {
    return 'Not recorded';
  }
  return parts[parts.length - 1];
}

export function buildAreaTrends(reports, now) {
  if (!Array.isArray(reports)) {
    return [];
  }
  const ref = now ? new Date(now) : new Date();
  if (!Number.isFinite(ref.getTime())) {
    return [];
  }
  const day = ref.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monThis = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate() - daysSinceMonday,
    0, 0, 0, 0
  );
  const thisWeekStart = monThis.getTime();
  const thisWeekEnd = new Date(monThis.getFullYear(), monThis.getMonth(), monThis.getDate() + 7, 0, 0, 0, 0).getTime();
  const w1Start = new Date(monThis.getFullYear(), monThis.getMonth(), monThis.getDate() - 7, 0, 0, 0, 0).getTime();
  const w2Start = new Date(monThis.getFullYear(), monThis.getMonth(), monThis.getDate() - 14, 0, 0, 0, 0).getTime();
  const w3Start = new Date(monThis.getFullYear(), monThis.getMonth(), monThis.getDate() - 21, 0, 0, 0, 0).getTime();
  const w4Start = new Date(monThis.getFullYear(), monThis.getMonth(), monThis.getDate() - 28, 0, 0, 0, 0).getTime();

  const areasMap = {};

  reports.forEach(function (report) {
    if (!report) {
      return;
    }
    const area = getAreaName(report);
    if (!areasMap[area]) {
      areasMap[area] = {
        area: area,
        thisWeek: 0,
        lastWeek: 0,
        w2: 0,
        w3: 0,
        w4: 0
      };
    }
    const t = report.createdAt ? new Date(report.createdAt).getTime() : NaN;
    if (!Number.isFinite(t)) {
      return;
    }
    if (t >= thisWeekStart && t < thisWeekEnd) {
      areasMap[area].thisWeek += 1;
    } else if (t >= w1Start && t < thisWeekStart) {
      areasMap[area].lastWeek += 1;
    } else if (t >= w2Start && t < w1Start) {
      areasMap[area].w2 += 1;
    } else if (t >= w3Start && t < w2Start) {
      areasMap[area].w3 += 1;
    } else if (t >= w4Start && t < w3Start) {
      areasMap[area].w4 += 1;
    }
  });

  const result = Object.values(areasMap).map(function (item) {
    const change = item.thisWeek - item.lastWeek;
    const sumPrior4 = item.lastWeek + item.w2 + item.w3 + item.w4;
    const fourWeekAverage = sumPrior4 / 4;
    return {
      area: item.area,
      thisWeek: item.thisWeek,
      lastWeek: item.lastWeek,
      change: change,
      fourWeekAverage: fourWeekAverage
    };
  });

  result.sort(function (a, b) {
    if (b.change !== a.change) {
      return b.change - a.change;
    }
    return b.thisWeek - a.thisWeek;
  });

  return result;
}

