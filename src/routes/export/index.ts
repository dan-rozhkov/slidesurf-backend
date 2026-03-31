import fp from "fastify-plugin";
import PptxGenJSModule from "pptxgenjs";
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import sharp from "sharp";
import { authHook } from "@/hooks/auth-hook";
import { logUserAction } from "@/services/action-logger";
import type { FastifyBaseLogger } from "fastify";

const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const EXPORT_TIMEOUT_MS = 55_000;

// Types mirrored from client-side pptx-export (only the data shapes needed server-side)
type MappedNode = {
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: string;
  lineHeight?: number;
  textAlign?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  src?: string;
  dataType?: string;
  maskImageUrl?: string;
  objectFit?: "cover";
  isGroup?: boolean;
  children?: MappedNode[];
  isContainer?: boolean;
  backgroundImageSrc?: string;
};

type SlideData = {
  nodes: MappedNode[];
  backgroundImage?: string;
  backgroundColor?: string;
  width: number;
  height: number;
};

// Image cache types for request-scoped caching
type ImageCache = {
  base64: Map<string, string>;
  buffer: Map<string, Buffer>;
};

function createImageCache(): ImageCache {
  return {
    base64: new Map(),
    buffer: new Map(),
  };
}

// Function to fetch image and convert to base64
async function fetchImageAsBase64(url: string, log: FastifyBaseLogger): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PPTX-Export/1.0)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      log.warn(
        `Failed to fetch image: ${response.status} ${response.statusText} — ${url.substring(0, 100)}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    // Determine MIME type by header or file extension
    let contentType = response.headers.get("content-type") || "image/jpeg";

    // Fallback by file extension
    if (!contentType.startsWith("image/")) {
      if (url.toLowerCase().includes(".png")) {
        contentType = "image/png";
      } else if (url.toLowerCase().includes(".gif")) {
        contentType = "image/gif";
      } else if (url.toLowerCase().includes(".webp")) {
        contentType = "image/webp";
      } else {
        contentType = "image/jpeg";
      }
    }

    const result = `data:${contentType};base64,${base64}`;

    return result;
  } catch (error) {
    log.warn(`Failed to fetch image ${url.substring(0, 100)}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// Cached version of fetchImageAsBase64
async function fetchImageAsBase64Cached(
  url: string,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<string | null> {
  if (cache.base64.has(url)) {
    return cache.base64.get(url)!;
  }

  const result = await fetchImageAsBase64(url, log);
  if (result) {
    cache.base64.set(url, result);
  }
  return result;
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;

  return Buffer.from(match[2], "base64");
}

async function fetchImageBuffer(url: string, log: FastifyBaseLogger): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PPTX-Export/1.0)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      log.warn(
        `Failed to fetch image buffer: ${response.status} ${response.statusText} — ${url.substring(0, 100)}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    log.warn(`Failed to fetch image buffer ${url.substring(0, 100)}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// Cached version of fetchImageBuffer
async function fetchImageBufferCached(
  url: string,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<Buffer | null> {
  if (cache.buffer.has(url)) {
    return cache.buffer.get(url)!;
  }

  const result = await fetchImageBuffer(url, log);
  if (result) {
    cache.buffer.set(url, result);
  }
  return result;
}

// Cached version of getImageBuffer
async function getImageBufferCached(
  src: string,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<Buffer | null> {
  if (src.startsWith("data:")) {
    return dataUrlToBuffer(src);
  }

  return fetchImageBufferCached(src, cache, log);
}

async function createMaskedImage(
  node: MappedNode,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<string | null> {
  if (!node.src || !node.maskImageUrl) {
    return null;
  }

  const [imageBuffer, maskBuffer] = await Promise.all([
    getImageBufferCached(node.src, cache, log),
    getImageBufferCached(node.maskImageUrl, cache, log),
  ]);

  if (!imageBuffer || !maskBuffer) {
    return null;
  }

  const targetWidth = Math.max(1, Math.round(node.width));
  const targetHeight = Math.max(1, Math.round(node.height));

  try {
    const resizedImage = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
      })
      .ensureAlpha()
      .toBuffer();

    const resizedMask = await sharp(maskBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
      })
      .ensureAlpha()
      .toBuffer();

    const maskedImage = await sharp(resizedImage)
      .composite([{ input: resizedMask, blend: "dest-in" }])
      .png()
      .toBuffer();

    return `data:image/png;base64,${maskedImage.toString("base64")}`;
  } catch (error) {
    log.warn(`Failed to apply mask to image: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function createCroppedImage(
  node: MappedNode,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<string | null> {
  if (!node.src) {
    return null;
  }

  const imageBuffer = await getImageBufferCached(node.src, cache, log);
  if (!imageBuffer) {
    return null;
  }

  const targetWidth = Math.max(1, Math.round(node.width));
  const targetHeight = Math.max(1, Math.round(node.height));

  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const croppedImage = await image
      .clone()
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
      })
      .toBuffer();

    const mimeType =
      metadata.format === "png"
        ? "image/png"
        : metadata.format === "webp"
        ? "image/webp"
        : "image/jpeg";

    return `data:${mimeType};base64,${croppedImage.toString("base64")}`;
  } catch (error) {
    log.warn(`Failed to crop image: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// Process a single image node and return the data URL
async function processImageNode(
  node: MappedNode,
  cache: ImageCache,
  log: FastifyBaseLogger
): Promise<string | null> {
  if (!node.src) return null;

  let imageSource = node.src;

  if (node.maskImageUrl) {
    const maskedImage = await createMaskedImage(node, cache, log);
    if (maskedImage) {
      imageSource = maskedImage;
    }
  } else if (node.objectFit === "cover") {
    const croppedImage = await createCroppedImage(node, cache, log);
    if (croppedImage) {
      imageSource = croppedImage;
    }
  }

  // Convert to base64 if needed
  if (imageSource.startsWith("data:")) {
    if (imageSource.includes("base64,")) {
      return imageSource;
    }
    return null; // Non-base64 data URL
  }

  // Fetch external URL
  return fetchImageAsBase64Cached(imageSource, cache, log);
}

// Constants for slide dimensions
const SLIDE_WIDTH_IN = 10; // slide width in inches for 16:9
const SLIDE_HEIGHT_IN = 5.625; // slide height in inches for 16:9
const POINTS_PER_INCH = 72; // 1 inch = 72 points

function px2inX(px: number, slideWidth: number): number {
  return px * (SLIDE_WIDTH_IN / slideWidth);
}

function px2inY(px: number, slideHeight: number): number {
  return px * (SLIDE_HEIGHT_IN / slideHeight);
}

function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;

  const match = rgb.match(/\d+/g);
  if (!match) return "#000000";

  const [r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

// Function to flatten groups into a flat list of elements
function flattenNodes(
  nodes: MappedNode[],
  parentX = 0,
  parentY = 0
): MappedNode[] {
  const result: MappedNode[] = [];

  for (const node of nodes) {
    if (node.isGroup && node.children) {
      // For a group, expand child elements
      const childNodes = flattenNodes(
        node.children,
        node.x + parentX,
        node.y + parentY
      );
      result.push(...childNodes);
    } else {
      // Regular element - add with parent group offset
      result.push({
        ...node,
        x: node.x + parentX,
        y: node.y + parentY,
      });
    }
  }

  return result;
}

async function generatePptx(
  slides: SlideData[],
  cleanTitle: string,
  log: FastifyBaseLogger
): Promise<{ buffer: Buffer; sanitizedTitle: string; encodedFilename: string }> {
  // Create request-scoped image cache
  const imageCache = createImageCache();

  const pptx = new PptxGenJS();

  // Presentation settings
  pptx.layout = "LAYOUT_16x9";
  pptx.rtlMode = false;

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    // Add background image if exists
    if (slideData.backgroundImage) {
      try {
        if (slideData.backgroundImage.startsWith("data:")) {
          // Check if data URL is base64
          if (slideData.backgroundImage.includes("base64,")) {
            slide.addImage({
              data: slideData.backgroundImage,
              x: 0,
              y: 0,
              w: "100%",
              h: "100%",
            });
          }
        } else {
          // For regular URLs, load and convert to base64 (with caching)
          const base64Image = await fetchImageAsBase64Cached(
            slideData.backgroundImage,
            imageCache,
            log
          );
          if (base64Image) {
            slide.addImage({
              data: base64Image,
              x: 0,
              y: 0,
              w: "100%",
              h: "100%",
            });
          }
        }
      } catch (error) {
        log.warn(
          `Failed to add background image: ${error instanceof Error ? error.message : error}`
        );
      }
    } else if (
      slideData.backgroundColor &&
      slideData.backgroundColor !== "rgba(0, 0, 0, 0)" &&
      slideData.backgroundColor !== "transparent"
    ) {
      // Fallback to solid background color when no image is provided
      slide.background = { color: rgbToHex(slideData.backgroundColor) };
    }

    const flatNodes = flattenNodes(slideData.nodes);

    // Group nodes by type
    const containerNodes = flatNodes.filter((node) => node.isContainer);

    const textNodes = flatNodes.filter(
      (node) =>
        node.text &&
        node.text.trim().length > 0 &&
        !["img", "svg", "canvas", "script", "style", "custom", "container"].includes(
          node.tag
        )
    );

    const imageNodes = flatNodes.filter(
      (node) =>
        node.src && ["img", "custom", "svg", "canvas"].includes(node.tag)
    );

    // Add container shapes/images first (cards, columns backgrounds)
    for (const node of containerNodes) {
      const scaledX = px2inX(node.x, slideData.width);
      const scaledY = px2inY(node.y, slideData.height);
      const scaledW = px2inX(node.width, slideData.width);
      const scaledH = px2inY(node.height, slideData.height);

      // If container has a background image (for cards with gradients), use image
      if (node.backgroundImageSrc) {
        try {
          slide.addImage({
            data: node.backgroundImageSrc,
            x: scaledX,
            y: scaledY,
            w: scaledW,
            h: scaledH,
          });
          // Card rendered as image - text will be added on top separately
          continue;
        } catch (error) {
          log.warn(`Failed to add container background image: ${error instanceof Error ? error.message : error}`);
          // Fallback to shape rendering below
        }
      }

      // Render as shape (for columns, or cards if image capture failed)
      const scaledBorderRadius = node.borderRadius
        ? Math.min(node.borderRadius / Math.min(node.width, node.height), 0.5)
        : 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shapeOptions: Record<string, any> = {
        x: scaledX,
        y: scaledY,
        w: scaledW,
        h: scaledH,
      };

      // Add fill if background color exists
      if (
        node.backgroundColor &&
        node.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        node.backgroundColor !== "transparent"
      ) {
        shapeOptions.fill = { color: rgbToHex(node.backgroundColor) };
      } else {
        // No fill
        shapeOptions.fill = { type: "none" };
      }

      // Add border if exists
      if (
        node.borderColor &&
        node.borderWidth &&
        node.borderWidth > 0 &&
        node.borderColor !== "rgba(0, 0, 0, 0)" &&
        node.borderColor !== "transparent"
      ) {
        shapeOptions.line = {
          color: rgbToHex(node.borderColor),
          width: Math.max(0.5, node.borderWidth),
        };
      } else {
        // No border
        shapeOptions.line = { type: "none" };
      }

      // Add rounded corners if border radius exists
      if (scaledBorderRadius > 0) {
        shapeOptions.rectRadius = scaledBorderRadius;
      }

      try {
        // Use roundRect for rounded corners, rect for square corners
        const shapeType = scaledBorderRadius > 0 ? "roundRect" : "rect";
        slide.addShape(shapeType, shapeOptions);
      } catch (error) {
        log.warn(`Failed to add container shape: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Sort text nodes by position
    textNodes.sort((a, b) => a.y - b.y);

    // Add text nodes
    textNodes.forEach((node) => {
      if (!node.text) return;

      const sanitizedTextContent = sanitizeText(node.text);
      if (!sanitizedTextContent) return;

      // Scale sizes and positions
      const scaledX = px2inX(node.x, slideData.width);
      const scaledY = px2inY(node.y, slideData.height);
      const scaledW = px2inX(node.width, slideData.width);
      const scaledH = px2inY(node.height, slideData.height);

      // Scale font size
      const scaledFontSize =
        px2inY(node.fontSize || 16, slideData.height) * POINTS_PER_INCH;

      const scaledLineHeight =
        px2inY(node.lineHeight || 1.15, slideData.height) * POINTS_PER_INCH;

      const textOptions: Record<string, unknown> = {
        x: scaledX,
        y: scaledY,
        w: scaledW,
        h: scaledH,
        fontSize: scaledFontSize,
        lineSpacing: scaledLineHeight,
        fontFace: (node.fontFamily || "Arial")
          .split(",")[0]
          .replace(/['"]/g, ""),
        color: node.color ? rgbToHex(node.color) : "#000000",
        align: node.textAlign || "left",
        valign: "top",
        bold:
          node.fontWeight === "bold" ||
          parseInt(node.fontWeight || "400") >= 600,
        wrap: true,
      };

      if (
        node.backgroundColor &&
        node.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        node.backgroundColor !== "transparent"
      ) {
        textOptions.fill = { color: rgbToHex(node.backgroundColor) };
      }

      if (node.borderColor && node.borderWidth && node.borderWidth > 0) {
        textOptions.line = {
          color: rgbToHex(node.borderColor),
          width: Math.max(1, node.borderWidth),
        };
      }

      try {
        slide.addText(sanitizedTextContent, textOptions);
      } catch (error) {
        log.warn(`Failed to add text: ${error instanceof Error ? error.message : error}`);
      }
    });

    // Process all images in parallel for better performance
    const processedImages = await Promise.all(
      imageNodes.map(async (node) => {
        if (!node.src) return null;

        try {
          const processedSrc = await processImageNode(node, imageCache, log);
          if (!processedSrc) return null;

          return {
            node,
            src: processedSrc,
            scaledX: px2inX(node.x, slideData.width),
            scaledY: px2inY(node.y, slideData.height),
            scaledW: px2inX(node.width, slideData.width),
            scaledH: px2inY(node.height, slideData.height),
          };
        } catch (error) {
          log.warn(
            `Failed to process image ${node.src?.substring(0, 50)}: ${error instanceof Error ? error.message : error}`
          );
          return null;
        }
      })
    );

    // Add processed images to slide (synchronously to maintain order)
    for (const processed of processedImages) {
      if (!processed) continue;

      try {
        slide.addImage({
          data: processed.src,
          x: processed.scaledX,
          y: processed.scaledY,
          w: processed.scaledW,
          h: processed.scaledH,
        });
      } catch (error) {
        log.warn(
          `Failed to add image to slide: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }

  // Export to buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" });

  // Safe filename encoding (preserving Unicode characters like Cyrillic)
  const sanitizedTitle =
    cleanTitle
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Remove only filesystem-unsafe characters
      .replace(/\s+/g, " ") // Normalize spaces
      .trim()
      .substring(0, 100) || // Limit length
    "presentation"; // Fallback if string is empty

  const encodedFilename = encodeURIComponent(sanitizedTitle);

  return { buffer, sanitizedTitle, encodedFilename };
}

export default fp(async (fastify) => {
  fastify.post<{
    Body: { slides: SlideData[]; title: string };
  }>(
    "/api/export-pptx",
    { preHandler: authHook },
    async (req, reply) => {
      const userId = req.userId;
      const startTime = Date.now();

      try {
        const { slides, title } = req.body;

        if (!slides || !Array.isArray(slides) || slides.length === 0) {
          return reply.code(400).send({ error: "Invalid slides data" });
        }

        const imageCount = slides.reduce((sum, s) => {
          const flat = flattenNodes(s.nodes);
          return sum + flat.filter((n) => n.src && ["img", "custom", "svg", "canvas"].includes(n.tag)).length;
        }, 0);

        req.log.info({ slidesCount: slides.length, imageCount, title }, "PPTX export started");

        // Clean and validate title
        const cleanTitle =
          typeof title === "string" ? sanitizeText(title) : "presentation";

        // Wrap export in a timeout to respond before Render kills the connection
        const exportResult = await Promise.race([
          generatePptx(slides, cleanTitle, req.log),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Export timed out")), EXPORT_TIMEOUT_MS)
          ),
        ]);

        const durationMs = Date.now() - startTime;
        req.log.info({ slidesCount: slides.length, durationMs }, "PPTX export completed");

        // Log successful PPTX export
        if (userId) {
          logUserAction({
            userId,
            actionType: "export_pptx",
            metadata: {
              slidesCount: slides.length,
              title: exportResult.sanitizedTitle,
            },
            status: "success",
          });
        }

        return reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          )
          .header(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${exportResult.encodedFilename}.pptx`
          )
          .send(exportResult.buffer);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "PPTX export error";
        req.log.error({ err: error, durationMs }, `PPTX export failed: ${errorMessage}`);

        // Log failed PPTX export
        if (userId) {
          logUserAction({
            userId,
            actionType: "export_pptx",
            metadata: {
              slidesCount: 0,
            },
            status: "error",
            errorMessage,
          });
        }

        const statusCode = errorMessage === "Export timed out" ? 504 : 500;
        return reply.code(statusCode).send({ error: errorMessage === "Export timed out" ? "Export timed out — try a presentation with fewer images" : "Failed to generate PPTX" });
      }
    }
  );
});
