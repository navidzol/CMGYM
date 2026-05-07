import { View, Text, StyleSheet } from 'react-native';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reports</Text>
      <Text style={styles.subtitle}>Complete some sessions to see your progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#6B6B8A', fontSize: 16, marginTop: 8 },
});
