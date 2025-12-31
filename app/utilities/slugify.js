import slugify from "slugify";

async function generateUniqueSlug(title, existingId = null, model) {
  // Configure slugify for better handling of various languages
  slugify.extend({
    ı: "i",
    İ: "I",
    ğ: "g",
    Ğ: "G",
    ü: "u",
    Ü: "U",
    ş: "s",
    Ş: "S",
    ö: "o",
    Ö: "O",
    ç: "c",
    Ç: "C",
  });

  let baseSlug = title
    ?.replace(/[^\u0980-\u09FF\w\s-]/g, "-") // Replace special chars except Bangla chars with -
    ?.replace(/\s+/g, "-") // Replace spaces with -
    ?.replace(/-+/g, "-") // Replace multiple - with single -
    ?.trim()
    ?.toLowerCase(); // Trim - from start and end

  // If slug is empty or contains only dashes, use a fallback
  if (!baseSlug || baseSlug.replace(/-/g, "").length === 0) {
    baseSlug = "scaper";
  }

  // Check for uniqueness
  let slug = baseSlug;
  let counter = 1;
  let exists = true;

  while (exists) {
    const whereClause = {
      slug: slug,
    };

    // Exclude current post if updating
    if (existingId) {
      whereClause.id = { not: existingId };
    }

    const existingPost = await model.findFirst({
      where: whereClause,
    });

    if (!existingPost) {
      exists = false;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return slug;
}

export default generateUniqueSlug;
