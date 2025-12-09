const NATIVE_MODULES_AVAILABLE = false;

export interface FaceDetectorResult {
  boundingBox?: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
  trackingId?: number;
}

export interface FaceDetector {
  detectFacesFromFile(uri: string): Promise<FaceDetectorResult[]>;
}

export function getFaceDetector(): FaceDetector {
  if (!NATIVE_MODULES_AVAILABLE) {
    return {
      async detectFacesFromFile(): Promise<FaceDetectorResult[]> {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [
          {
            boundingBox: {
              centerX: 200,
              centerY: 200,
              width: 150,
              height: 200,
            },
            leftEyeOpenProbability: Math.random(),
            rightEyeOpenProbability: Math.random(),
            smilingProbability: Math.random(),
          },
        ];
      },
    };
  }

  try {
    const FaceDetection = require('@react-native-ml-kit/face-detection');
    
    return {
      async detectFacesFromFile(uri: string): Promise<FaceDetectorResult[]> {
        const faces = await FaceDetection.detectFaces({
          uri,
          performanceMode: 'accurate',
          classificationMode: 'all',
          landmarkMode: 'all',
        });
        return faces;
      },
    };
  } catch (err) {
    console.error('[mlkit-wrapper] Failed to load @react-native-ml-kit/face-detection', err);
    throw err;
  }
}
