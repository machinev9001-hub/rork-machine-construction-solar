#!/usr/bin/env node

const fs = require('fs');

const REMOTE_EXPORT_FILE = 'firestore-remote-indexes.json';
const OUTPUT_FILE = 'firestore-remote-converted.json';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function convertRemoteToLocal() {
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}   Remote Index Converter${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}\n`);

  if (!fs.existsSync(REMOTE_EXPORT_FILE)) {
    console.log(`${RED}❌ Error: ${REMOTE_EXPORT_FILE} not found!${RESET}\n`);
    console.log(`${YELLOW}Run this command first:${RESET}`);
    console.log(`${BLUE}gcloud firestore indexes list --format=json > ${REMOTE_EXPORT_FILE}${RESET}\n`);
    process.exit(1);
  }

  const remoteData = JSON.parse(fs.readFileSync(REMOTE_EXPORT_FILE, 'utf8'));
  
  const remoteIndexes = Array.isArray(remoteData) ? remoteData : (remoteData.indexes || []);

  const convertedIndexes = remoteIndexes
    .filter(index => {
      const state = index.state || 'READY';
      return state === 'READY';
    })
    .map(index => {
      const fields = (index.fields || []).map(field => {
        const converted = {
          fieldPath: field.fieldPath
        };

        if (field.order) {
          converted.order = field.order;
        } else if (field.arrayConfig) {
          converted.arrayConfig = field.arrayConfig;
        }

        return converted;
      });

      return {
        collectionGroup: index.collectionGroup,
        queryScope: index.queryScope || 'COLLECTION',
        fields: fields
      };
    });

  const localFormat = {
    indexes: convertedIndexes,
    fieldOverrides: []
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(localFormat, null, 2));

  console.log(`${GREEN}✅ Converted ${convertedIndexes.length} remote indexes to local format${RESET}\n`);
  console.log(`${BLUE}Output file: ${OUTPUT_FILE}${RESET}\n`);

  const suspiciousIndexes = convertedIndexes.filter(idx => {
    const hasCapital = /[A-Z]/.test(idx.collectionGroup);
    const hasTyro = idx.collectionGroup === 'BOQ' || idx.collectionGroup === 'Companies' || 
                   idx.collectionGroup === 'Subcontractors' || idx.collectionGroup === 'PlantAssets' ||
                   idx.collectionGroup === 'PlantAssetHours' || idx.collectionGroup === 'imesheets';
    return hasCapital || hasTyro;
  });

  if (suspiciousIndexes.length > 0) {
    console.log(`${YELLOW}⚠️  WARNING: Found ${suspiciousIndexes.length} indexes with casing issues:${RESET}\n`);
    suspiciousIndexes.forEach((index, i) => {
      console.log(`${YELLOW}${i + 1}. ${index.collectionGroup}${RESET}`);
      index.fields.forEach(f => {
        console.log(`   - ${f.fieldPath}: ${f.order || f.arrayConfig || 'none'}`);
      });
      console.log('');
    });
    console.log(`${YELLOW}These should likely be lowercase (e.g., 'boq' not 'BOQ')${RESET}\n`);
  }

  console.log(`${GREEN}Next Steps:${RESET}`);
  console.log(`1. Review ${OUTPUT_FILE} for suspicious indexes`);
  console.log(`2. Manually merge legitimate indexes into firestore.indexes.json`);
  console.log(`3. Fix any casing issues (BOQ → boq, Companies → companies, etc.)`);
  console.log(`4. Run ${BLUE}firebase deploy --only firestore:indexes${RESET} to sync\n`);
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}\n`);
}

convertRemoteToLocal();
