import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SurveyorImage } from '@/types';

export type ImageLibraryFilters = {
  siteId: string;
  pvArea?: string;
  blockNumber?: string;
  rowNr?: string;
  columnNr?: string;
  isActive?: boolean;
  imageType?: 'BASEMAP_OVERLAY' | 'DETAIL' | 'OTHER';
};

export type ImageLibraryResult = {
  images: SurveyorImage[];
  bestMatch: SurveyorImage | null;
};

/**
 * Query surveyor images from the library with optional filters.
 * Returns all matching images sorted by creation date (newest first).
 * 
 * The function tries to find the best match with a priority fallback:
 * 1. siteId + pvArea + blockNumber + rowNr + columnNr (if all provided)
 * 2. siteId + pvArea + blockNumber (if blockNumber provided)
 * 3. siteId + pvArea (if pvArea provided)
 * 4. siteId only (generic site images)
 * 
 * @param filters - Query filters for surveyor images
 * @returns Promise<ImageLibraryResult> - Array of matching images and the best match
 */
export async function querySurveyorImages(
  filters: ImageLibraryFilters
): Promise<ImageLibraryResult> {
  const { siteId, pvArea, blockNumber, isActive = true, imageType } = filters;

  console.log('[SurveyorImageLibrary] Querying with filters:', filters);

  try {
    const imagesRef = collection(db, 'surveyorImages');
    
    // Build query with required filters
    const queryConstraints: any[] = [
      where('siteId', '==', siteId),
      where('isActive', '==', isActive)
    ];

    // Try most specific query first (with all optional fields)
    let q = query(imagesRef, ...queryConstraints);

    // Add optional filters in priority order
    if (pvArea) {
      q = query(q, where('pvArea', '==', pvArea));
    }
    if (blockNumber) {
      q = query(q, where('blockNumber', '==', blockNumber));
    }
    if (filters.rowNr) {
      q = query(q, where('rowNr', '==', filters.rowNr));
    }
    if (filters.columnNr) {
      q = query(q, where('columnNr', '==', filters.columnNr));
    }
    if (imageType) {
      q = query(q, where('imageType', '==', imageType));
    }

    // Add ordering and limit
    q = query(q, orderBy('createdAt', 'desc'), limit(50));

    const snapshot = await getDocs(q);
    
    const images: SurveyorImage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      images.push({
        id: doc.id,
        imageId: data.imageId || doc.id,
        siteId: data.siteId,
        pvArea: data.pvArea,
        blockNumber: data.blockNumber,
        rowNr: data.rowNr,
        columnNr: data.columnNr,
        sourceTaskId: data.sourceTaskId,
        imageUrl: data.imageUrl,
        storagePath: data.storagePath,
        imageType: data.imageType || 'OTHER',
        description: data.description,
        createdByUserId: data.createdByUserId,
        createdAt: data.createdAt,
        isActive: data.isActive !== false,
        version: data.version,
        replacesImageId: data.replacesImageId,
      });
    });

    console.log(`[SurveyorImageLibrary] Found ${images.length} images`);

    // Find best match based on specificity
    const bestMatch = findBestMatch(images, { pvArea, blockNumber, rowNr: filters.rowNr, columnNr: filters.columnNr });

    return { images, bestMatch };
  } catch (error) {
    console.error('[SurveyorImageLibrary] Error querying images:', error);
    throw error;
  }
}

/**
 * Find the best matching image based on field specificity.
 * Priority:
 * 1. Exact match (all fields match)
 * 2. PV Area + Block Number match
 * 3. PV Area match only
 * 4. Generic site image (no PV Area or Block Number)
 */
function findBestMatch(
  images: SurveyorImage[],
  targetFilters: { pvArea?: string; blockNumber?: string; rowNr?: string; columnNr?: string }
): SurveyorImage | null {
  if (images.length === 0) return null;

  const { pvArea, blockNumber, rowNr, columnNr } = targetFilters;

  // Priority 1: Exact match (all fields match)
  if (pvArea && blockNumber && rowNr && columnNr) {
    const exactMatch = images.find(
      (img) =>
        img.pvArea === pvArea &&
        img.blockNumber === blockNumber &&
        img.rowNr === rowNr &&
        img.columnNr === columnNr
    );
    if (exactMatch) {
      console.log('[SurveyorImageLibrary] Best match: Exact (PV Area + Block + Row + Column)');
      return exactMatch;
    }
  }

  // Priority 2: PV Area + Block Number + no special area
  if (pvArea && blockNumber) {
    const blockMatch = images.find(
      (img) =>
        img.pvArea === pvArea &&
        img.blockNumber === blockNumber &&
        !img.rowNr && !img.columnNr
    );
    if (blockMatch) {
      console.log('[SurveyorImageLibrary] Best match: PV Area + Block Number');
      return blockMatch;
    }
  }

  // Priority 3: PV Area only (no block number)
  if (pvArea) {
    const pvAreaMatch = images.find(
      (img) => img.pvArea === pvArea && !img.blockNumber && !img.rowNr && !img.columnNr
    );
    if (pvAreaMatch) {
      console.log('[SurveyorImageLibrary] Best match: PV Area only');
      return pvAreaMatch;
    }
  }

  // Priority 4: Generic site image (no PV Area or Block Number)
  const genericMatch = images.find(
    (img) => !img.pvArea && !img.blockNumber && !img.rowNr && !img.columnNr
  );
  if (genericMatch) {
    console.log('[SurveyorImageLibrary] Best match: Generic site image');
    return genericMatch;
  }

  // Fallback: Return first image (newest)
  console.log('[SurveyorImageLibrary] Best match: First available (newest)');
  return images[0];
}

/**
 * Get surveyor images for a specific PV Area and Block Number.
 * This is a convenience function for plant management and civils modules.
 */
export async function getImagesForBlock(
  siteId: string,
  pvArea: string,
  blockNumber: string,
  rowNr?: string,
  columnNr?: string
): Promise<ImageLibraryResult> {
  return querySurveyorImages({
    siteId,
    pvArea,
    blockNumber,
    rowNr,
    columnNr,
    isActive: true,
  });
}

/**
 * Get surveyor images for a specific PV Area (without block number).
 * Useful for getting area-level overview images.
 */
export async function getImagesForArea(
  siteId: string,
  pvArea: string
): Promise<ImageLibraryResult> {
  return querySurveyorImages({
    siteId,
    pvArea,
    isActive: true,
  });
}

/**
 * Get all active surveyor images for a site.
 * Useful for browsing the complete image library.
 */
export async function getAllSiteImages(siteId: string): Promise<ImageLibraryResult> {
  return querySurveyorImages({
    siteId,
    isActive: true,
  });
}

/**
 * Get basemap overlay images only.
 * These are the images suitable for use as background maps in plant management.
 */
export async function getBasemapImages(
  siteId: string,
  pvArea?: string,
  blockNumber?: string
): Promise<ImageLibraryResult> {
  return querySurveyorImages({
    siteId,
    pvArea,
    blockNumber,
    isActive: true,
    imageType: 'BASEMAP_OVERLAY',
  });
}
