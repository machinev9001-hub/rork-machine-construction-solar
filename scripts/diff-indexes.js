#!/usr/bin/env node

const fs = require('fs');

const LOCAL_FILE = 'firestore.indexes.json';
const REMOTE_EXPORT_FILE = 'firestore-remote-indexes.json';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function normalizeIndex(index) {
  const normalized = { ...index };
  
  if (normalized.fields) {
    normalized.fields = [...normalized.fields].sort((a, b) => {
      if (a.fieldPath !== b.fieldPath) {
        return a.fieldPath.localeCompare(b.fieldPath);
      }
      return (a.order || a.arrayConfig || '').localeCompare(b.order || b.arrayConfig || '');
    });
  }
  
  return normalized;
}

function indexSignature(index) {
  const fields = index.fields || [];
  const fieldStr = fields
    .map(f => `${f.fieldPath}:${f.order || f.arrayConfig || 'none'}`)
    .join(',');
  return `${index.collectionGroup}|${index.queryScope}|${fieldStr}`;
}

function indexToString(index, indent = '  ') {
  const fields = (index.fields || [])
    .map(f => `${indent}  - ${f.fieldPath}: ${f.order || f.arrayConfig}`)
    .join('\n');
  
  return `${indent}Collection: ${index.collectionGroup}\n${indent}Scope: ${index.queryScope}\n${indent}Fields:\n${fields}`;
}

function compareIndexes() {
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}   Firebase Index Comparison Tool${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}\n`);

  if (!fs.existsSync(LOCAL_FILE)) {
    console.error(`${RED}❌ Error: ${LOCAL_FILE} not found!${RESET}`);
    process.exit(1);
  }

  if (!fs.existsSync(REMOTE_EXPORT_FILE)) {
    console.log(`${YELLOW}⚠️  Remote export not found. Run this command first:${RESET}`);
    console.log(`${BLUE}gcloud firestore indexes list --format=json > ${REMOTE_EXPORT_FILE}${RESET}\n`);
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
  const remoteData = JSON.parse(fs.readFileSync(REMOTE_EXPORT_FILE, 'utf8'));

  const localIndexes = localData.indexes || [];
  const remoteIndexes = Array.isArray(remoteData) ? remoteData : (remoteData.indexes || []);

  const localSigs = new Map();
  const remoteSigs = new Map();

  localIndexes.forEach(idx => {
    const normalized = normalizeIndex(idx);
    const sig = indexSignature(normalized);
    localSigs.set(sig, normalized);
  });

  remoteIndexes.forEach(idx => {
    const normalized = normalizeIndex(idx);
    const sig = indexSignature(normalized);
    remoteSigs.set(sig, normalized);
  });

  const onlyLocal = [];
  const onlyRemote = [];
  const inBoth = [];

  localSigs.forEach((index, sig) => {
    if (remoteSigs.has(sig)) {
      inBoth.push(index);
    } else {
      onlyLocal.push(index);
    }
  });

  remoteSigs.forEach((index, sig) => {
    if (!localSigs.has(sig)) {
      onlyRemote.push(index);
    }
  });

  console.log(`${GREEN}✅ Indexes present in BOTH (${inBoth.length}):${RESET}`);
  console.log(`   These are already synced.\n`);

  console.log(`${YELLOW}📤 Indexes defined LOCALLY but NOT on remote (${onlyLocal.length}):${RESET}`);
  console.log(`   These will be created when you run: firebase deploy --only firestore:indexes\n`);
  
  if (onlyLocal.length > 0) {
    onlyLocal.forEach((index, i) => {
      console.log(`${YELLOW}${i + 1}.${RESET}`);
      console.log(indexToString(index, '   '));
      console.log('');
    });
  }

  console.log(`${RED}📥 Indexes on REMOTE but NOT in local file (${onlyRemote.length}):${RESET}`);
  console.log(`   CLI will prompt to delete these, or you can add them to your local file.\n`);
  
  if (onlyRemote.length > 0) {
    onlyRemote.forEach((index, i) => {
      console.log(`${RED}${i + 1}.${RESET}`);
      console.log(indexToString(index, '   '));
      console.log('');
    });

    const suspiciousIndexes = onlyRemote.filter(idx => {
      const hasCapital = /[A-Z]/.test(idx.collectionGroup);
      const hasTyro = idx.collectionGroup === 'BOQ' || idx.collectionGroup === 'Companies' || 
                     idx.collectionGroup === 'Subcontractors' || idx.collectionGroup === 'PlantAssets' ||
                     idx.collectionGroup === 'PlantAssetHours' || idx.collectionGroup === 'imesheets';
      return hasCapital || hasTyro;
    });

    if (suspiciousIndexes.length > 0) {
      console.log(`${YELLOW}⚠️  SUSPICIOUS: ${suspiciousIndexes.length} remote indexes have casing issues or typos:${RESET}\n`);
      suspiciousIndexes.forEach((index, i) => {
        console.log(`${YELLOW}   ${index.collectionGroup}${RESET} - Likely should be lowercase or corrected`);
      });
      console.log('');
    }
  }

  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}Summary:${RESET}`);
  console.log(`  Local indexes:  ${localIndexes.length}`);
  console.log(`  Remote indexes: ${remoteIndexes.length}`);
  console.log(`  In sync:        ${inBoth.length}`);
  console.log(`  To create:      ${onlyLocal.length}`);
  console.log(`  To delete:      ${onlyRemote.length}`);
  console.log(`${BLUE}═══════════════════════════════════════════════${RESET}\n`);

  console.log(`${GREEN}Next Steps:${RESET}`);
  console.log(`1. Review the differences above`);
  console.log(`2. Use ${BLUE}node scripts/convert-remote-to-local.js${RESET} to convert remote format`);
  console.log(`3. Manually merge or fix indexes in ${LOCAL_FILE}`);
  console.log(`4. Run ${BLUE}firebase deploy --only firestore:indexes${RESET} to sync\n`);
}

compareIndexes();
