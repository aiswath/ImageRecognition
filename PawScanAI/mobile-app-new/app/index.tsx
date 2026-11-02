import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Image, Platform, Pressable,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios, { isAxiosError } from 'axios';

const BRAND_ART = require('../assets/images/pawscan-original.png');
const MASCOTS = require('../assets/images/pawscan-mascots.png');
const API_URL = process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000/predict' : 'http://localhost:8000/predict');
const colors = {
  cream: '#FFF9EF', paper: '#FFFFFF', ink: '#4B2B22', muted: '#796354',
  orange: '#BB430D', peach: '#FFF0DF', yellow: '#FFD66B', line: '#EEDCC8',
};

type Prediction = { class: string; confidence: number };
type Result = {
  status: 'ok' | 'no_dog_detected';
  predictions: Prediction[];
  message: string;
};
type PhotoButtonProps = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled: boolean;
  secondary?: boolean;
};

function PhotoButton({ title, icon, onPress, disabled, secondary = false }: PhotoButtonProps) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [
        styles.button, secondary && styles.secondaryButton,
        pressed && styles.pressed, disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={21} color={secondary ? colors.ink : '#FFFFFF'} />
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
      {!secondary && <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />}
    </Pressable>
  );
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const request = useRef<AbortController | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const compact = width < 370;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) entrance.setValue(1);
      else {
        animation = Animated.timing(entrance, {
          toValue: 1, duration: 380, useNativeDriver: Platform.OS !== 'web',
        });
        animation.start();
      }
    }).catch(() => entrance.setValue(1));
    return () => {
      active = false;
      animation?.stop();
      request.current?.abort();
    };
  }, [entrance]);

  const clear = () => {
    request.current?.abort();
    request.current = null;
    setImage(null);
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const predict = async (asset: ImagePicker.ImagePickerAsset) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setImage(asset.uri);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const file = asset.file || await (await fetch(asset.uri)).blob();
        formData.append('file', file, asset.fileName || 'dog.jpg');
      } else {
        // React Native accepts URI-backed files instead of browser Blob objects.
        formData.append('file', {
          uri: asset.uri, name: asset.fileName || 'dog.jpg', type: asset.mimeType || 'image/jpeg',
        } as unknown as Blob);
      }
      const response = await axios.post<Result>(API_URL, formData, {
        signal: controller.signal, timeout: 60000,
      });
      if (request.current === controller) setResult(response.data);
    } catch (err) {
      if (request.current === controller && !controller.signal.aborted) {
        const detail = isAxiosError(err) ? err.response?.data?.detail : null;
        setError(typeof detail === 'string' ? detail : 'We couldn’t reach the breed scanner. Check your connection and try again.');
      }
    } finally {
      if (request.current === controller) setLoading(false);
    }
  };

  const choosePhoto = async (camera: boolean) => {
    if (picking || loading) return;
    setPicking(true);
    setError(null);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Allow camera access to take a photo, or choose one from your gallery.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: true, quality: 1,
      };
      const picked = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!picked.canceled && picked.assets[0]) {
        // Release the picker state so cancelling a scan enables another photo.
        setPicking(false);
        await predict(picked.assets[0]);
      }
    } catch {
      setError('The photo picker couldn’t open. Give it another try.');
    } finally {
      setPicking(false);
    }
  };

  const busy = loading || picking;
  const bestMatch = result?.status === 'ok' ? result.predictions[0] : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[
          styles.content,
          { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        ]}>
          <View style={styles.header}>
            <Image source={BRAND_ART} style={styles.brandIcon} accessibilityLabel="PawScan AI, three happy dogs" />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>PawScan <Text style={styles.brandAccent}>AI</Text></Text>
              <Text style={styles.brandTagline}>Little paws. Big personalities.</Text>
            </View>
            <View style={styles.headerPaw} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="paw" size={22} color={colors.orange} />
            </View>
          </View>

          {!image && <View style={styles.hero}>
            <View style={styles.heroCircle} />
            <View style={styles.heroText}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="sparkles" size={13} color={colors.orange} />
                <Text style={styles.eyebrow}>HELLO, DOG PERSON</Text>
              </View>
              <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Who’s that{ '\n' }good dog?</Text>
              <Text style={styles.heroSubtitle}>Find your pup’s breed{ '\n' }lookalikes, one snap at a time.</Text>
              <View style={styles.breedPill}>
                <Ionicons name="paw" size={13} color={colors.ink} />
                <Text style={styles.breedPillText}>118 breed categories</Text>
              </View>
            </View>
            <Image source={MASCOTS} style={[styles.heroArt, compact && styles.heroArtCompact]} resizeMode="contain" accessibilityLabel="Corgi, golden retriever and husky mascots" />
          </View>}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>{image ? 'Your pup, in the spotlight' : 'Let’s meet your pup'}</Text>
              <Text style={styles.sectionSubtitle}>{image ? 'The next best thing to a nose boop.' : 'One photo. Three paw-sibilities.'}</Text>
            </View>
            <Ionicons name="heart-outline" size={24} color={colors.orange} accessibilityElementsHidden />
          </View>

          <View style={[styles.photoCard, !image && styles.emptyCard]}>
            {image ? <View style={styles.photoFrame}>
              <Image source={{ uri: image }} style={styles.photo} resizeMode="contain" accessibilityLabel="Your selected dog photo" />
              <View style={styles.photoBadge}><Ionicons name="heart" size={13} color={colors.orange} /><Text style={styles.photoBadgeText}>A new friend to meet</Text></View>
            </View> : <View style={styles.emptyState}>
              <View style={styles.pawCircle}>
                <Ionicons name="paw" size={40} color={colors.orange} />
                <View style={styles.sparkle}><Ionicons name="sparkles" size={18} color={colors.ink} /></View>
              </View>
              <Text style={styles.emptyTitle}>Your best friend goes here</Text>
              <Text style={styles.emptyText}>Choose a favorite photo or capture{ '\n' }a fresh, tail-wagging moment.</Text>
            </View>}
            <View style={styles.photoActions}>
              <PhotoButton title={image ? 'Choose Another Photo' : 'Pick from Gallery'} icon="images-outline" onPress={() => choosePhoto(false)} disabled={busy} />
              <PhotoButton title="Take Photo" icon="camera-outline" onPress={() => choosePhoto(true)} disabled={busy} secondary />
              {!image && <Text style={styles.fileHint}>JPG, PNG or WebP · Up to 10 MiB</Text>}
            </View>
          </View>

          {loading && <View style={styles.scanCard} accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityLabel="Finding breed matches">
            <ActivityIndicator color={colors.orange} size="small" />
            <View style={styles.flex}><Text style={styles.scanTitle}>Following the paw prints…</Text><Text style={styles.scanText}>Finding your pup’s closest breed matches.</Text></View>
          </View>}

          {error && <View style={styles.errorCard} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Ionicons name="alert-circle-outline" size={24} color="#9D3424" />
            <View style={styles.flex}><Text style={styles.errorTitle}>A little hiccup</Text><Text style={styles.errorText}>{error}</Text></View>
          </View>}

          {bestMatch && result && !loading && <View style={styles.resultCard} accessibilityLiveRegion="polite">
            <View style={styles.resultEyebrow}><Ionicons name="ribbon-outline" size={19} color={colors.orange} /><Text style={styles.eyebrow}>YOUR PUP’S LOOKALIKES</Text></View>
            <Text style={styles.matchTitle}>{bestMatch.confidence < 0.5 ? 'A few possible matches' : 'The closest breed match'}</Text>
            <Text style={styles.bestBreed}>{bestMatch.class}</Text>
            <Text style={styles.matchSubtitle}>Three guesses from one very good photo.</Text>
            <View style={styles.scoreHeadingRow}><Text style={styles.scoreHeading}>BREED</Text><Text style={styles.scoreHeading}>MODEL SCORE</Text></View>
            {result.predictions.map((prediction, index) => <View key={prediction.class} style={styles.prediction}>
              <View style={[styles.rank, index === 0 && styles.rankFirst]}><Text style={styles.rankText}>{index + 1}</Text></View>
              <View style={styles.flex}>
                <View style={styles.predictionHeading}><Text style={styles.breedName}>{prediction.class}</Text><Text style={styles.score}>{(prediction.confidence * 100).toFixed(2)}%</Text></View>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, prediction.confidence * 100))}%` }, index > 0 && styles.barFillOther]} /></View>
              </View>
            </View>)}
            <View style={styles.resultNote}><Ionicons name="information-circle-outline" size={17} color={colors.muted} /><Text style={styles.resultNoteText}>{result.message}</Text></View>
          </View>}

          {result?.status === 'no_dog_detected' && !loading && <View style={styles.noDogCard} accessibilityLiveRegion="polite">
            <View style={styles.noDogIcon}><Ionicons name="search" size={28} color={colors.orange} /></View>
            <Text style={styles.noDogTitle}>Let’s give it another sniff</Text>
            <Text style={styles.noDogText}>{result.message}</Text>
            <Text style={styles.noDogTip}>One pup + good light + a closer photo = a better start.</Text>
          </View>}

          {image && <Pressable onPress={clear} accessibilityRole="button" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Ionicons name={loading ? 'close-circle-outline' : 'refresh-outline'} size={18} color={colors.orange} />
            <Text style={styles.clearText}>{loading ? 'Cancel Scan' : 'Start a New Scan'}</Text>
          </Pressable>}

          {!image && <View style={styles.tipCard}>
            <View style={styles.tipIcon}><Ionicons name="bulb-outline" size={22} color={colors.ink} /></View>
            <View style={styles.flex}><Text style={styles.tipTitle}>A little photo tip</Text><Text style={styles.tipText}>One dog, good light, and those adorable ears in the frame.</Text></View>
          </View>}
          <View style={styles.footer}>
            <View style={styles.footerHeading}><Ionicons name="heart" size={12} color={colors.orange} /><Text style={styles.footerTitle}>Every pup is one of a kind.</Text></View>
            <Text style={styles.footerText}>A visual breed estimate, not a pedigree. Mixed breeds and unfamiliar photos can be tricky.</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26 },
  content: { width: '100%', maxWidth: 540 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandIcon: { width: 48, height: 48, borderRadius: 15 },
  brandCopy: { flex: 1 },
  brandName: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  brandAccent: { color: colors.orange },
  brandTagline: { color: colors.muted, fontSize: 11, marginTop: 3 },
  headerPaw: { width: 42, height: 42, backgroundColor: colors.peach, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 230, backgroundColor: '#FFE8A5', borderRadius: 28, overflow: 'hidden', padding: 22, marginBottom: 26, justifyContent: 'center' },
  heroCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -65, top: -48, backgroundColor: '#FFD36B' },
  heroText: { width: '60%', zIndex: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  eyebrow: { color: colors.orange, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  heroTitle: { color: colors.ink, fontSize: 32, fontWeight: '800', lineHeight: 36, letterSpacing: -1 },
  heroTitleCompact: { fontSize: 25, lineHeight: 30 },
  heroSubtitle: { color: '#74513A', fontSize: 12, lineHeight: 19, marginTop: 10 },
  breedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF6D9', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 30, marginTop: 15 },
  breedPillText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  heroArt: { position: 'absolute', width: '56%', height: 220, right: -16, top: 13, transform: [{ rotate: '5deg' }] },
  heroArtCompact: { right: -20, height: 200, top: 25 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  photoCard: { backgroundColor: colors.paper, borderRadius: 26, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  emptyCard: { borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#E6BB8C' },
  emptyState: { alignItems: 'center', paddingTop: 27, paddingHorizontal: 12 },
  pawCircle: { height: 82, width: 82, borderRadius: 29, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }], marginBottom: 17 },
  sparkle: { position: 'absolute', right: -7, top: -4, backgroundColor: colors.yellow, width: 30, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 8 },
  photoActions: { padding: 18, gap: 10 },
  button: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: colors.orange, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  secondaryButton: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.ink },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  fileHint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 3 },
  photoFrame: { margin: 10, marginBottom: 0, borderRadius: 20, backgroundColor: colors.peach, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1 },
  photoBadge: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cream, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  photoBadgeText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  scanCard: { padding: 18, borderRadius: 20, backgroundColor: '#FFF0CC', flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  scanTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  scanText: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  errorCard: { backgroundColor: '#FFF0EB', borderRadius: 20, padding: 18, marginTop: 16, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#EBC2B7' },
  errorTitle: { color: '#9D3424', fontSize: 15, fontWeight: '700', marginBottom: 5 },
  errorText: { color: '#783E31', fontSize: 13, lineHeight: 20 },
  resultCard: { backgroundColor: colors.paper, padding: 22, borderRadius: 26, borderWidth: 1, borderColor: colors.line, marginTop: 20 },
  resultEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  matchTitle: { color: colors.muted, fontSize: 13 },
  bestBreed: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginTop: 5, textTransform: 'capitalize' },
  matchSubtitle: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  scoreHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  scoreHeading: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, color: colors.muted },
  prediction: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  rank: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  rankFirst: { backgroundColor: colors.yellow },
  rankText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  predictionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  breedName: { color: colors.ink, fontSize: 13, fontWeight: '600', flex: 1, textTransform: 'capitalize' },
  score: { color: colors.orange, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barTrack: { height: 6, borderRadius: 6, backgroundColor: '#F6EBDD', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: colors.orange },
  barFillOther: { backgroundColor: '#F3B34F' },
  resultNote: { flexDirection: 'row', gap: 7, borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  resultNoteText: { color: colors.muted, fontSize: 11, lineHeight: 17, flex: 1 },
  noDogCard: { alignItems: 'center', padding: 24, backgroundColor: '#FFF0D4', borderRadius: 26, marginTop: 20 },
  noDogIcon: { backgroundColor: '#FFE2AC', width: 62, height: 62, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  noDogTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  noDogText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  noDogTip: { color: colors.ink, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  clearButton: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  clearText: { color: colors.orange, fontWeight: '700', fontSize: 13 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, borderRadius: 20, backgroundColor: '#FFF0CC', marginTop: 18 },
  tipIcon: { backgroundColor: colors.yellow, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  tipTitle: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  tipText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  footer: { alignItems: 'center', marginTop: 26, paddingHorizontal: 12 },
  footerHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  footerText: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 7, maxWidth: 310 },
});
