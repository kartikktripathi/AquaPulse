import * as FileSystem from 'expo-file-system/legacy';

async function reportDirectory() {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable on this device.');
  const directory = `${FileSystem.documentDirectory}aquapulse-demo-reports/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export async function readLocalReports() {
  const directory = await reportDirectory();
  const names = await FileSystem.readDirectoryAsync(directory);
  return Promise.all(names.filter((name) => name.endsWith('.json')).map(async (name) =>
    JSON.parse(await FileSystem.readAsStringAsync(`${directory}${name}`))
  ));
}

export async function writeLocalReport(report) {
  const directory = await reportDirectory();
  const temporary = `${directory}${report.id}.tmp`;
  await FileSystem.writeAsStringAsync(temporary, JSON.stringify(report));
  await FileSystem.moveAsync({ from: temporary, to: `${directory}${report.id}.json` });
}
