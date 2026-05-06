const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: ".env.backup" });

const PAGE_SIZE = 1000;

const requiredEnvNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER"
];

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} 환경변수가 .env.backup에 없습니다.`);
  }

  return value;
}

function toMysqlDateTime(value) {
  if (!value) {
    return null;
  }

  return String(value).replace("T", " ").replace(/\.\d+Z$/, "").replace("Z", "").slice(0, 19);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchAllTransactions(supabase) {
  const allTransactions = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase 조회 실패: ${error.message}`);
    }

    const page = data || [];
    allTransactions.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  const uniqueTransactions = new Map();
  const duplicateIds = [];

  allTransactions.forEach((transaction) => {
    if (uniqueTransactions.has(transaction.id)) {
      duplicateIds.push(transaction.id);
      return;
    }

    uniqueTransactions.set(transaction.id, transaction);
  });

  return {
    rawCount: allTransactions.length,
    uniqueTransactions: Array.from(uniqueTransactions.values()),
    duplicateIds
  };
}

async function upsertTransactions(connection, transactions) {
  const sql = `
    insert into backup_transactions (
      id,
      type,
      amount,
      category,
      transaction_date,
      memo,
      item_name,
      box_count,
      auction_price,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on duplicate key update
      type = values(type),
      amount = values(amount),
      category = values(category),
      transaction_date = values(transaction_date),
      memo = values(memo),
      item_name = values(item_name),
      box_count = values(box_count),
      auction_price = values(auction_price),
      created_at = values(created_at),
      updated_at = values(updated_at),
      backed_up_at = current_timestamp
  `;

  let processedCount = 0;

  for (const transaction of transactions) {
    await connection.execute(sql, [
      transaction.id,
      transaction.type,
      toNullableNumber(transaction.amount) || 0,
      transaction.category,
      transaction.transaction_date,
      transaction.memo || null,
      transaction.item_name || null,
      toNullableNumber(transaction.box_count),
      toNullableNumber(transaction.auction_price),
      toMysqlDateTime(transaction.created_at),
      toMysqlDateTime(transaction.updated_at)
    ]);

    processedCount += 1;
  }

  return processedCount;
}

async function main() {
  const backupStartedAt = new Date();

  requiredEnvNames.forEach(requireEnv);

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );

  const connection = await mysql.createConnection({
    host: requireEnv("MYSQL_HOST"),
    port: Number(requireEnv("MYSQL_PORT")),
    database: requireEnv("MYSQL_DATABASE"),
    user: requireEnv("MYSQL_USER"),
    password: process.env.MYSQL_PASSWORD || ""
  });

  try {
    const { rawCount, uniqueTransactions, duplicateIds } = await fetchAllTransactions(supabase);
    const processedCount = await upsertTransactions(connection, uniqueTransactions);
    const backupFinishedAt = new Date();

    console.log("백업 시작 시간:", backupStartedAt.toISOString());
    console.log("백업 완료 시간:", backupFinishedAt.toISOString());
    console.log("Supabase에서 가져온 원본 건수:", rawCount);
    console.log("id 기준 중복 제거 후 건수:", uniqueTransactions.length);
    console.log("중복 id:", duplicateIds.length > 0 ? duplicateIds.map((id) => id.slice(0, 8)).join(", ") : "없음");
    console.log("MySQL upsert 처리 건수:", processedCount);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("백업 실패:", error);
  process.exit(1);
});
