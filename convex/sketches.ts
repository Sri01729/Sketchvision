import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";

// Use the same OpenAI API key for both text analysis and image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const saveSketches = mutation({
  args: {
    sketchData: v.string(),
    annotations: v.array(v.object({
      text: v.string(),
      x: v.number(),
      y: v.number()
    })),
    customPrompt: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<Id<"sketches">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // First, insert the sketch with a placeholder prompt
    const sketchId = await ctx.db.insert("sketches", {
      userId,
      sketchData: args.sketchData,
      annotations: args.annotations,
      prompt: "Generating prompt..." // Placeholder
    });

    // Schedule the analysis to be done separately
    await ctx.scheduler.runAfter(0, internal.sketches.runAnalysisAndUpdateSketch, {
      sketchId,
      sketchData: args.sketchData,
      annotations: args.annotations,
      customPrompt: args.customPrompt
    });

    return sketchId;
  }
});

// New internal mutation to update the sketch with the actual prompt
export const updateSketchPrompt = internalMutation({
  args: {
    sketchId: v.id("sketches"),
    prompt: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sketchId, {
      prompt: args.prompt
    });
    console.log("Sketch successfully updated with prompt:", args.prompt.substring(0, 50) + "...");
  }
});

// New internal action to run the analysis and then update the sketch
export const runAnalysisAndUpdateSketch = internalAction({
  args: {
    sketchId: v.id("sketches"),
    sketchData: v.string(),
    annotations: v.array(v.object({
      text: v.string(),
      x: v.number(),
      y: v.number()
    })),
    customPrompt: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    console.log("Running sketch analysis...");
    const prompt = await analyzeSketchInternal(args.annotations, args.customPrompt);

    // Update the sketch with the actual prompt
    await ctx.runMutation(internal.sketches.updateSketchPrompt, {
      sketchId: args.sketchId,
      prompt: prompt
    });

    return prompt;
  }
});

// Helper function to analyze sketches without the Convex scheduler
async function analyzeSketchInternal(
  annotations: Array<{text: string, x: number, y: number}>,
  customPrompt?: string
): Promise<string> {
  console.log("Analyzing sketch with annotations:", annotations);
  console.log("Custom prompt provided:", customPrompt || "None");

  if (annotations.length === 0 && !customPrompt) {
    return "A detailed artistic scene";
  }

  const userContent = customPrompt
    ? `Please create a detailed image generation prompt based on these annotations and their positions: ${JSON.stringify(annotations)}. Additionally, incorporate this specific user request: "${customPrompt}"`
    : `Please create a detailed image generation prompt based on these annotations and their positions: ${JSON.stringify(annotations)}`;

  const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
    {
      role: "system",
      content: `You are an expert at analyzing sketches and creating detailed image generation prompts.
      Focus on the annotations provided by the user and create a vivid, detailed prompt that captures their intent.
      Ignore the base64 image data and focus on the annotations and their positions to understand what the user wants to create.
      Create prompts that will work well with DALL-E 3. Be creative and expansive in your descriptions.
      If the user provides a custom prompt, make sure to incorporate their specific requirements while still creating a cohesive and well-structured prompt.`
    },
    {
      role: "user",
      content: userContent
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages,
    });

    const generatedPrompt = response.choices[0].message.content || "A detailed artistic image";
    console.log("Generated prompt:", generatedPrompt);
    return generatedPrompt;
  } catch (error) {
    console.error("Failed to analyze sketch:", error);
    return customPrompt
      ? `A detailed artistic scene incorporating: ${customPrompt}`
      : "A detailed artistic scene with elements from the sketch";
  }
}

// Define a mutation for checking if the prompt is ready and generating image
export const generateImage = mutation({
  args: { sketchId: v.id("sketches") },
  handler: async (ctx, args): Promise<string> => {
    // First check if the sketch exists and has a prompt
    const sketch = await ctx.db.get(args.sketchId);
    if (!sketch) throw new Error("Sketch not found");
    if (!sketch.prompt) throw new Error("No prompt generated");

    // If the prompt is still generating, return a special message
    if (sketch.prompt === "Generating prompt...") {
      // Schedule a check after a short delay using Convex scheduler
      await ctx.scheduler.runAfter(2000, internal.sketches.checkPromptAndGenerateImage, {
        sketchId: args.sketchId,
        attemptNumber: 1,
        maxAttempts: 6
      });

      // Return a status message that the frontend can handle
      return "WAITING_FOR_PROMPT";
    }

    // If we already have a prompt, proceed with image generation immediately
    console.log("Starting image generation with prompt:", sketch.prompt);
    try {
      const imageUrl: string = await ctx.scheduler.runAfter(0, internal.sketches.generateImageFromPrompt, {
        sketchId: args.sketchId
      });

      console.log("Generated image URL:", imageUrl);

      await ctx.db.patch(args.sketchId, {
        generatedImage: imageUrl
      });

      return imageUrl;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error("OpenAI API Error:", error.status, error.message);
        if (error.status === 429) {
          throw new Error("Rate limit reached. Please try again in a few moments.");
        }
      }
      console.error("Failed to generate image:", error);
      throw error;
    }
  }
});

// Add a new internal action for checking prompt status and generating image
export const checkPromptAndGenerateImage = internalAction({
  args: {
    sketchId: v.id("sketches"),
    attemptNumber: v.number(),
    maxAttempts: v.number()
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Get the latest sketch data
    const sketch = await ctx.runQuery(internal.sketches.getSketchById, { sketchId: args.sketchId });
    if (!sketch) {
      console.error("Sketch not found during prompt check");
      return null;
    }

    // Check if we have a real prompt now
    if (sketch.prompt && sketch.prompt !== "Generating prompt...") {
      console.log(`Prompt ready on attempt ${args.attemptNumber}, generating image...`);

      // Generate the image now that we have a prompt
      const imageUrl = await ctx.runAction(internal.sketches.generateImageFromPrompt, {
        sketchId: args.sketchId
      });

      // Update the sketch with the image URL
      await ctx.runMutation(internal.sketches.updateSketchImage, {
        sketchId: args.sketchId,
        imageUrl
      });

      return imageUrl;
    }

    // If we've hit max attempts, give up
    if (args.attemptNumber >= args.maxAttempts) {
      console.log(`Max attempts (${args.maxAttempts}) reached waiting for prompt.`);
      return null;
    }

    // Otherwise, schedule another check with increasing delay
    const nextDelay = 2000 * Math.pow(1.5, args.attemptNumber);  // Exponential backoff
    console.log(`Prompt not ready on attempt ${args.attemptNumber}, checking again in ${nextDelay/1000}s...`);

    await ctx.scheduler.runAfter(nextDelay, internal.sketches.checkPromptAndGenerateImage, {
      sketchId: args.sketchId,
      attemptNumber: args.attemptNumber + 1,
      maxAttempts: args.maxAttempts
    });

    return null;
  }
});

// Add a helper mutation to update the sketch with an image URL
export const updateSketchImage = internalMutation({
  args: {
    sketchId: v.id("sketches"),
    imageUrl: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sketchId, {
      generatedImage: args.imageUrl
    });
    console.log("Sketch successfully updated with image URL");
  }
});

export const listSketches = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("sketches")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .collect();
  }
});

// Original analyzeSketch is kept for backward compatibility
export const analyzeSketch = internalAction({
  args: {
    sketchData: v.string(),
    annotations: v.array(v.object({
      text: v.string(),
      x: v.number(),
      y: v.number()
    })),
    customPrompt: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<string> => {
    return await analyzeSketchInternal(args.annotations, args.customPrompt);
  }
});

export const generateImageFromPrompt = internalAction({
  args: { sketchId: v.id("sketches") },
  handler: async (ctx, args): Promise<string> => {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      throw new Error("OpenAI API key not configured. Please add your OpenAI API key to the environment variables.");
    }

    // Directly get the prompt from the database
    const sketch = await ctx.runQuery(internal.sketches.getSketchById, { sketchId: args.sketchId });
    if (!sketch) {
      throw new Error("Sketch not found");
    }

    const prompt = sketch.prompt;
    if (!prompt) {
      throw new Error("No prompt found in sketch");
    }

    if (prompt === "Generating prompt...") {
      throw new Error("Prompt is still being generated. Please try again in a moment.");
    }

    // Verify we have a real prompt
    console.log("RETRIEVED PROMPT FROM DB:", prompt.substring(0, 50) + "...");
    console.log("PROMPT LENGTH:", prompt.length);

    if (!prompt || prompt.length < 10 || /^kc\w+$/.test(prompt)) {
      console.error("Invalid prompt retrieved:", prompt);
      throw new Error("Invalid prompt retrieved. Please try again.");
    }

    try {
      // Create a new OpenAI client for each request to ensure fresh state
      const imageGenOpenAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      console.log("Sending prompt to DALL-E:", prompt.substring(0, 50) + "...");

      const response = await imageGenOpenAI.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });

      if (!response.data || response.data.length === 0) {
        throw new Error("No data in DALL-E response");
      }

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error("No image URL in response");
      }

      console.log("Successfully generated image URL:", imageUrl);
      return imageUrl;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error("OpenAI API Error:", error.status, error.message);
        if (error.status === 429) {
          throw new Error("Rate limit reached. Please try again in a few moments.");
        }
      }
      console.error("Failed to generate image:", error);
      throw error;
    }
  }
});

// Add an internal query to get sketch by ID
export const getSketchById = internalQuery({
  args: { sketchId: v.id("sketches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sketchId);
  },
});

// Add a mutation to delete a sketch by ID
export const deleteSketch = mutation({
  args: { sketchId: v.id("sketches") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // First, get the sketch to verify ownership
    const sketch = await ctx.db.get(args.sketchId);
    if (!sketch) throw new Error("Sketch not found");

    // Verify that this sketch belongs to the current user
    if (sketch.userId !== userId) {
      throw new Error("Not authorized to delete this sketch");
    }

    // Delete the sketch
    await ctx.db.delete(args.sketchId);
    return true;
  }
});
