const PREFIX = 'aquapulse.demo.report.v1.';

export async function readLocalReports() {
  const storage = window.localStorage;
  return Object.keys(storage).filter((key) => key.startsWith(PREFIX))
    .map((key) => JSON.parse(storage.getItem(key)));
}

export async function writeLocalReport(report) {
  try {
    window.localStorage.setItem(`${PREFIX}${report.id}`, JSON.stringify(report));
  } catch {
    throw new Error('Could not save on this browser. Allow site storage or try fewer/smaller photos. Your form is still available.');
  }
}
