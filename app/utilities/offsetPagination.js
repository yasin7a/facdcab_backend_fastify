const offsetPagination = async ({
  model,
  page = 1,
  limit = 10,
  where = {},
  orderBy = { created_at: "desc" },
  omit,
  select,
  include,
}) => {
  const offset = (page - 1) * limit;

  // Count total records
  const total = await model.count({
    where,
  });

  // Fetch records
  const data = await model.findMany({
    where,
    omit,
    orderBy,
    skip: offset,
    take: Number(limit),
    select,
    include,
  });

  const to = offset + data.length;
  const from = offset + 1;
  const last_page = Math.ceil(total / limit);
  const current_page = Number(page);
  const next_page = current_page < last_page ? current_page + 1 : 0;
  const prev_page = current_page > 1 ? current_page - 1 : 0;

  return {
    data,
    pagination: {
      total,
      current_page,
      last_page,
      next_page,
      prev_page,
      from,
      to,
    },
  };
};

export default offsetPagination;
