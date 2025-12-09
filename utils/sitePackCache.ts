import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  SitePack, 
  SitePackMetadata, 
  SitePackUser, 
  SitePackPlant, 
  SitePackActivityTemplate,
  SitePackActivityInstance,
  SitePackGeometry 
} from '@/types/sitePack';

const SITE_PACK_KEY = '@site_pack';
const SITE_PACK_METADATA_KEY = '@site_pack_metadata';

const PLANT_CACHE_KEY = '@cached_plant';
const GEOMETRY_CACHE_KEY = '@cached_geometry';
const TASK_TEMPLATE_CACHE_KEY = '@cached_task_templates';
const ACTIVITY_INSTANCES_CACHE_KEY = '@cached_activity_instances';

export async function storeSitePack(pack: SitePack): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SitePackCache] Storing site pack for site:', pack.siteId, 'version:', pack.version);

    await AsyncStorage.multiSet([
      [SITE_PACK_KEY, JSON.stringify(pack)],
      [SITE_PACK_METADATA_KEY, JSON.stringify({
        siteId: pack.siteId,
        packVersion: pack.version,
        packGeneratedAt: pack.generatedAt,
        lastLoadedAt: new Date().toISOString(),
      } as SitePackMetadata)],
    ]);

    await Promise.all([
      storePlantCache(pack.plant),
      storeGeometryCache(pack.geometry),
      storeTaskTemplateCache(pack.activityTemplates),
      storeActivityInstancesCache(pack.activityInstances || []),
    ]);

    console.log('[SitePackCache] Site pack stored successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[SitePackCache] Error storing site pack:', error);
    return { success: false, error: error.message };
  }
}

export async function getSitePack(): Promise<SitePack | null> {
  try {
    const stored = await AsyncStorage.getItem(SITE_PACK_KEY);
    if (!stored) {
      console.log('[SitePackCache] No site pack found');
      return null;
    }

    const pack: SitePack = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved site pack for site:', pack.siteId, 'version:', pack.version);
    return pack;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving site pack:', error);
    return null;
  }
}

export async function getSitePackMetadata(): Promise<SitePackMetadata | null> {
  try {
    const stored = await AsyncStorage.getItem(SITE_PACK_METADATA_KEY);
    if (!stored) {
      console.log('[SitePackCache] No site pack metadata found');
      return null;
    }

    const metadata: SitePackMetadata = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved metadata:', metadata);
    return metadata;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving metadata:', error);
    return null;
  }
}

async function storePlantCache(plant: SitePackPlant[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PLANT_CACHE_KEY, JSON.stringify(plant));
    console.log('[SitePackCache] Cached', plant.length, 'plant items');
  } catch (error) {
    console.error('[SitePackCache] Error caching plant:', error);
  }
}

export async function getCachedPlant(): Promise<SitePackPlant[]> {
  try {
    const stored = await AsyncStorage.getItem(PLANT_CACHE_KEY);
    if (!stored) {
      console.log('[SitePackCache] No cached plant found');
      return [];
    }

    const plant: SitePackPlant[] = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved', plant.length, 'cached plant items');
    return plant;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving cached plant:', error);
    return [];
  }
}

export async function getCachedPlantByNr(plantNr: string): Promise<SitePackPlant | null> {
  try {
    const plant = await getCachedPlant();
    const item = plant.find(p => p.plantNr === plantNr);
    
    if (item) {
      console.log('[SitePackCache] Found cached plant:', plantNr);
      return item;
    }
    
    console.log('[SitePackCache] Plant not found in cache:', plantNr);
    return null;
  } catch (error) {
    console.error('[SitePackCache] Error finding cached plant:', error);
    return null;
  }
}

async function storeGeometryCache(geometry: SitePackGeometry): Promise<void> {
  try {
    await AsyncStorage.setItem(GEOMETRY_CACHE_KEY, JSON.stringify(geometry));
    console.log('[SitePackCache] Cached geometry:', {
      pvAreas: geometry.pvAreas.length,
      blockNumbers: geometry.blockNumbers.length,
      specialAreas: geometry.specialAreas.length,
    });
  } catch (error) {
    console.error('[SitePackCache] Error caching geometry:', error);
  }
}

export async function getCachedGeometry(): Promise<SitePackGeometry | null> {
  try {
    const stored = await AsyncStorage.getItem(GEOMETRY_CACHE_KEY);
    if (!stored) {
      console.log('[SitePackCache] No cached geometry found');
      return null;
    }

    const geometry: SitePackGeometry = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved cached geometry');
    return geometry;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving cached geometry:', error);
    return null;
  }
}

async function storeTaskTemplateCache(templates: SitePackActivityTemplate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TASK_TEMPLATE_CACHE_KEY, JSON.stringify(templates));
    console.log('[SitePackCache] Cached', templates.length, 'task templates');
  } catch (error) {
    console.error('[SitePackCache] Error caching task templates:', error);
  }
}

export async function getCachedTaskTemplates(): Promise<SitePackActivityTemplate[]> {
  try {
    const stored = await AsyncStorage.getItem(TASK_TEMPLATE_CACHE_KEY);
    if (!stored) {
      console.log('[SitePackCache] No cached task templates found');
      return [];
    }

    const templates: SitePackActivityTemplate[] = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved', templates.length, 'cached task templates');
    return templates;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving cached task templates:', error);
    return [];
  }
}

export async function getCachedTemplateForSubMenu(subMenu: string): Promise<SitePackActivityTemplate | null> {
  try {
    const templates = await getCachedTaskTemplates();
    const template = templates.find(t => t.subMenu === subMenu);
    
    if (template) {
      console.log('[SitePackCache] Found cached template for:', subMenu);
      return template;
    }
    
    console.log('[SitePackCache] Template not found in cache:', subMenu);
    return null;
  } catch (error) {
    console.error('[SitePackCache] Error finding cached template:', error);
    return null;
  }
}

async function storeActivityInstancesCache(instances: SitePackActivityInstance[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVITY_INSTANCES_CACHE_KEY, JSON.stringify(instances));
    console.log('[SitePackCache] Cached', instances.length, 'activity instances');
  } catch (error) {
    console.error('[SitePackCache] Error caching activity instances:', error);
  }
}

export async function getCachedActivityInstances(): Promise<SitePackActivityInstance[]> {
  try {
    const stored = await AsyncStorage.getItem(ACTIVITY_INSTANCES_CACHE_KEY);
    if (!stored) {
      console.log('[SitePackCache] No cached activity instances found');
      return [];
    }

    const instances: SitePackActivityInstance[] = JSON.parse(stored);
    console.log('[SitePackCache] Retrieved', instances.length, 'cached activity instances');
    return instances;
  } catch (error) {
    console.error('[SitePackCache] Error retrieving cached activity instances:', error);
    return [];
  }
}

export async function getCachedActivityInstancesByTask(taskId: string): Promise<SitePackActivityInstance[]> {
  try {
    const instances = await getCachedActivityInstances();
    const filtered = instances.filter(i => i.taskId === taskId);
    console.log('[SitePackCache] Found', filtered.length, 'cached activity instances for task:', taskId);
    return filtered;
  } catch (error) {
    console.error('[SitePackCache] Error finding cached activity instances:', error);
    return [];
  }
}

export async function getCachedActivityInstanceById(activityId: string): Promise<SitePackActivityInstance | null> {
  try {
    const instances = await getCachedActivityInstances();
    const instance = instances.find(i => i.id === activityId);
    
    if (instance) {
      console.log('[SitePackCache] Found cached activity instance:', activityId);
      return instance;
    }
    
    console.log('[SitePackCache] Activity instance not found in cache:', activityId);
    return null;
  } catch (error) {
    console.error('[SitePackCache] Error finding cached activity instance:', error);
    return null;
  }
}

export async function clearSitePackCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      SITE_PACK_KEY,
      SITE_PACK_METADATA_KEY,
      PLANT_CACHE_KEY,
      GEOMETRY_CACHE_KEY,
      TASK_TEMPLATE_CACHE_KEY,
      ACTIVITY_INSTANCES_CACHE_KEY,
    ]);
    console.log('[SitePackCache] All site pack caches cleared');
  } catch (error) {
    console.error('[SitePackCache] Error clearing site pack cache:', error);
  }
}

export async function shouldRefreshSitePack(): Promise<boolean> {
  const metadata = await getSitePackMetadata();
  if (!metadata) return true;

  const age = Date.now() - new Date(metadata.lastLoadedAt).getTime();
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  
  return age > maxAge;
}
