/**
 * One-off migration: converts MINIATURE items from the old single-type format
 *   { figureTypeId, figureTypeName, quantity }
 * to the new multi-type format
 *   { figures: [{ figureTypeId, figureTypeName, quantity }] }
 *
 * Safe to run multiple times — already-migrated records are skipped.
 *
 * Run with:
 *   TABLE_NAME=<your-table> node src/migrate-figures.mjs
 */

import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, now } from './handlers/_shared.mjs';

const timestamp = now();
let migrated = 0, skipped = 0, errors = 0;

// Scan all MINIATURE items
const items = [];
let lastKey;
do {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(SK, :skPrefix) AND category = :cat',
    ExpressionAttributeValues: { ':skPrefix': 'ITEM#', ':cat': 'MINIATURE' },
  }));
  items.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
} while (lastKey);

console.log(`Found ${items.length} MINIATURE items\n`);

for (const item of items) {
  if (item.figures?.length) {
    skipped++;
    continue;
  }
  if (!item.figureTypeId) {
    console.log(`  SKIP  ${item.id} "${item.name}" — no figureTypeId`);
    skipped++;
    continue;
  }

  const figures = [{
    figureTypeId:   item.figureTypeId,
    figureTypeName: item.figureTypeName || '',
    quantity:       item.quantity || 1,
  }];

  try {
    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression: 'SET figures = :figures, updatedAt = :updatedAt REMOVE figureTypeId, figureTypeName',
      ExpressionAttributeValues: { ':figures': figures, ':updatedAt': timestamp },
      ConditionExpression: 'attribute_exists(PK)',
    }));
    console.log(`  OK    ${item.id} "${item.name}" — [${item.figureTypeName} × ${item.quantity || 1}]`);
    migrated++;
  } catch (err) {
    console.error(`  ERROR ${item.id} "${item.name}" — ${err.message}`);
    errors++;
  }
}

console.log(`\nDone. Migrated: ${migrated}  Skipped: ${skipped}  Errors: ${errors}`);
