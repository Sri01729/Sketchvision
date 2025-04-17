import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  sketches: defineTable({
    userId: v.id("users"),
    sketchData: v.string(), // SVG data
    annotations: v.array(v.object({
      text: v.string(),
      x: v.number(),
      y: v.number()
    })),
    generatedImage: v.optional(v.string()),
    prompt: v.optional(v.string())
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
