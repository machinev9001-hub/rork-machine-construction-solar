import { Platform } from 'react-native';
import * as adapter from './faceAdapters/mlkitTfliteAdapter';

export type ImageBlob = {
  uri: string;
  base64?: string;
  width: number;
  height: number;
};

export type LivenessResult = {
  passed: boolean;
  confidence: number;
  reason?: string;
};

export type EmbeddingResult = {
  embedding: number[];
  quality: number;
};

export async function captureFaceImage(cameraRef?: any): Promise<ImageBlob | null> {
  console.log('[FaceCapture] Capturing face image...');
  return adapter.captureFaceImage(cameraRef);
}

export async function runLivenessCheck(image: ImageBlob, cameraRef?: any): Promise<LivenessResult> {
  console.log('[FaceCapture] Running liveness check...');
  return adapter.runLivenessCheck(cameraRef);
}

export async function computeEmbedding(image: ImageBlob): Promise<EmbeddingResult> {
  console.log('[FaceCapture] Computing face embedding...');
  return adapter.computeEmbedding(image);
}

export function compareEmbeddings(embedding1: number[], embedding2: number[]): number {
  console.log('[FaceCapture] Comparing embeddings...');
  return adapter.compareEmbeddings(embedding1, embedding2);
}

export function getDeviceInfo() {
  return {
    deviceId: `${Platform.OS}-${Math.random().toString(36).substring(7)}`,
    appVersion: '1.0.0',
    platform: Platform.OS,
  };
}

export async function checkOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}
