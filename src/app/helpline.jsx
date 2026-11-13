import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import InfoPage, { ActionButton, infoStyles as s, useExternalLink } from '../components/InfoPage';
import { HELP_CONTACTS, PMC_WEBSITE } from '../data/helpContacts';

export default function Helpline() {
  const [contact, setContact] = useState(null);
  const { openLink, linkError } = useExternalLink();
  return <InfoPage title="Emergency Helpline" subtitle="Choose the service for your location">
    <View style={[s.card, { backgroundColor: '#fff7ef' }]}>
      <Text style={s.heading}>Need immediate help?</Text>
      <Text style={s.body}>Use emergency services for immediate danger. Posting a report in AquaPulse does not dispatch help.</Text>
    </View>
    {linkError && <Text accessibilityRole="alert" style={s.error}>{linkError}</Text>}
    {HELP_CONTACTS.map((item) => <View key={item.id} style={s.card}>
      <Text style={s.muted}>{item.region}</Text><Text style={s.heading}>{item.name}</Text>
      <Text selectable style={styles.number}>{item.number}</Text><Text style={s.body}>{item.description}</Text>
      <ActionButton label={`Call ${item.number}`} onPress={() => setContact(item)} />
      <ActionButton secondary label={`Source: ${item.sourceName}`} onPress={() => openLink(item.source)} />
      <Text selectable style={s.muted}>{item.source}</Text>
    </View>)}
    <View style={s.card}><Text style={s.heading}>Outside Pune city?</Text>
      <Text style={s.body}>The PMC contact applies only within PMC limits. For routine water complaints elsewhere, use your local water provider or municipal authority. Your location is not detected on this page.</Text>
      <ActionButton secondary label="Open Pune municipal website" onPress={() => openLink(PMC_WEBSITE)} />
      <Text selectable style={s.muted}>{PMC_WEBSITE}</Text>
      <Text style={s.muted}>Official directory sources checked on 13 November 2026. Numbers may change; source links are provided above.</Text>
    </View>
    {!!contact && <Modal visible transparent animationType="fade" onRequestClose={() => setContact(null)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel call" onPress={() => setContact(null)} />
        <View accessibilityViewIsModal style={[s.card, styles.dialog]}>
          <Text accessibilityRole="header" style={s.heading}>Open the dialer?</Text>
          <Text style={s.body}>{contact.name} · {contact.region}</Text>
          <Text selectable style={styles.number}>{contact.number}</Text>
          <Text style={s.muted}>Your device handles the call. If calling is unavailable, dial this number manually on a phone.</Text>
          <ActionButton label={`Open dialer for ${contact.number}`} onPress={() => { const number = contact.dial; setContact(null); openLink(`tel:${number}`); }} />
          <ActionButton secondary label="Cancel" onPress={() => setContact(null)} />
        </View>
      </View>
    </Modal>}
  </InfoPage>;
}
const styles = StyleSheet.create({
  number: { fontSize: 28, color: '#172b40', fontWeight: '700' },
  overlay: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0007' },
  dialog: { width: '100%', maxWidth: 440 },
});
