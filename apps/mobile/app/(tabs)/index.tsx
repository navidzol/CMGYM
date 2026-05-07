import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Session</Text>
      <Text style={styles.subtitle}>No session planned for today</Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.buttonText}>Quick Start</Text>
        </Pressable>

        <Pressable style={[styles.primaryButton, styles.shuffleButton]}>
          <Text style={styles.buttonText}>Shuffle & Go</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D1A',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B6B8A',
    fontSize: 16,
    marginTop: 8,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5B4FE8',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shuffleButton: {
    backgroundColor: '#0ABFBC',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
