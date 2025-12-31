import { prisma } from "../lib/prisma.js";

const cursorPagination = async ({
  model,
  query = {},
  limit = 10,
  cursor = null,
  include = {},
  orderBy = [{ createdAt: "desc" }, { id: "desc" }],
  ...props
}) => {
  // Start with base query
  let where = { ...query };

  if (cursor && typeof cursor === "string") {
    const parts = cursor.split("_");
    if (parts.length === 3) {
      const cursorId = parseInt(parts[0]);
      const timestamp = parseInt(parts[1]);

      // Only proceed if we have valid timestamp
      if (!isNaN(timestamp)) {
        const cursorDate = new Date(timestamp);

        // Build Prisma where condition for cursor pagination
        where = {
          ...where,
          OR: [
            // Items with earlier timestamp
            {
              createdAt: { lt: cursorDate },
            },
            // Items with same timestamp but lower ID
            {
              createdAt: { equals: cursorDate },
              id: { lt: cursorId },
            },
          ],
        };
      }
    }
  }

  // Get total count without cursor conditions
  const total = await model.count({
    where: query, // Use original query without cursor
  });

  // Get paginated results
  const items = await model.findMany({
    where,
    take: limit + 1,
    orderBy,
    include,
    ...props,
  });

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;

  let nextCursor = null;
  if (hasMore && results.length > 0) {
    const lastItem = results[results.length - 1];
    // Only create next cursor if we have valid data
    if (lastItem.id && lastItem.createdAt) {
      nextCursor = `${lastItem.id}_${lastItem.createdAt.getTime()}_0`;
    }
  }

  return {
    items: results,
    hasMore,
    nextCursor,
    total,
  };
};

export default cursorPagination;
