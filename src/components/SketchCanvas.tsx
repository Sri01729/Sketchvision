"use client"

import type React from "react"
import { Id } from "../../convex/_generated/dataModel"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import {
  Brush,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Sparkles,
  Layers,
  PanelLeft,
  ChevronRight,
  Settings,
  Plus,
  MoreHorizontal,
  LogOut,
  Save,
  ImageIcon,
  HelpCircle,
  X,
  Menu,
  ChevronUp,
  Maximize,
} from "lucide-react"

// Define types for annotations
interface Annotation {
  text: string
  x: number
  y: number
}

// Define sketch type from Convex
interface Sketch {
  _id: Id<"sketches">;
  _creationTime: number;
  userId: Id<"users">;
  sketchData: string;
  annotations: Annotation[];
  generatedImage?: string;
  prompt?: string;
}

// Define tab types
type TabType = "draw" | "layers" | "settings"

// Add a type definition for stored sketch data
interface LocalStorageData {
  sketchData: string | null;
  annotations: Annotation[];
  brushColor: string;
  brushSize: number;
  generatedImage?: string | null;
  currentSketchId?: Id<"sketches"> | null;
  showGallery?: boolean;
}

export function SketchCanvas() {
  // State management
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("draw")
  const [brushSize, setBrushSize] = useState<number[]>([5])
  const [brushColor, setBrushColor] = useState("#9333EA") // Primary purple
  const [isEraserActive, setIsEraserActive] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [currentSketchId, setCurrentSketchId] = useState<Id<"sketches"> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [promptText, setPromptText] = useState("")
  const [showGallery, setShowGallery] = useState(true) // Add state for gallery visibility

  // Canvas refs and drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentAnnotation, setCurrentAnnotation] = useState("")

  // Theme detection
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect mobile screens
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Initial check
    checkIfMobile()

    // Check for dark mode preference
    const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    setIsDarkMode(isDark)

    // Add event listener for window resize
    window.addEventListener("resize", checkIfMobile)

    // Clean up
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  // Convex API
  const saveSketches = useMutation(api.sketches.saveSketches)
  const generateImage = useMutation(api.sketches.generateImage)
  const deleteSketch = useMutation(api.sketches.deleteSketch)
  const sketches = useQuery(api.sketches.listSketches) as Sketch[] || []

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Poll for generated image if we're in loading state
  useEffect(() => {
    if (isGenerating && currentSketchId) {
      const interval = setInterval(() => {
        // Find the current sketch in the sketches list
        const currentSketch = sketches.find((sketch) => sketch._id === currentSketchId)
        if (currentSketch?.generatedImage) {
          setGeneratedImage(currentSketch.generatedImage)
          setIsGenerating(false)

          // Save the generated image to localStorage after polling completes
          const canvas = canvasRef.current;
          if (canvas) {
            const dataToSave: LocalStorageData = {
              sketchData: canvas.toDataURL(),
              annotations,
              brushColor,
              brushSize: brushSize[0],
              generatedImage: currentSketch.generatedImage,
              currentSketchId
            };
            localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
          }

          clearInterval(interval)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [isGenerating, currentSketchId, sketches, annotations, brushColor, brushSize])

  // Load data from localStorage on component mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('sketchVisionData');
      if (savedData) {
        const parsedData: LocalStorageData = JSON.parse(savedData);

        // Set brush properties
        setBrushColor(parsedData.brushColor || "#9333EA");
        setBrushSize([parsedData.brushSize || 5]);

        // Set annotations
        if (parsedData.annotations && Array.isArray(parsedData.annotations)) {
          setAnnotations(parsedData.annotations);
        }

        // Restore generated image and current sketch ID
        if (parsedData.generatedImage) {
          setGeneratedImage(parsedData.generatedImage);
        }

        if (parsedData.currentSketchId) {
          setCurrentSketchId(parsedData.currentSketchId as unknown as Id<"sketches">);
        }

        // Restore gallery visibility setting
        if (parsedData.showGallery !== undefined) {
          setShowGallery(parsedData.showGallery);
        }

        // Load sketch data if it exists
        if (parsedData.sketchData) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
              };
              img.src = parsedData.sketchData;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    }
  }, []);

  // Save data to localStorage
  const saveDataToLocalStorage = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataToSave: LocalStorageData = {
        sketchData: isEraserActive ? null : canvas.toDataURL(), // Don't save while erasing
        annotations,
        brushColor,
        brushSize: brushSize[0],
        generatedImage,
        currentSketchId,
        showGallery
      };

      try {
        localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
      } catch (error) {
        console.error("Error saving data to localStorage:", error);
      }
    }
  }, [annotations, brushColor, brushSize, isEraserActive, generatedImage, currentSketchId, showGallery]);

  // Save before unloading the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataToSave: LocalStorageData = {
          sketchData: canvas.toDataURL(),
          annotations,
          brushColor,
          brushSize: brushSize[0]
        };
        localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [annotations, brushColor, brushSize]);

  // Modify the clearCanvas function to also clear localStorage
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setAnnotations([]);

    // Clear localStorage when canvas is cleared
    localStorage.removeItem('sketchVisionData');
  }, []);

  // Canvas drawing functions
  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setIsDrawing(true)
      setLastX(x)
      setLastY(y)

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.beginPath()
      ctx.moveTo(x, y)

    // Set up drawing or erasing styles
    if (isEraserActive) {
        ctx.globalCompositeOperation = "source-over"
        ctx.lineWidth = brushSize[0] * 2
        ctx.strokeStyle = "#FFFFFF"
    } else {
        ctx.globalCompositeOperation = "source-over"
        ctx.lineWidth = brushSize[0]
        ctx.strokeStyle = brushColor
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    },
    [isEraserActive, brushColor, brushSize],
  )

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      ctx.lineTo(x, y)
      ctx.stroke()

      setLastX(x)
      setLastY(y)
    },
    [isDrawing],
  )

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      // Save to localStorage when drawing stops
      try {
        const canvas = canvasRef.current;
        if (canvas) {
          const dataToSave: LocalStorageData = {
            sketchData: canvas.toDataURL(),
            annotations,
            brushColor,
            brushSize: brushSize[0]
          };
          localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
        }
      } catch (error) {
        console.error("Error saving data to localStorage:", error);
      }
    }

    setIsDrawing(false);
  }, [isDrawing, annotations, brushColor, brushSize]);

  const addAnnotation = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!currentAnnotation) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newAnnotations = [
        ...annotations,
        {
          text: currentAnnotation,
          x: x,
          y: y,
        },
      ];

      setAnnotations(newAnnotations);
      setCurrentAnnotation("");

      // Save to localStorage when an annotation is added
      try {
        const dataToSave: LocalStorageData = {
          sketchData: canvas.toDataURL(),
          annotations: newAnnotations,
          brushColor,
          brushSize: brushSize[0]
        };
        localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
      } catch (error) {
        console.error("Error saving data to localStorage:", error);
      }
    },
    [currentAnnotation, annotations, brushColor, brushSize],
  )

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsGenerating(true)
    setGeneratedImage(null)

    try {
      // Save the sketch with the custom prompt
      const sketchData = canvas.toDataURL()
      const sketchId = await saveSketches({
        sketchData,
        annotations,
        customPrompt: promptText.trim() || undefined
      })

      // sketchId has the correct type from Convex
      setCurrentSketchId(sketchId)

      // Generate the image with the existing API
      const result = await generateImage({ sketchId })

      // If we get an immediate result (not WAITING_FOR_PROMPT)
      if (result !== "WAITING_FOR_PROMPT") {
        setGeneratedImage(result)
        setIsGenerating(false)

        // Save the generated image to localStorage
        const dataToSave: LocalStorageData = {
          sketchData: canvas.toDataURL(),
          annotations,
          brushColor,
          brushSize: brushSize[0],
          generatedImage: result,
          currentSketchId: sketchId,
          showGallery
        };
        localStorage.setItem('sketchVisionData', JSON.stringify(dataToSave));
      }
      // Otherwise, polling will handle it via the useEffect
    } catch (error) {
      console.error("Failed to generate image:", error)
      setIsGenerating(false)
      alert("Error generating image. Please try again.")
    }
  }, [annotations, saveSketches, generateImage, promptText, brushColor, brushSize])

  const downloadImage = useCallback(() => {
    if (!generatedImage) return

    const link = document.createElement("a")
    link.href = generatedImage
    link.download = "generated-image.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [generatedImage])

  // Color palette
  const colors = [
    "#FFFFFF",
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#ff9900",
    "#9900ff",
  ]

  // Helper function to open an image in fullscreen
  const openFullscreen = useCallback((imageSrc: string | undefined) => {
    if (!imageSrc) return;

    const img = new Image();
    img.src = imageSrc;
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.margin = 'auto';
    img.style.objectFit = 'contain';

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.zIndex = '9999';

    // Close when clicking anywhere
    container.addEventListener('click', () => {
      document.body.removeChild(container);
    });

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '20px';
    closeButton.style.right = '20px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '30px';
    closeButton.style.cursor = 'pointer';

    container.appendChild(img);
    container.appendChild(closeButton);
    document.body.appendChild(container);
  }, []);

  return (
    <div
      className="flex h-screen bg-zinc-50 dark:bg-zinc-950"

    >
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "w-64" : "w-0 -ml-64"}
        transition-all duration-300 ease-in-out bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col z-10 relative ${isMobile ? "fixed inset-y-0 left-0" : ""}`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            SketchVision
          </h1>
          <button
            className="p-2 rounded-md text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="px-2 pt-2">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              className={`flex-1 py-2 px-3 text-sm text-white font-medium ${activeTab === "draw" ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-400"}`}
              onClick={() => setActiveTab("draw")}
            >
              Draw
            </button>
            <button
              className={`flex-1 py-2 px-3 text-sm text-white font-medium ${activeTab === "layers" ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-400"}`}
              onClick={() => setActiveTab("layers")}
            >
              Layers
            </button>
            <button
              className={`flex-1 py-2 px-3 text-sm text-white font-medium ${activeTab === "settings" ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-400"}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
          </div>
              </div>

        <div className="flex-1 p-4 overflow-auto">
          {activeTab === "draw" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Tools</h3>
                <div className="grid grid-cols-4 gap-2">
                <button
                    className={`border cursor-pointer rounded-md p-2 text-white flex items-center justify-center ${!isEraserActive ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" : "border-zinc-200 dark:border-zinc-800"}`}
                  onClick={() => setIsEraserActive(false)}
                  aria-label="Brush tool"
                >
                    <Brush className={`h-4 w-4 ${!isEraserActive ? "text-purple-600 dark:text-purple-400" : ""}`} />
                </button>
                <button
                    className={`border cursor-pointer rounded-md p-2 text-white flex items-center justify-center ${isEraserActive ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" : "border-zinc-200 dark:border-zinc-800"}`}
                  onClick={() => setIsEraserActive(true)}
                  aria-label="Eraser tool"
                  >
                    <Eraser className={`h-4 w-4 ${isEraserActive ? "text-purple-600 dark:text-purple-400" : ""}`} />
                  </button>
                  <button
                    className="border cursor-pointer rounded-md p-2 text-white flex items-center justify-center border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Placeholder for undo functionality
                      // In a real implementation, you would use a history stack
                      alert("Undo functionality would be implemented here")
                    }}
                    aria-label="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    className="border cursor-pointer rounded-md p-2 text-white flex items-center justify-center border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Placeholder for redo functionality
                      // In a real implementation, you would use a history stack
                      alert("Redo functionality would be implemented here")
                    }}
                    aria-label="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                </button>
              </div>
            </div>

              <div className="space-y-2">
              <div className="flex items-center justify-between">
                  <h3 className="text-sm text-white font-medium">Brush Size</h3>
                  <span className="text-xs text-zinc-500">{brushSize[0]}px</span>
              </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize[0]}
                  onChange={(e) => setBrushSize([Number.parseInt(e.target.value)])}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-purple-600"
                />
            </div>

              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Colors</h3>
              <div className="grid grid-cols-5 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                      className={`w-full aspect-square rounded-md border ${brushColor === color ? "ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-zinc-900" : "border-zinc-200 dark:border-zinc-800"}`}
                    style={{
                      backgroundColor: color,
                        boxShadow: color === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : "none",
                    }}
                    onClick={() => setBrushColor(color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Custom Color</h3>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-10 h-10 rounded-md border border-zinc-200 dark:border-zinc-800"
                  style={{
                    backgroundColor: brushColor,
                      boxShadow: brushColor === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : "none",
                  }}
                />
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-full h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Annotations</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={currentAnnotation}
                    onChange={(e) => setCurrentAnnotation(e.target.value)}
                    placeholder="Type annotation text..."
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-white"
                  />
                  <div className="text-xs text-zinc-500">Click on canvas to place annotation</div>
              </div>
            </div>

              {/* Prompt input for AI generation */}
              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Generation Prompt</h3>
                <div className="space-y-2">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Add optional prompt to guide AI generation..."
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-white min-h-[80px] resize-none"
                    aria-label="AI generation prompt"
                  />
                  <div className="text-xs text-zinc-500">
                    Describe what you want the AI to create based on your sketch
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "layers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-white font-medium">Layers</h3>
                <button
                  className="text-sm text-white text-purple-600 dark:text-purple-400 flex items-center hover:underline"
                  onClick={() => {
                    // Placeholder for add layer functionality
                    alert("Add layer functionality would be implemented here")
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Layer
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                  <div className="flex items-center">
                    <Layers className="h-4 w-4 mr-2 text-zinc-500" />
                    <span className="text-sm text-white">Background</span>
                  </div>
                  <button
                    className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() => {
                      // Placeholder for layer options
                      alert("Layer options would be shown here")
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
                </div>

                <div className="flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                  <div className="flex items-center">
                    <Layers className="h-4 w-4 mr-2 text-zinc-500" />
                    <span className="text-sm text-white">Sketch</span>
                  </div>
                <button
                    className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() => {
                      // Placeholder for layer options
                      alert("Layer options would be shown here")
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Canvas Settings</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Set canvas size to 512x512
                      const canvas = canvasRef.current
                      if (!canvas) return

                      // Save current drawing
                      const tempCanvas = document.createElement("canvas")
                      const tempCtx = tempCanvas.getContext("2d")
                      tempCanvas.width = canvas.width
                      tempCanvas.height = canvas.height
                      tempCtx?.drawImage(canvas, 0, 0)

                      // Resize canvas
                      canvas.width = 512
                      canvas.height = 512

                      // Clear and redraw
                      const ctx = canvas.getContext("2d")
                      if (!ctx) return
                      ctx.fillStyle = "#ffffff"
                      ctx.fillRect(0, 0, canvas.width, canvas.height)
                      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
                    }}
                  >
                    512 x 512
                  </button>
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Set canvas size to 1024x1024
                      const canvas = canvasRef.current
                      if (!canvas) return

                      // Save current drawing
                      const tempCanvas = document.createElement("canvas")
                      const tempCtx = tempCanvas.getContext("2d")
                      tempCanvas.width = canvas.width
                      tempCanvas.height = canvas.height
                      tempCtx?.drawImage(canvas, 0, 0)

                      // Resize canvas
                      canvas.width = 1024
                      canvas.height = 1024

                      // Clear and redraw
                      const ctx = canvas.getContext("2d")
                      if (!ctx) return
                      ctx.fillStyle = "#ffffff"
                      ctx.fillRect(0, 0, canvas.width, canvas.height)
                      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
                    }}
                  >
                    1024 x 1024
                  </button>
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Prompt for custom size
                      const width = prompt("Enter width (px):", "512")
                      const height = prompt("Enter height (px):", "512")

                      if (!width || !height) return

                      const canvas = canvasRef.current
                      if (!canvas) return

                      // Save current drawing
                      const tempCanvas = document.createElement("canvas")
                      const tempCtx = tempCanvas.getContext("2d")
                      tempCanvas.width = canvas.width
                      tempCanvas.height = canvas.height
                      tempCtx?.drawImage(canvas, 0, 0)

                      // Resize canvas
                      canvas.width = Number.parseInt(width)
                      canvas.height = Number.parseInt(height)

                      // Clear and redraw
                      const ctx = canvas.getContext("2d")
                      if (!ctx) return
                      ctx.fillStyle = "#ffffff"
                      ctx.fillRect(0, 0, canvas.width, canvas.height)
                      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
                    }}
                  >
                    Custom Size
                  </button>
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={clearCanvas}
                >
                    Reset
                </button>
              </div>
            </div>

              <div className="space-y-2">
                <h3 className="text-sm text-white font-medium">Generation Settings</h3>
                <div className="space-y-2">
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md w-full flex items-center hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Placeholder for advanced options
                      alert("Advanced generation options would be shown here")
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Options
                  </button>
                  <button
                    className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md w-full flex items-center hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      // Placeholder for save preset
                      alert("Save preset functionality would be implemented here")
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center justify-center shadow-sm transition-colors disabled:opacity-70 disabled:hover:bg-purple-600"
              onClick={() => void handleSave()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
              <Sparkles className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </button>
          </div>
        </div>

    {/* Main Content */}
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/30 dark:bg-zinc-900/30 backdrop-blur-sm">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
        {!sidebarOpen && (
          <button
            className="p-1.5 rounded-md text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className={`flex items-center space-x-2 ${!sidebarOpen ? "" : "ml-auto"}`}>
          <button
            className="py-1.5 px-3 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center"
            onClick={clearCanvas}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear Canvas
          </button>

          <button
            className="py-1.5 px-3 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center"
            onClick={() => {
              const canvas = canvasRef.current
              if (!canvas) return

              const link = document.createElement("a")
              link.href = canvas.toDataURL("image/png")
              link.download = "sketch.png"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </button>
            </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-6 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center">
      <div className="relative bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Grid background for transparency */}
              <div className="absolute inset-0 bg-[conic-gradient(#f0f0f0_90deg,_#ffffff_90deg_180deg,_#f0f0f0_180deg_270deg,_#ffffff_270deg)] bg-[length:20px_20px] opacity-50 dark:bg-[conic-gradient(#333333_90deg,_#2a2a2a_90deg_180deg,_#333333_180deg_270deg,_#2a2a2a_270deg)]"></div>

              <canvas
                ref={canvasRef}
                width={512}
                height={512}
                className="touch-none relative z-10"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onClick={addAnnotation}
                onTouchStart={(e) => {
                  // Touch event handling for mobile
            e.preventDefault()
            const touch = e.touches[0]
            const mouseEvent = new MouseEvent("mousedown", {
                    clientX: touch.clientX,
              clientY: touch.clientY,
            })
            e.target.dispatchEvent(mouseEvent)
                }}
                onTouchMove={(e) => {
                  // Touch move handling
            e.preventDefault()
            const touch = e.touches[0]
            const mouseEvent = new MouseEvent("mousemove", {
                    clientX: touch.clientX,
              clientY: touch.clientY,
            })
            e.target.dispatchEvent(mouseEvent)
                }}
                onTouchEnd={() => {
                  // Touch end handling
            const mouseEvent = new MouseEvent("mouseup")
            canvasRef.current?.dispatchEvent(mouseEvent)
                }}
              />

        {/* Annotations */}
              {annotations.map((ann, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: ann.x,
                    top: ann.y,
                    transform: "translate(-50%, -50%)",
              zIndex: 20,
                  }}
            className="px-2 py-1 rounded-md bg-purple-100 border border-purple-300 shadow-sm text-sm text-white dark:bg-purple-900/50 dark:border-purple-800 dark:text-purple-100 max-w-[150px] break-words"
                >
                  {ann.text}
                </div>
              ))}

        {/* Canvas cursor indicator */}
              {isDrawing && (
                <div
                  style={{
                    position: "absolute",
                    left: lastX,
                    top: lastY,
                    width: `${isEraserActive ? brushSize[0] * 2 : brushSize[0]}px`,
                    height: `${isEraserActive ? brushSize[0] * 2 : brushSize[0]}px`,
              backgroundColor: isEraserActive ? "rgba(255,255,255,0.5)" : brushColor,
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 30,
            }}
            aria-hidden="true"
          />
        )}
        </div>
      </div>

    {/* Gallery toggle button */}
    {(sketches && sketches.length > 0) || canvasRef.current ? (
      <button
        className="absolute bottom-0 right-0 z-20 m-4 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-colors"
        onClick={() => {
          setShowGallery(prev => !prev);
          // Also save the preference
          saveDataToLocalStorage();
        }}
        aria-label={showGallery ? "Hide gallery" : "Show gallery"}
      >
        {showGallery ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>
    ) : null}

    {/* Gallery panel - conditionally shown */}
    {(generatedImage || (sketches && sketches.length > 0)) && showGallery && (
      <div
        className={`h-64 border-t border-zinc-200 dark:border-zinc-800 p-4 transition-transform duration-300 ease-in-out
        absolute bottom-0 left-0 w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm z-10`}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm text-purple-600 font-medium">Gallery</h2>
          <div className="flex items-center gap-1">
            {generatedImage && (
              <>
                <button
                  className="p-1.5 rounded-md text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={downloadImage}
                  aria-label="Download generated image"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  className="p-1.5 rounded-md text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => openFullscreen(generatedImage)}
                  aria-label="View fullscreen"
                >
                  <Maximize className="h-4 w-4" />
                </button>
                {currentSketchId && (
                  <button
                    className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 dark:text-red-400 transition-colors"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this image?")) {
                        void (async () => {
                          try {
                            await deleteSketch({ sketchId: currentSketchId });
                            setGeneratedImage(null);
                            setCurrentSketchId(null);
                          } catch (error) {
                            console.error("Failed to delete sketch:", error);
                            alert("Error deleting image. Please try again.");
                          }
                        })();
                      }
                    }}
                    aria-label="Delete image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex space-x-4">
          {/* Current generated image */}
          <div className="h-48 w-48 bg-white rounded-md overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800">
            {generatedImage ? (
              <img
                src={generatedImage}
                alt="Generated image"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center px-4">
                  Generate an image to see the result here
                </p>
              </div>
            )}
          </div>

          {/* Current sketch image */}
          <div className="h-48 w-48 bg-white rounded-md overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800">
            <div className="relative w-full h-full">
              {canvasRef.current ? (
                <img
                  src={canvasRef.current.toDataURL()}
                  alt="Current sketch"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center px-4">
                    Draw something on the canvas
                  </p>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
                <span className="text-xs">Your Sketch</span>
              </div>
            </div>
          </div>

          {/* Previous AI generations */}
          <div className="flex-1">
            <h3 className="text-sm text-purple-400 font-medium mb-2">Previous Generations</h3>
            <div className="h-44 overflow-auto">
              <div className="grid grid-cols-3 gap-2">
                {sketches
                  .filter(sketch => sketch.generatedImage && sketch._id !== currentSketchId)
                  .slice(0, 9)
                  .map((sketch) => (
                    <div key={sketch._id} className="relative group">
                      <img
                        src={sketch.generatedImage || "/placeholder.svg"}
                        alt="Previous AI generation"
                        className="w-full aspect-square object-cover rounded-md border border-zinc-200 dark:border-zinc-800"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-md">
                        <button
                          className="p-1 rounded-md text-white hover:bg-white/20"
                          onClick={() => {
                            if (sketch.generatedImage) {
                              setGeneratedImage(sketch.generatedImage);
                            }
                          }}
                          aria-label="View generated image"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded-md text-white hover:bg-white/20"
                          onClick={() => openFullscreen(sketch.generatedImage)}
                          aria-label="View fullscreen"
                        >
                          <Maximize className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 rounded-md text-white hover:bg-red-500/50"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this image?")) {
                              void (async () => {
                                try {
                                  await deleteSketch({
                                    // ID is properly typed here as it comes directly from the sketches query
                                    sketchId: sketch._id
                                  });

                                  // If this was the currently displayed image, clear it
                                  if (generatedImage === sketch.generatedImage) {
                                    setGeneratedImage(null);
                                    setCurrentSketchId(null);
                                  }
                                } catch (error) {
                                  console.error("Failed to delete sketch:", error);
                                  alert("Error deleting image. Please try again.");
                                }
                              })();
                            }
                          }}
                          aria-label="Delete image"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* Help Dialog */}
  {showHelpDialog && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-medium text-lg">Quick Start Guide</h2>
        <button
            onClick={() => setShowHelpDialog(false)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
            <X className="h-5 w-5" />
        </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-white text-zinc-500 dark:text-zinc-400 mb-4">
            Draw on the canvas using the brush tool. Adjust brush size and color from the sidebar. When ready, click
            "Generate Image" to create an AI-generated version of your sketch.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Drawing Tools</h3>
              <p className="text-sm text-white text-zinc-500 dark:text-zinc-400">
                Use the brush tool to draw on the canvas. Adjust the size and color using the controls in the
                sidebar.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Annotations</h3>
              <p className="text-sm text-white text-zinc-500 dark:text-zinc-400">
                Add text annotations to provide additional context for the image generation AI.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Keyboard Shortcuts</h3>
              <div className="space-y-1.5 text-sm text-white">
                <div className="flex items-center justify-between">
                  <span>Undo</span>
                  <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">Ctrl+Z</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redo</span>
                  <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">Ctrl+Y</span>
                  </div>
                <div className="flex items-center justify-between">
                  <span>Clear Canvas</span>
                  <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">Delete</span>
                </div>
              </div>
            </div>
              </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
        <button
              className="p-2 text-sm text-white border border-zinc-200 dark:border-zinc-800 rounded-md"
              onClick={() => setShowHelpDialog(false)}
        >
              Close
        </button>
        <button
              className="p-2 text-sm text-white bg-purple-600 text-white rounded-md"
              onClick={() => setShowHelpDialog(false)}
        >
              Start Drawing
        </button>
            </div>
        </div>
      </div>
    </div>
  )}

  {/* Mobile-specific floating action button */}
      {isMobile && (
    <>
            <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-20 right-4 p-3 bg-purple-600 text-white rounded-full shadow-lg z-40"
        aria-label="Open tools"
      >
        <Menu className="h-6 w-6" />
            </button>

            <button
        onClick={() => setShowHelpDialog(true)}
        className="fixed bottom-4 right-4 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-lg z-40"
        aria-label="Help"
      >
        <HelpCircle className="h-6 w-6" />
            </button>

      {/* Mobile annotation input */}
              <div>
                <input
          type="text"
          value={currentAnnotation}
          onChange={(e) => setCurrentAnnotation(e.target.value)}
          placeholder="Add annotation text..."
          className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-white"
          aria-label="Annotation text"
        />
        <div className="mt-1 text-xs text-zinc-500">
          Click on canvas to place
              </div>
            </div>

        {/* Mobile prompt input */}
        <div className="mt-4">
          <div className="mb-1 text-sm text-white font-medium">Generation Prompt</div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Add optional prompt to guide AI generation..."
            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm h-20 resize-none"
            aria-label="AI generation prompt"
          />
          <div className="text-xs text-zinc-500 mt-1">
            Describe what you want the AI to create based on your sketch
          </div>
        </div>
      </>
      )}
    </div>
)
}
