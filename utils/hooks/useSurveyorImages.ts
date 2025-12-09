import { useQuery } from '@tanstack/react-query';
import {
  querySurveyorImages,
  getImagesForBlock,
  getImagesForArea,
  getAllSiteImages,
  getBasemapImages,
  ImageLibraryFilters,
  ImageLibraryResult,
} from '@/utils/surveyorImageLibrary';

/**
 * Hook to query surveyor images with custom filters.
 * Caches results using React Query for performance.
 */
export function useSurveyorImages(filters: ImageLibraryFilters) {
  return useQuery<ImageLibraryResult>({
    queryKey: ['surveyorImages', filters],
    queryFn: () => querySurveyorImages(filters),
    enabled: !!filters.siteId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to get images for a specific block.
 * Used by Plant Management and Civils modules.
 */
export function useBlockImages(
  siteId: string | undefined,
  pvArea: string | undefined,
  blockNumber: string | undefined,
  rowNr?: string,
  columnNr?: string
) {
  return useQuery<ImageLibraryResult>({
    queryKey: ['surveyorImages', 'block', siteId, pvArea, blockNumber, rowNr, columnNr],
    queryFn: () => {
      if (!siteId || !pvArea || !blockNumber) {
        throw new Error('siteId, pvArea, and blockNumber are required');
      }
      return getImagesForBlock(siteId, pvArea, blockNumber, rowNr, columnNr);
    },
    enabled: !!siteId && !!pvArea && !!blockNumber,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get images for a specific PV Area.
 * Useful for area-level views.
 */
export function useAreaImages(
  siteId: string | undefined,
  pvArea: string | undefined
) {
  return useQuery<ImageLibraryResult>({
    queryKey: ['surveyorImages', 'area', siteId, pvArea],
    queryFn: () => {
      if (!siteId || !pvArea) {
        throw new Error('siteId and pvArea are required');
      }
      return getImagesForArea(siteId, pvArea);
    },
    enabled: !!siteId && !!pvArea,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get all site images.
 * Useful for browsing the complete library.
 */
export function useSiteImages(siteId: string | undefined) {
  return useQuery<ImageLibraryResult>({
    queryKey: ['surveyorImages', 'site', siteId],
    queryFn: () => {
      if (!siteId) {
        throw new Error('siteId is required');
      }
      return getAllSiteImages(siteId);
    },
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get basemap overlay images for a block.
 * Used by Plant Management for background maps.
 */
export function useBasemapImages(
  siteId: string | undefined,
  pvArea?: string,
  blockNumber?: string
) {
  return useQuery<ImageLibraryResult>({
    queryKey: ['surveyorImages', 'basemap', siteId, pvArea, blockNumber],
    queryFn: () => {
      if (!siteId) {
        throw new Error('siteId is required');
      }
      return getBasemapImages(siteId, pvArea, blockNumber);
    },
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
