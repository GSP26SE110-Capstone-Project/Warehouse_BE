export async function generatePrefixedId(pool, {
  tableName,
  idColumn,
  prefix,
  padLength = 4,
}) {
  const startPos = prefix.length + 1;
  const query = `
    SELECT MAX(CAST(SUBSTRING(${idColumn} FROM ${startPos}) AS INTEGER)) AS max_number
    FROM ${tableName}
    WHERE ${idColumn} ~ $1
  `;
  const pattern = `^${prefix}[0-9]+$`;
  const { rows } = await pool.query(query, [pattern]);
  const maxNumber = Number(rows[0]?.max_number ?? 0);
  const nextNumber = Number.isNaN(maxNumber) ? 1 : maxNumber + 1;
  return `${prefix}${String(nextNumber).padStart(padLength, '0')}`;
}

