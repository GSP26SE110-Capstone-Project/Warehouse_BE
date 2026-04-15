export async function generatePrefixedId(pool, {
  tableName,
  idColumn,
  prefix,
  padLength = 4,
}) {
  const prefixLength = prefix.length + 1;
  const query = `
    SELECT ${idColumn} AS current_id
    FROM ${tableName}
    WHERE ${idColumn} ~ $1
    ORDER BY CAST(SUBSTRING(${idColumn} FROM $2) AS INTEGER) DESC
    LIMIT 1;
  `;
  const pattern = `^${prefix}[0-9]+$`;
  const { rows } = await pool.query(query, [pattern, prefixLength]);
  const lastId = rows[0]?.current_id;
  const lastNumber = lastId ? Number(lastId.slice(prefix.length)) : 0;
  const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `${prefix}${String(nextNumber).padStart(padLength, '0')}`;
}

