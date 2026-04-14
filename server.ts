import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure multer for memory storage
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  // API Route: Upload PDF and extract text
  app.post("/api/upload-pdf", upload.single("pdf"), async (req: Request, res: Response) => {
    console.log("[POST] /api/upload-pdf - Request received");
    try {
      const file = (req as any).file;
      if (!file) {
        console.error("[ERROR] /api/upload-pdf - No file uploaded");
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      console.log(`[INFO] /api/upload-pdf - PDF buffer received: ${file.buffer.length} bytes`);
      console.log("PDF parsing started");

      // Convert buffer to Uint8Array for pdfjs-dist
      const data = new Uint8Array(file.buffer);
      
      // Load the PDF document
      const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      let fullText = "";

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n";
      }

      console.log("PDF parsing success");
      
      return res.json({ success: true, data: { text: fullText } });
    } catch (error: any) {
      console.error("[CRASH] /api/upload-pdf - Unexpected error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to extract text from PDF" });
    }
  });

  // API Route: Generate course (Placeholder/Redirect to frontend)
  app.post("/api/generate-course", async (req: Request, res: Response) => {
    console.log("[POST] /api/generate-course - Request received");
    try {
      // According to Gemini Skill, AI generation should happen on the frontend.
      // We provide this route to ensure no HTML is returned if hit.
      return res.status(400).json({ 
        success: false, 
        error: "Course generation is handled client-side for better performance and security." 
      });
    } catch (error: any) {
      console.error("[CRASH] /api/generate-course - Unexpected error:", error);
      return res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
  });

  // API Route: Payment (Placeholder)
  app.all("/api/payment/*", async (req: Request, res: Response) => {
    console.log(`[${req.method}] ${req.path} - Request received`);
    try {
      return res.status(501).json({ 
        success: false, 
        error: "Payment integration is not implemented in this MVP." 
      });
    } catch (error: any) {
      console.error(`[CRASH] ${req.path} - Unexpected error:`, error);
      return res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
  });

  // Global Error Handler for API routes to ensure JSON response
  app.use("/api", (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[GLOBAL API ERROR]:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  });

  // 404 handler for API routes
  app.use("/api", (req: Request, res: Response) => {
    console.warn(`[404 API]: ${req.method} ${req.path}`);
    res.status(404).json({ success: false, error: "API route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
