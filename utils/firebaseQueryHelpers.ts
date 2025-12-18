import {
  Query,
  query,
  limit,
  QueryConstraint,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { logger } from './logger';

/**
 * Default query limits to prevent excessive Firebase reads
 */
export const DEFAULT_QUERY_LIMITS = {
  LIST: 50,        // Default for list views
  SEARCH: 25,      // Default for search results
  RECENT: 10,      // Default for recent items
  MAX: 100,        // Maximum allowed
} as const;

/**
 * Safe wrapper for getDocs that enforces query limits
 * @param baseQuery - The base Firestore query
 * @param options - Query options
 */
export async function safeGetDocs<T = DocumentData>(
  baseQuery: Query<T>,
  options: {
    maxLimit?: number;
    logQuery?: boolean;
    context?: string;
  } = {}
): Promise<QuerySnapshot<T>> {
  const maxLimit = options.maxLimit ?? DEFAULT_QUERY_LIMITS.LIST;
  
  // Add limit to query if not already present
  const limitedQuery = query(baseQuery, limit(maxLimit));

  if (options.logQuery) {
    logger.debug(
      `Firebase Query [${options.context ?? 'unknown'}]:`,
      `Limit: ${maxLimit}`
    );
  }

  try {
    const snapshot = await getDocs(limitedQuery);
    
    if (options.logQuery) {
      logger.debug(
        `Firebase Query Result [${options.context ?? 'unknown'}]:`,
        `${snapshot.size} documents fetched`
      );
    }

    return snapshot;
  } catch (error) {
    logger.error(
      `Firebase Query Error [${options.context ?? 'unknown'}]:`,
      error
    );
    throw error;
  }
}

/**
 * Create a limited query with default constraints
 */
export function createLimitedQuery<T = DocumentData>(
  baseQuery: Query<T>,
  constraints: QueryConstraint[] = [],
  maxLimit: number = DEFAULT_QUERY_LIMITS.LIST
): Query<T> {
  return query(baseQuery, ...constraints, limit(maxLimit));
}

/**
 * Pagination helper for large datasets
 */
export interface PaginationOptions {
  pageSize?: number;
  context?: string;
}

export interface PaginatedResult<T> {
  docs: T[];
  hasMore: boolean;
  lastDoc: any;
}

/**
 * Fetch paginated results with cursor-based pagination
 */
export async function getPaginatedDocs<T = DocumentData>(
  baseQuery: Query<T>,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const pageSize = options.pageSize ?? DEFAULT_QUERY_LIMITS.LIST;
  
  // Request one extra document to check if there are more pages
  const limitedQuery = query(baseQuery, limit(pageSize + 1));
  
  try {
    const snapshot = await getDocs(limitedQuery);
    // Safely combine doc.id with doc.data()
    // Type T should include id: string for proper typing
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
    
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

    logger.debug(
      `Paginated Query [${options.context ?? 'unknown'}]:`,
      `${resultDocs.length} docs, hasMore: ${hasMore}`
    );

    return {
      docs: resultDocs,
      hasMore,
      lastDoc,
    };
  } catch (error) {
    logger.error(
      `Pagination Error [${options.context ?? 'unknown'}]:`,
      error
    );
    throw error;
  }
}

/**
 * Batch read helper to reduce number of reads
 */
export async function batchGetDocs<T = DocumentData>(
  queries: Query<T>[],
  options: {
    maxLimit?: number;
    context?: string;
  } = {}
): Promise<QuerySnapshot<T>[]> {
  const maxLimit = options.maxLimit ?? DEFAULT_QUERY_LIMITS.LIST;

  logger.debug(
    `Batch Query [${options.context ?? 'unknown'}]:`,
    `Processing ${queries.length} queries`
  );

  try {
    const results = await Promise.all(
      queries.map(q => safeGetDocs(q, { maxLimit, context: options.context }))
    );

    const totalDocs = results.reduce((sum, snapshot) => sum + snapshot.size, 0);
    logger.debug(
      `Batch Query Result [${options.context ?? 'unknown'}]:`,
      `${totalDocs} total documents fetched`
    );

    return results;
  } catch (error) {
    logger.error(
      `Batch Query Error [${options.context ?? 'unknown'}]:`,
      error
    );
    throw error;
  }
}
