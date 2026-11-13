import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import InfoPage, { ActionButton, infoStyles as s } from '../components/InfoPage';

export default function About() {
  const router = useRouter();
  return <InfoPage title="About AquaPulse" subtitle={`Version ${Constants.expoConfig?.version || '1.0.0'}`}>
    <View style={[s.card, { backgroundColor: '#edf5ff' }]}><Text style={s.heading}>Water issues, made visible</Text>
      <Text style={s.body}>AquaPulse is a student team project for reporting water problems and exploring shared reports on a map. It helps communities see where issues have been reported.</Text>
      <Text style={s.muted}>Built by a three-member student team. AquaPulse is not an official municipal service.</Text>
    </View>
    <View style={s.card}><Text style={s.heading}>How to use the app</Text>
      <Text style={s.body}>1. Open the map and allow location when you want to report an issue or find nearby reports.</Text>
      <Text style={s.body}>2. Pin the issue within the blue 500 m reporting zone, then tap + to add its category, description, address and any photos.</Text>
      <Text style={s.body}>3. Wait for the save confirmation. Browse All Reports, filter by category, or open a card to see its full details.</Text>
      <Text style={s.body}>4. Check Community Alerts for open issues. Contact the relevant authority separately for assistance.</Text>
      <ActionButton label="Browse reports" onPress={() => router.push('/reports')} />
    </View>
    <View style={s.card}><Text style={s.heading}>Permissions & shared information</Text>
      <Text style={s.body}>Location supports the map, the 500 m reporting zone and nearby searches. Browsing the report list does not require your location.</Text>
      <Text style={s.body}>Camera and photo permissions let you attach evidence. Submitted reports include photos, address details, the issue location and the submitting device's location, and are stored in the project's shared cloud database.</Text>
      <Text style={s.body}>Report details and photos are visible to other app users. Avoid including private information in descriptions or photos. You can manage permissions in your device settings.</Text>
    </View>
    <View style={s.card}><Text style={s.heading}>What the information means</Text>
      <Text style={s.body}>Reports come from the community. Severity and status show the recorded values; they do not guarantee confirmation by a water authority. Outage schedules and restoration times must be checked with your provider.</Text>
      <Text style={s.body}>There are no user accounts in this version. Submitting a report does not create an official municipal complaint or an emergency request.</Text>
      <ActionButton secondary label="Water Outages & Alerts" onPress={() => router.push('/alerts')} />
      <ActionButton secondary label="Find a helpline" onPress={() => router.push('/helpline')} />
    </View>
  </InfoPage>;
}
