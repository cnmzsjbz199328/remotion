---
name: gen-image
description: Generates cinematic 16:9 background images for each news story segment using an image generation model. Reads cache/script-{date}.json to get story titles and key points, generates one image per segment, saves to cache/assets/{date}/, and updates cache/assets-{date}.json. Images are optional — always ask the user whether they want to generate images before invoking this skill.
argument-hint: [YYYY-MM-DD]
---

# gen-image

Generate one cinematic background image per news story segment for the given date.

## When to invoke

**Always ask the user first:**
> "Do you want to generate AI images for this date before rendering? It takes ~1 min per story and is optional — the video renders cleanly without images."

Only proceed if the user says yes.

## Steps

1. **Read the script**
   Load `cache/script-{DATE}.json`. The `segments` array contains each story with `newsId`, `progressLabel`, `category`, and `keyPoints`.

2. **For each segment, build an image prompt**
   Craft a concise cinematic image description (under 100 words) based on the story's headline, category, and key points. Rules:
   - No real named individuals depicted
   - No on-screen text, labels, or UI elements
   - Photorealistic editorial photography or cinematic illustration style
   - Must suit a 16:9 video background (subject has visual weight without crowding the frame)
   - Evoke the story's mood and geographical/institutional setting

   Example prompts by category:
   - **policy / legal**: A grand federal courthouse exterior at dusk, dramatic clouds, strong architectural lines, documentary photography style
   - **industry**: Sweeping view of a modern Silicon Valley campus at golden hour, glass buildings, busy atrium, editorial style
   - **model-release**: Abstract visualization of interconnected neural pathways, deep space blues and electric purples, cinematic lighting
   - **culture**: Wide exterior of St. Peter's Basilica at dawn, mist, warm light through arches, quiet gravitas

3. **Generate the image**
   Use your available image generation model to produce a 16:9 image from the prompt. Save the result as:
   ```
   cache/assets/{DATE}/generated-{newsId}.jpg
   ```
   Create the directory if it does not exist.

4. **Update the assets manifest**
   Load `cache/assets-{DATE}.json` if it exists; otherwise create it from the script's segment list.
   For each generated image, add or replace an entry in that segment's `images` array:
   ```json
   { "file": "cache/assets/{DATE}/generated-{newsId}.jpg", "source": "generated", "credit": null }
   ```
   Place generated images **first** in the array so they are preferred over placeholders.

5. **Write the updated manifest**
   Save the modified object back to `cache/assets-{DATE}.json`.

## Output summary

Report how many images were generated, skipped (already existed), and failed. Example:
```
✅  5 generated, 0 skipped, 0 failed → cache/assets-2026-05-19.json
```

## Schema reference

`cache/assets-{date}.json` format:
```json
{
  "date": "2026-05-19",
  "segments": [
    {
      "newsId": "story-1",
      "images": [
        { "file": "cache/assets/2026-05-19/generated-story-1.jpg", "source": "generated", "credit": null }
      ]
    }
  ]
}
```

Valid `source` values: `"generated"` | `"og-image"` | `"pexels"` | `"unsplash"` | `"fallback"`
