import { Platform } from 'react-native';
import type { ImageBlob, EmbeddingResult, LivenessResult } from '../faceCapture';

type LatLon = {
  latitude: number;
  longitude: number;
};

type Embedding = number[];

const TFLITE_MODEL_FILE = Platform.OS === 'ios' ? 'face_embed_ios.tflite' : 'face_embed_android.tflite';
const TFLITE_INPUT_WIDTH = 112;
const TFLITE_INPUT_HEIGHT = 112;
const EMBEDDING_SIZE = 128;

const NATIVE_MODULES_AVAILABLE = false;

let tfliteModel: any = null;

export async function initEmbeddingModel(): Promise<void> {
  if (!NATIVE_MODULES_AVAILABLE) {
    console.log('[mlkit-adapter] Native modules not available (Expo Go). Using fallback.');
    return;
  }

  try {
    const TfliteReactNative = require('tflite-react-native').default;
    tfliteModel = new TfliteReactNative();
    
    await tfliteModel.loadModel({
      model: TFLITE_MODEL_FILE,
    });
    console.log('[mlkit-adapter] TFLite model loaded:', TFLITE_MODEL_FILE);
  } catch (err) {
    console.error('[mlkit-adapter] loadModel error', err);
    throw err;
  }
}

export async function captureFaceImage(cameraRef?: any): Promise<ImageBlob | null> {
  if (!NATIVE_MODULES_AVAILABLE) {
    console.log('[mlkit-adapter] Native camera not available. Using mock.');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      uri: 'https://via.placeholder.com/400x400/4A90E2/FFFFFF?text=Face',
      width: 400,
      height: 400,
    };
  }

  if (!cameraRef?.current) {
    console.warn('[mlkit-adapter] captureFaceImage: cameraRef missing');
    return null;
  }

  try {
    const photo = await cameraRef.current.takePhoto({
      flash: 'off',
      qualityPrioritization: 'speed',
      skipMetadata: true,
    });
    
    const uri = photo.path || photo.uri || photo;
    return { uri, width: photo.width || 0, height: photo.height || 0 };
  } catch (err) {
    console.error('[mlkit-adapter] captureFaceImage error', err);
    return null;
  }
}

export async function runLivenessCheck(
  cameraRef?: any,
  framesToCapture = 3,
  timeoutMs = 5000
): Promise<LivenessResult> {
  if (!NATIVE_MODULES_AVAILABLE) {
    console.log('[mlkit-adapter] Liveness check using mock');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const passed = Math.random() > 0.1;
    return {
      passed,
      confidence: passed ? 0.95 : 0.45,
      reason: passed ? 'Liveness detected (mock)' : 'Failed liveness check (mock)',
    };
  }

  try {
    const getFaceDetector = require('./mlkitWrapper').getFaceDetector;
    const detector = getFaceDetector();
    const landmarksSeq: any[] = [];

    const start = Date.now();
    for (let i = 0; i < framesToCapture; i++) {
      await new Promise(res => setTimeout(res, 250));
      const snapshot = await cameraRef.current.takePhoto({ 
        qualityPrioritization: 'speed', 
        skipMetadata: true 
      });
      const uri = snapshot.path || snapshot.uri;
      
      const faces = await detector.detectFacesFromFile(uri);
      if (faces?.length > 0) {
        landmarksSeq.push(faces[0]);
      }
      if (Date.now() - start > timeoutMs) break;
    }

    if (landmarksSeq.length < 2) {
      return { 
        passed: false, 
        confidence: 0,
        reason: 'not_enough_face_frames' 
      };
    }

    const eyeChange = landmarksSeq.some((f, idx) => {
      if (idx === 0) return false;
      const prev = landmarksSeq[idx - 1];
      const deltaLeftEye = Math.abs((f.leftEyeOpenProbability || 0) - (prev.leftEyeOpenProbability || 0));
      const deltaRightEye = Math.abs((f.rightEyeOpenProbability || 0) - (prev.rightEyeOpenProbability || 0));
      return deltaLeftEye > 0.12 || deltaRightEye > 0.12;
    });

    const posChange = landmarksSeq.some((f, idx) => {
      if (idx === 0) return false;
      const prev = landmarksSeq[idx - 1];
      const dx = Math.abs((f.boundingBox?.centerX || 0) - (prev.boundingBox?.centerX || 0));
      const dy = Math.abs((f.boundingBox?.centerY || 0) - (prev.boundingBox?.centerY || 0));
      return dx > 5 || dy > 5;
    });

    const passed = eyeChange || posChange;
    return { 
      passed, 
      confidence: passed ? 0.85 : 0.3,
      reason: passed ? 'Liveness detected' : 'Static image detected'
    };
  } catch (err) {
    console.error('[mlkit-adapter] runLivenessCheck error', err);
    return { 
      passed: false, 
      confidence: 0,
      reason: (err as Error)?.message || 'Liveness check failed' 
    };
  }
}

export async function computeEmbedding(image: ImageBlob): Promise<EmbeddingResult> {
  if (!NATIVE_MODULES_AVAILABLE) {
    console.log('[mlkit-adapter] Computing mock embedding');
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const seed = image.uri.length * 0.001;
    return {
      embedding: generateMockEmbedding(seed),
      quality: 0.88,
    };
  }

  try {
    const resizedBase64 = await preprocessImageForModel(image.uri, TFLITE_INPUT_WIDTH, TFLITE_INPUT_HEIGHT);
    
    const result = await tfliteModel.runModelOnImage({
      path: resizedBase64,
      inputShape: [TFLITE_INPUT_WIDTH, TFLITE_INPUT_HEIGHT, 3],
      outputShape: [EMBEDDING_SIZE],
      imageMean: 127.5,
      imageStd: 127.5,
    });

    if (!result || !Array.isArray(result)) {
      console.warn('[mlkit-adapter] computeEmbedding: tflite returned unexpected result', result);
      return { embedding: [], quality: 0 };
    }
    
    const emb = (result as number[]).slice(0, EMBEDDING_SIZE);
    const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
    const normalized = emb.map(v => v / (norm || 1));
    
    return {
      embedding: normalized,
      quality: 0.85,
    };
  } catch (err) {
    console.error('[mlkit-adapter] computeEmbedding error', err);
    return { embedding: [], quality: 0 };
  }
}

export function compareEmbeddings(e1: Embedding, e2: Embedding): number {
  if (!e1 || !e2 || e1.length !== e2.length) return 0;
  
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  
  for (let i = 0; i < e1.length; i++) {
    dot += e1[i] * e2[i];
    a2 += e1[i] * e1[i];
    b2 += e2[i] * e2[i];
  }
  
  const denom = Math.sqrt(a2) * Math.sqrt(b2) || 1;
  const cosine = dot / denom;
  const similarity = (cosine + 1) / 2;
  
  return similarity;
}

async function preprocessImageForModel(uri: string, width: number, height: number): Promise<string> {
  if (!NATIVE_MODULES_AVAILABLE) {
    return uri;
  }

  try {
    const ImageResizer = require('react-native-image-resizer').default;
    const resized = await ImageResizer.createResizedImage(
      uri,
      width,
      height,
      'JPEG',
      80,
      0
    );
    return resized.uri;
  } catch (err) {
    console.error('[mlkit-adapter] preprocessImageForModel error', err);
    return uri;
  }
}

function generateMockEmbedding(seed: number = Math.random()): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_SIZE; i++) {
    embedding.push(Math.sin(seed * (i + 1)) * 0.5 + 0.5);
  }
  return embedding;
}

export async function decryptAndGetEmbedding(encryptedTemplate: any): Promise<Embedding | null> {
  if (!encryptedTemplate) return null;
  return encryptedTemplate.embedding || null;
}

export async function signProof(embedding: Embedding, gps: LatLon): Promise<string> {
  return 'signed-proof-placeholder';
}

export default {
  initEmbeddingModel,
  captureFaceImage,
  runLivenessCheck,
  computeEmbedding,
  compareEmbeddings,
  decryptAndGetEmbedding,
  signProof,
};
