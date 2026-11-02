import { useState } from 'react';
import { 
  StyleSheet, Text, View, Image, 
  TouchableOpacity, ActivityIndicator, ScrollView 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Replace with your PC's local IP address
const API_URL = "http://192.168.0.14:8000/predict";

export default function App() {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!picked.canceled) {
      setImage(picked.assets[0].uri);
      setResult(null);
      predict(picked.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    let photo = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!photo.canceled) {
      setImage(photo.assets[0].uri);
      setResult(null);
      predict(photo.assets[0].uri);
    }
  };

  const predict = async (uri) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const response = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(response.data);
    } catch (err) {
      setResult({ error: 'Could not connect to API. Is the server running?' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🥔 Potato Disease Detector</Text>

      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>📷 Pick from Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={takePhoto}>
        <Text style={styles.buttonText}>📸 Take Photo</Text>
      </TouchableOpacity>

      {image && <Image source={{ uri: image }} style={styles.image} />}

      {loading && <ActivityIndicator size="large" color="#4CAF50" style={{marginTop: 20}} />}

      {result && !loading && (
        <View style={styles.result}>
          {result.error ? (
            <Text style={styles.error}>{result.error}</Text>
          ) : (
            <>
              <Text style={styles.label}>Disease: {result.class}</Text>
              <Text style={styles.confidence}>
                Confidence: {(result.confidence * 100).toFixed(2)}%
              </Text>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, color: '#2e7d32' },
  button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, width: '80%', alignItems: 'center', marginBottom: 15 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  image: { width: 300, height: 300, borderRadius: 10, marginTop: 20 },
  result: { marginTop: 20, padding: 20, backgroundColor: 'white', borderRadius: 10, width: '80%', alignItems: 'center' },
  label: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32' },
  confidence: { fontSize: 16, color: '#555', marginTop: 5 },
  error: { color: 'red', fontSize: 14 },
});