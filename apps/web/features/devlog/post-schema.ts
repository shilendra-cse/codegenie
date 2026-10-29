import { z } from "zod";

export const DEFAULT_AUTHOR = "Shilendra Singh";

const isCalendarDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export const postHeaderSchema = z.strictObject({
  title: z.string().trim().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
    .refine(isCalendarDate, "is not a real date"),
  summary: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).default(DEFAULT_AUTHOR),
  draft: z.boolean().default(false),
  image: z
    .string()
    .regex(
      /^[\w-][\w.-]*\.(png|jpe?g)$/,
      "must be a .png or .jpg file name in the post's assets folder",
    )
    .optional(),
});

export type PostHeader = z.infer<typeof postHeaderSchema>;
