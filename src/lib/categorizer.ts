import { prisma } from "@/lib/prisma";
import type { CategorizationResult } from "@/types";

export async function categorizeTransaction(normalizedName: string): Promise<CategorizationResult> {
  const rules = await prisma.categoryRule.findMany({
    orderBy: { priority: "desc" },
  });

  // Camada 1: exact
  const exactRule = rules.find((r) => r.matchType === "exact" && r.pattern === normalizedName);
  if (exactRule) return { categoryId: exactRule.categoryId, confidence: 1.0, source: "rule_exact" };

  // Camada 2: contains
  const containsRule = rules.find((r) => r.matchType === "contains" && normalizedName.includes(r.pattern));
  if (containsRule) return { categoryId: containsRule.categoryId, confidence: 0.9, source: "rule_contains" };

  // Camada 3: regex
  const regexRule = rules.find((r) => {
    if (r.matchType !== "regex") return false;
    try {
      return new RegExp(r.pattern).test(normalizedName);
    } catch {
      return false;
    }
  });
  if (regexRule) return { categoryId: regexRule.categoryId, confidence: 0.85, source: "rule_regex" };

  return { categoryId: null, confidence: 0, source: "none" };
}

export async function learnFromEdit(
  transactionId: string,
  newCategoryId: string,
  applyScope: "this" | "future" | "all"
) {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

  await prisma.categoryRule.upsert({
    where: {
      id: `learned_${tx.normalizedName.slice(0, 50)}`,
    },
    update: {
      categoryId: newCategoryId,
      applyToFuture: applyScope !== "this",
      applyToAll: applyScope === "all",
    },
    create: {
      id: `learned_${tx.normalizedName.slice(0, 50)}`,
      categoryId: newCategoryId,
      pattern: tx.normalizedName,
      matchType: "exact",
      priority: 10,
      applyToFuture: applyScope !== "this",
      applyToAll: applyScope === "all",
    },
  });

  if (applyScope === "all") {
    await prisma.transaction.updateMany({
      where: { normalizedName: tx.normalizedName },
      data: {
        categoryId: newCategoryId,
        categorySource: "rule_exact",
        categoryConfidence: 1.0,
      },
    });
  }
}
