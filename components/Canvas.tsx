
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from './Icon';
import { Translations, Language, Theme } from '../types';
import { GoogleGenAI } from "@google/genai";

interface CanvasProps {
  t: Translations;
  lang: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onSetTheme: (t: Theme) => void;
}

interface AttachedImage {
  data: string; // Base64 full string (data:image/...)
  mimeType: string;
}

interface Node {
  id: string;
  type: 'prompt' | 'image';
  x: number;
  y: number;
  content?: string;
  inputImages?: AttachedImage[]; // Store input images for prompt nodes
  imageData?: string; // Base64 output image
  status?: 'loading' | 'done' | 'error';
  errorMsg?: string;
  parentId?: string;
  quality?: string;
  modelType?: 'standard' | 'pro';
  aspectRatio?: string;
  isEditing?: boolean; // For inline editing of prompt nodes
}

// Available Options
const COUNT_OPTIONS = [1, 2, 4, 6, 8, 10];
const QUALITY_OPTIONS = ['1K', '2K', '4K'];
const ASPECT_RATIOS = [
  { value: '1:1', labelKey: 'ratioSquare', icon: 'square' },
  { value: '9:16', labelKey: 'ratioTall', icon: 'crop_portrait' },
  { value: '16:9', labelKey: 'ratioWide', icon: 'crop_landscape' },
  { value: '3:4', labelKey: 'ratioPortrait', icon: 'crop_5_4' },
  { value: '4:3', labelKey: 'ratioLandscape', icon: 'crop_7_5' },
];

export const Canvas: React.FC<CanvasProps> = ({ t, lang, onToggleLanguage, theme, onSetTheme }) => {
  // -- State --
  const [nodes, setNodes] = useState<Node[]>([]);
  const [prompt, setPrompt] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);
  
  // Generation Options
  const [selectedCount, setSelectedCount] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('1K');
  const [selectedModel, setSelectedModel] = useState<'standard' | 'pro'>('pro');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('9:16');
  const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);

  // Lightbox State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Canvas View State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDragOverInput, setIsDragOverInput] = useState(false);

  // -- Refs --
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialNodePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // -- File Handling Helpers --
  const processFiles = async (files: File[]) => {
    const newImages: AttachedImage[] = [];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    if (attachedImages.length + imageFiles.length > 12) {
      alert(t.maxImagesReached);
      return;
    }

    for (const file of imageFiles) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({
        data: base64,
        mimeType: file.type
      });
    }
    setAttachedImages(prev => [...prev, ...newImages]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverInput(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverInput(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverInput(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeAttachedImage = (index: number) => {
    const newImages = attachedImages.filter((_, i) => i !== index);
    setAttachedImages(newImages);
  };

  // -- Actions --

  const deleteNode = (nodeId: string) => {
    setNodes(prev => {
      // If deleting a prompt, also delete its children images
      const nodeToDelete = prev.find(n => n.id === nodeId);
      if (nodeToDelete?.type === 'prompt') {
        return prev.filter(n => n.id !== nodeId && n.parentId !== nodeId);
      }
      return prev.filter(n => n.id !== nodeId);
    });
  };

  const handleApplyKey = () => {
    setIsKeySaved(true);
    setTimeout(() => {
      setIsKeySaved(false);
      setIsSettingsOpen(false);
    }, 1000);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -- Core Generation Logic --
  const triggerGeneration = (
    promptNode: Node, 
    count: number, 
    quality: string, 
    modelType: 'standard' | 'pro', 
    aspectRatio: string
  ) => {
    const gap = 400;
    const cols = Math.min(count, 3);
    const centerX = promptNode.x + 225;
    const centerY = promptNode.y + 400; // Gap between prompt and images
    const imageStartX = centerX - ((cols * gap) / 2) + (gap/2) - 192;

    const newNodes: Node[] = [];

    // Prompt content and images
    const currentPrompt = promptNode.content || "";
    const currentImages = promptNode.inputImages || [];

    for (let i = 0; i < count; i++) {
      const colIndex = i % 3;
      const rowIndex = Math.floor(i / 3);
      
      const imageId = `img-${Date.now()}-${i}`;
      const imageNode: Node = {
        id: imageId,
        type: 'image',
        x: imageStartX + (colIndex * gap),
        y: centerY + (rowIndex * gap) - 100,
        status: 'loading',
        parentId: promptNode.id,
        quality: quality,
        modelType: modelType,
        aspectRatio: aspectRatio
      };
      
      newNodes.push(imageNode);
      // Increased stagger to 2.5s to avoid rate limits
      setTimeout(() => generateImage(currentPrompt, currentImages, imageId, quality, modelType, aspectRatio), i * 2500);
    }
    
    setNodes(prev => [...prev, ...newNodes]);
    
    // Auto Pan to results
    const targetPanX = -centerX * scale + window.innerWidth / 2;
    const targetPanY = -(centerY - 200) * scale + window.innerHeight / 2;
    // Only pan if it's a main generation, maybe avoid jumping too much on small edits? 
    // Let's keep it to keep user oriented.
    setPan({ x: targetPanX, y: targetPanY });
  };

  // -- API Integration --
  const generateImage = async (
    promptText: string, 
    inputImages: AttachedImage[],
    nodeId: string, 
    quality: string, 
    modelType: 'standard' | 'pro', 
    aspectRatio: string,
    retryCount = 0
  ) => {
    try {
      const key = userApiKey || process.env.API_KEY;
      
      if (!key) {
        throw new Error("MISSING_KEY");
      }

      const ai = new GoogleGenAI({ apiKey: key });
      
      const isPro = modelType === 'pro';
      const modelId = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

      // Config depends on model
      const config: any = {
        imageConfig: {
          aspectRatio: aspectRatio,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      };

      if (isPro) {
        config.imageConfig.imageSize = quality;
      }

      const parts: any[] = [];
      
      inputImages.forEach(img => {
        const base64Data = img.data.split(',')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: img.mimeType
          }
        });
      });

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: parts,
        },
        config: config,
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error("Empty response from API");
      }

      if (['SAFETY', 'RECITATION', 'OTHER'].includes(candidate.finishReason || '')) {
         throw new Error(`Generation blocked by Safety Filters (${candidate.finishReason})`);
      }

      let base64Image = null;
      let textResponse = "";

      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break; 
          } else if (part.text) {
             textResponse += part.text;
          }
        }
      }

      if (!base64Image) {
        if (textResponse) {
          throw new Error(textResponse.trim());
        }
        throw new Error("No image data in response");
      }

      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { ...n, status: 'done', imageData: `data:image/png;base64,${base64Image}` } 
          : n
      ));

    } catch (error: any) {
      console.error("Generation failed", error);
      
      let friendlyError = t.errorGeneric;
      const originalMsg = error.message || error.toString();
      const msg = originalMsg.toLowerCase();

      if (msg.includes("missing_key")) {
        friendlyError = t.errorMissingKey;
      } else if (msg.includes("permission denied") || msg.includes("403")) {
        friendlyError = t.errorPermissionDenied;
      } else if (msg.includes("key not valid")) {
        friendlyError = t.errorInvalidKey;
      } else if (msg.includes("429") || msg.includes("quota")) {
        // Auto-retry logic for Rate Limits
        if (retryCount < 3) {
             const delay = 3000 * (retryCount + 1); // 3s, 6s, 9s
             console.log(`Rate limited (429). Retrying attempt ${retryCount + 1} in ${delay}ms...`);
             await new Promise(resolve => setTimeout(resolve, delay));
             return generateImage(promptText, inputImages, nodeId, quality, modelType, aspectRatio, retryCount + 1);
        }
        friendlyError = t.errorQuotaExceeded;
      } else if (msg.includes("500") || msg.includes("503")) {
        friendlyError = "Server Error (Google)";
      } else {
        friendlyError = originalMsg.length < 300 ? originalMsg : t.errorGeneric;
      }

      setNodes(prev => prev.map(n => 
        n.id === nodeId ? { ...n, status: 'error', errorMsg: friendlyError } : n
      ));
    }
  };

  // -- Button Handlers --

  const handleEditNode = (node: Node) => {
    if (!node.imageData) return;

    // Create new Prompt Node immediately below the source image
    const promptId = `prompt-${Date.now()}`;
    // Align centers: Source(384)/2 - Prompt(450)/2 = 192 - 225 = -33
    const startX = node.x - 33; 
    const startY = node.y + 400 + 50; 

    const newPromptNode: Node = {
      id: promptId,
      type: 'prompt',
      x: startX,
      y: startY,
      content: '', // Start empty for user input
      inputImages: [{
        data: node.imageData,
        mimeType: 'image/png'
      }],
      parentId: node.id,
      isEditing: true // Enable inline editing
    };

    setNodes(prev => [...prev, newPromptNode]);
    
    // Auto pan to the new node area
    const targetPanX = -startX * scale + window.innerWidth / 2 - 225 * scale;
    const targetPanY = -startY * scale + window.innerHeight / 2;
    setPan({ x: targetPanX, y: targetPanY });
  };

  const handleNodeSubmit = (nodeId: string, content: string) => {
    // 1. Update the node content and turn off edit mode
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content, isEditing: false } : n));
    
    // 2. Trigger generation
    const node = nodes.find(n => n.id === nodeId);
    // Use passed content because state might not be updated yet in this closure if we looked at 'nodes'
    // But we need the inputImages from the node which are stable
    const nodeToRun = { ...node!, content }; // ! safe because we just found it or created it
    
    triggerGeneration(nodeToRun, selectedCount, selectedQuality, selectedModel, selectedAspectRatio);
  };

  const handleRegenerate = (node: Node) => {
    if (!node.parentId) return;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return;
    
    // Update status to loading
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'loading', errorMsg: undefined, imageData: undefined } : n));

    // Call generate
    generateImage(
        parent.content || "", 
        parent.inputImages || [], 
        node.id, 
        node.quality || '1K', 
        node.modelType || 'pro', 
        node.aspectRatio || '9:16'
    );
  };

  const handleSubmit = () => {
    if (!prompt.trim() && attachedImages.length === 0) return;

    // Calculate layout position for new main prompt
    let startPromptX = 0;
    let startPromptY = 0;

    const existingPrompts = nodes.filter(n => n.type === 'prompt').sort((a, b) => a.x - b.x);
    
    if (existingPrompts.length === 0) {
      startPromptX = -pan.x / scale + (window.innerWidth / 2) / scale - 225;
      startPromptY = -pan.y / scale + (window.innerHeight / 2) / scale - 400;
    } else {
      const lastPrompt = existingPrompts[existingPrompts.length - 1];
      const children = nodes.filter(n => n.parentId === lastPrompt.id);
      
      let maxX = lastPrompt.x + 450; 
      children.forEach(child => {
        if (child.x + 384 > maxX) {
          maxX = child.x + 384;
        }
      });

      startPromptX = maxX + 400;
      startPromptY = lastPrompt.y;
    }

    const promptId = `prompt-${Date.now()}`;
    const promptNode: Node = {
      id: promptId,
      type: 'prompt',
      x: startPromptX, 
      y: startPromptY, 
      content: prompt,
      inputImages: [...attachedImages] 
    };

    setNodes(prev => [...prev, promptNode]);
    setPrompt("");
    setAttachedImages([]); 
    setIsRatioMenuOpen(false);

    triggerGeneration(promptNode, selectedCount, selectedQuality, selectedModel, selectedAspectRatio);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // -- Canvas Controls --
  const zoomIn = () => setScale(s => Math.min(s + 0.1, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.2));
  const fitView = () => { setPan({ x: 0, y: 0 }); setScale(1); };
  const clearCanvas = () => setNodes([]);
  const toggleCount = () => {
    const idx = COUNT_OPTIONS.indexOf(selectedCount);
    setSelectedCount(COUNT_OPTIONS[(idx + 1) % COUNT_OPTIONS.length]);
  };
  const toggleQuality = () => {
    const idx = QUALITY_OPTIONS.indexOf(selectedQuality);
    setSelectedQuality(QUALITY_OPTIONS[(idx + 1) % QUALITY_OPTIONS.length]);
  };

  // -- Mouse/Pointer Handling --
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.2, scale - e.deltaY * zoomSensitivity), 3);
      setScale(newScale);
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handlePointerDown = (e: React.PointerEvent, nodeId?: string) => {
    // If interacting with inputs, don't drag canvas
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
      return;
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    if (nodeId) {
      e.stopPropagation();
      setDraggedNodeId(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) initialNodePosRef.current = { x: node.x, y: node.y };
    } else {
      setIsDraggingCanvas(true);
      initialPanRef.current = { ...pan };
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (draggedNodeId) {
      setNodes((prev) => prev.map((n) => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: initialNodePosRef.current.x + dx / scale,
            y: initialNodePosRef.current.y + dy / scale,
          };
        }
        return n;
      }));
    } else if (isDraggingCanvas) {
      setPan({ x: initialPanRef.current.x + dx, y: initialPanRef.current.y + dy });
    }
  }, [draggedNodeId, isDraggingCanvas, scale]);

  const handlePointerUp = useCallback(() => {
    setDraggedNodeId(null);
    setIsDraggingCanvas(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <main 
      ref={containerRef}
      className="relative w-full h-full bg-app-bg overflow-hidden cursor-grab active:cursor-grabbing font-sans transition-colors duration-300"
      onPointerDown={(e) => handlePointerDown(e)}
      onWheel={handleWheel}
      dir="ltr"
    >
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileSelect}
      />

      {/* Background Dots */}
      <div 
        className="absolute inset-0 pointer-events-none dot-grid"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
        }}
      />

      {/* --- Top Left Toolbar --- */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center bg-panel-bg border border-border-app rounded-lg p-1 shadow-2xl">
           <ToolbarBtn icon="space_dashboard" />
           <ToolbarBtn icon="chat_bubble" active />
           <div className="w-px h-5 bg-border-app mx-1"></div>
           <button 
             onClick={onToggleLanguage}
             className="px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-main hover:bg-highlight rounded-md transition"
           >
             {lang === 'ar' ? 'EN' : 'AR'}
           </button>
           <div className="w-px h-5 bg-border-app mx-1"></div>
           
           {/* Theme Switcher */}
           <div className="flex gap-1 px-1">
             <button onClick={() => onSetTheme('dark-blue')} title="Dark Blue" className={`size-4 rounded-full bg-[#137fec] ring-2 transition ${theme === 'dark-blue' ? 'ring-white ring-offset-1 ring-offset-[#18181b]' : 'ring-transparent hover:scale-110'}`}></button>
             <button onClick={() => onSetTheme('white-apple')} title="White Apple" className={`size-4 rounded-full bg-[#e5e5e5] border border-gray-300 ring-2 transition ${theme === 'white-apple' ? 'ring-blue-500 ring-offset-1 ring-offset-white' : 'ring-transparent hover:scale-110'}`}></button>
             <button onClick={() => onSetTheme('orange')} title="Orange" className={`size-4 rounded-full bg-[#f97316] ring-2 transition ${theme === 'orange' ? 'ring-white ring-offset-1 ring-offset-[#292524]' : 'ring-transparent hover:scale-110'}`}></button>
           </div>
        </div>
        <div className="flex items-center justify-center size-10 rounded-full bg-primary text-white font-bold text-sm shadow-lg ring-2 ring-app-bg cursor-pointer hover:scale-105 transition">
          A
        </div>
      </div>

      {/* --- Bottom Left Toolbar --- */}
      <div className="absolute bottom-28 left-4 z-50 flex flex-col gap-2" onPointerDown={e => e.stopPropagation()}>
         <div className="flex flex-col bg-panel-bg border border-border-app rounded-xl p-1.5 shadow-2xl gap-1">
            <ToolbarBtn icon="add" onClick={zoomIn} title={t.zoomIn} />
            <ToolbarBtn icon="remove" onClick={zoomOut} title={t.zoomOut} />
            <div className="h-px w-full bg-border-app my-0.5"></div>
            <ToolbarBtn icon="center_focus_strong" onClick={fitView} title={t.fitView} />
            <ToolbarBtn icon="delete_sweep" onClick={clearCanvas} title={t.clearCanvas} />
         </div>
      </div>

      {/* --- Fixed Bottom Bar --- */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4" onPointerDown={e => e.stopPropagation()}>
        
        {/* Aspect Ratio Menu */}
        {isRatioMenuOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-panel-bg border border-border-app rounded-xl shadow-2xl overflow-hidden p-1 flex flex-col gap-0.5">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.value}
                onClick={() => { setSelectedAspectRatio(ratio.value); setIsRatioMenuOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition ${selectedAspectRatio === ratio.value ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-highlight'}`}
              >
                <Icon name={ratio.icon} className="text-sm" />
                <span className="flex-1 text-start">{t[ratio.labelKey as keyof Translations]}</span>
                {selectedAspectRatio === ratio.value && <Icon name="check" className="text-xs" />}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Container */}
        <div 
          className={`relative bg-panel-bg border rounded-2xl shadow-2xl p-2 flex flex-col gap-2 transition-all duration-200 ${isDragOverInput ? 'border-primary ring-2 ring-primary/30 scale-[1.02]' : 'border-border-app focus-within:ring-1 focus-within:ring-primary/50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
           {/* Drop Hint Overlay */}
           {isDragOverInput && (
              <div className="absolute inset-0 bg-panel-bg/90 rounded-2xl flex flex-col items-center justify-center z-20 backdrop-blur-sm pointer-events-none">
                <Icon name="cloud_upload" className="text-4xl text-primary animate-bounce mb-2" />
                <span className="text-primary font-bold text-sm">{t.dragDropHint}</span>
              </div>
           )}

           {/* Attached Images Preview */}
           {attachedImages.length > 0 && (
             <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar pb-3">
               {attachedImages.map((img, idx) => (
                 <div key={idx} className="relative size-16 shrink-0 group rounded-lg overflow-hidden border border-border-app bg-app-bg">
                   <img src={img.data} alt="attachment" className="w-full h-full object-cover" />
                   <button 
                     onClick={() => removeAttachedImage(idx)}
                     className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                   >
                     <Icon name="close" className="text-white text-lg" />
                   </button>
                 </div>
               ))}
             </div>
           )}

           {/* Input Area */}
           <div className="flex items-end gap-2 p-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-highlight text-text-muted hover:text-text-main transition"
                title={t.attachImage}
              >
                <Icon name="attach_file" className="rotate-45" />
              </button>

              <textarea 
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                placeholder={t.writePrompt}
                className="w-full bg-transparent border-none text-text-main placeholder-text-muted focus:ring-0 resize-none h-12 max-h-32 py-2 custom-scrollbar"
                style={{ minHeight: '48px' }}
              />
              <button 
                onClick={handleSubmit}
                disabled={!prompt.trim() && attachedImages.length === 0}
                className={`size-10 shrink-0 rounded-xl flex items-center justify-center transition ${(!prompt.trim() && attachedImages.length === 0) ? 'bg-highlight text-text-muted cursor-not-allowed' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
              >
                <Icon name="arrow_upward" />
              </button>
           </div>

           {/* Footer / Tools */}
           <div className="flex items-center justify-between px-2 pb-1 border-t border-border-app pt-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div 
                  className="flex items-center gap-2 bg-highlight hover:bg-highlight/80 px-3 py-1.5 rounded-lg cursor-pointer transition select-none shrink-0"
                  onClick={() => setIsSettingsOpen(true)}
                >
                   <Icon name="auto_awesome" className="text-yellow-500 text-sm" />
                   <span className="text-xs font-bold text-text-muted">
                     {selectedModel === 'standard' ? "Nano Banana" : "Nano Banana Pro 2"}
                   </span>
                </div>

                <div className="w-px h-6 bg-border-app mx-1 shrink-0"></div>

                <button 
                  onClick={() => setIsRatioMenuOpen(!isRatioMenuOpen)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${isRatioMenuOpen ? 'bg-primary/20 text-primary' : 'bg-highlight hover:bg-highlight/80 text-text-muted'}`}
                  title={t.aspectRatio}
                >
                  <Icon name="aspect_ratio" className="text-sm" />
                  <span>{selectedAspectRatio}</span>
                </button>

                <button 
                  onClick={toggleCount}
                  className="flex items-center gap-1.5 bg-highlight hover:bg-highlight/80 px-2 py-1.5 rounded-lg text-xs font-bold text-text-muted transition shrink-0"
                  title={t.imageCount}
                >
                  <Icon name="collections" className="text-sm text-text-muted" />
                  <span>{selectedCount} {t.images}</span>
                </button>

                {selectedModel === 'pro' && (
                  <button 
                    onClick={toggleQuality}
                    className="flex items-center gap-1.5 bg-highlight hover:bg-highlight/80 px-2 py-1.5 rounded-lg text-xs font-bold text-text-muted transition shrink-0"
                    title={t.quality}
                  >
                    <Icon name="hd" className="text-sm text-text-muted" />
                    <span>{selectedQuality}</span>
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 pl-2">
                 <button className="p-2 rounded-lg hover:bg-highlight text-text-muted hover:text-text-main transition" title={t.settings} onClick={() => setIsSettingsOpen(true)}>
                    <Icon name="settings" className="text-sm" />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* --- Settings Modal --- */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onPointerDown={e => e.stopPropagation()}>
           <div className="bg-panel-bg border border-border-app w-full max-w-md rounded-2xl shadow-2xl p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-text-main">{t.settings}</h2>
                 <button onClick={() => setIsSettingsOpen(false)} className="text-text-muted hover:text-text-main">
                    <Icon name="close" />
                 </button>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">{t.apiKey}</label>
                    <div className="flex gap-2">
                        <input 
                        type="password" 
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 bg-app-bg border border-border-app rounded-lg p-3 text-text-main focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-muted/50"
                        />
                        <button 
                          onClick={handleApplyKey}
                          className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isKeySaved ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
                        >
                          {isKeySaved ? t.saved : t.apply}
                        </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">{t.apiKeyDesc}</p>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">{t.model}</label>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setSelectedModel('standard')}
                        className={`w-full text-start p-3 rounded-lg border flex items-center justify-between transition ${selectedModel === 'standard' ? 'bg-primary/10 border-primary text-primary' : 'bg-app-bg border-border-app text-text-muted hover:border-text-muted'}`}
                      >
                         <span className="font-bold text-sm">{t.modelStandard}</span>
                         {selectedModel === 'standard' && <Icon name="check_circle" className="text-sm" />}
                      </button>
                      <button 
                        onClick={() => setSelectedModel('pro')}
                        className={`w-full text-start p-3 rounded-lg border flex items-center justify-between transition ${selectedModel === 'pro' ? 'bg-primary/10 border-primary text-primary' : 'bg-app-bg border-border-app text-text-muted hover:border-text-muted'}`}
                      >
                         <span className="font-bold text-sm">{t.modelPro}</span>
                         {selectedModel === 'pro' && <Icon name="check_circle" className="text-sm" />}
                      </button>
                    </div>
                 </div>
              </div>

              <div className="mt-8 flex justify-end">
                 <button 
                   onClick={() => setIsSettingsOpen(false)}
                   className="bg-highlight hover:bg-highlight/80 text-text-main px-6 py-2 rounded-lg font-medium transition"
                 >
                   {t.close}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- Lightbox Overlay --- */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={previewImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-in-95 animate-in duration-300"
            onClick={(e) => e.stopPropagation()} 
          />
          <button 
            className="absolute top-4 right-4 text-white/50 hover:text-white"
            onClick={() => setPreviewImage(null)}
          >
            <Icon name="close" className="text-3xl" />
          </button>
        </div>
      )}

      {/* --- Canvas Nodes --- */}
      <div 
        className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
      >
        <svg className="absolute overflow-visible pointer-events-none z-0">
          {nodes.map(node => {
            if (!node.parentId) return null;
            const parent = nodes.find(n => n.id === node.parentId);
            if (!parent) return null;

            // Logic to draw lines based on node types
            let startX, startY, endX, endY;

            if (parent.type === 'image' && node.type === 'prompt') {
               // EDIT FLOW: Image (Top) -> Prompt (Bottom)
               startX = parent.x + 192; // Image Width 384 / 2
               startY = parent.y + 384; // Image Height 384
               endX = node.x + 225; // Prompt Width 450 / 2
               endY = node.y;
            } else {
               // STANDARD FLOW: Prompt (Top) -> Image (Bottom)
               startX = parent.x + 225; 
               const hasImages = parent.inputImages && parent.inputImages.length > 0;
               const promptHeight = hasImages ? 250 : 120;
               startY = parent.y + promptHeight; 
               endX = node.x + 192; 
               endY = node.y;
            }

            return (
              <path 
                key={`link-${node.id}`}
                d={`M ${startX} ${startY} C ${startX} ${startY + 100}, ${endX} ${endY - 100}, ${endX} ${endY}`}
                fill="none" 
                stroke={theme === 'white-apple' ? '#cbd5e1' : '#52525b'} 
                strokeWidth="2" 
                strokeDasharray="4,4"
              />
            );
          })}
        </svg>

        {nodes.map(node => (
          <div 
            key={node.id}
            className="absolute z-10"
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            onPointerDown={(e) => handlePointerDown(e, node.id)}
          >
             <NodeItem 
               node={node} 
               t={t} 
               lang={lang} 
               theme={theme}
               onDelete={() => deleteNode(node.id)} 
               onDoubleClick={() => node.imageData && setPreviewImage(node.imageData)}
               onDownload={() => node.imageData && downloadImage(node.imageData, `nano-banana-${node.id}.png`)}
               onImageClick={(src) => setPreviewImage(src)}
               onEdit={() => handleEditNode(node)}
               onSubmit={(content) => handleNodeSubmit(node.id, content)}
               onRegenerate={() => handleRegenerate(node)}
             />
          </div>
        ))}
      </div>
    </main>
  );
};

// --- Sub Components ---

const ToolbarBtn: React.FC<{ icon: string; active?: boolean; title?: string; onClick?: () => void }> = ({ icon, active, title, onClick }) => (
  <button 
    onClick={onClick}
    title={title}
    className={`size-9 flex items-center justify-center rounded-lg transition ${active ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main hover:bg-highlight'}`}
  >
    <Icon name={icon} className="text-[20px]" />
  </button>
);

const NodeItem: React.FC<{ 
  node: Node; 
  t: Translations; 
  lang: Language; 
  theme: Theme;
  onDelete: () => void; 
  onDoubleClick?: () => void;
  onDownload?: () => void;
  onImageClick?: (src: string) => void;
  onEdit?: () => void;
  onSubmit?: (content: string) => void;
  onRegenerate?: () => void;
}> = ({ node, t, lang, theme, onDelete, onDoubleClick, onDownload, onImageClick, onEdit, onSubmit, onRegenerate }) => {
  // Local state for inline editing
  const [localContent, setLocalContent] = useState(node.content || "");

  if (node.type === 'prompt') {
    return (
      <div className="w-[450px] relative group">
        <div className={`backdrop-blur-md border rounded-[2rem] p-6 shadow-2xl transition-all ${theme === 'white-apple' ? 'bg-white/80 border-gray-200' : 'bg-panel-bg/90 border-primary/20'} ${node.isEditing ? 'border-primary ring-1 ring-primary' : 'hover:border-primary'}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-teal-600 flex items-center justify-center text-[10px] text-white font-bold">A</div>
                <span className="text-xs font-bold text-text-muted">User</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded-full"
                title={t.delete}
              >
                <Icon name="delete" className="text-sm text-red-400" />
              </button>
           </div>
           
           {/* Display Attached Images in the Node */}
           {node.inputImages && node.inputImages.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-3">
               {node.inputImages.map((img, idx) => (
                 <img 
                   key={idx} 
                   src={img.data} 
                   alt="input" 
                   className="size-20 rounded-lg object-cover border border-border-app cursor-pointer hover:border-primary"
                   onClick={(e) => { e.stopPropagation(); onImageClick?.(img.data); }}
                 />
               ))}
             </div>
           )}

           {node.isEditing ? (
             <div className="flex flex-col gap-2">
               <textarea
                 value={localContent}
                 onChange={(e) => setLocalContent(e.target.value)}
                 className="w-full bg-app-bg border border-border-app rounded-lg p-2 text-text-main text-lg focus:outline-none focus:border-primary resize-none h-24"
                 placeholder={t.writePrompt}
                 autoFocus
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     onSubmit?.(localContent);
                   }
                 }}
               />
               <div className="flex justify-end">
                 <button 
                   onClick={(e) => { e.stopPropagation(); onSubmit?.(localContent); }}
                   className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-primary/90 transition flex items-center gap-2"
                 >
                   <Icon name="play_arrow" className="text-sm" />
                   {t.run}
                 </button>
               </div>
             </div>
           ) : (
             <p className="text-lg text-text-main font-medium whitespace-pre-wrap" dir="auto">{node.content}</p>
           )}
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50"></div>
      </div>
    );
  }

  if (node.type === 'image') {
    return (
      <div 
        className={`size-96 bg-panel-bg rounded-[2rem] border shadow-2xl overflow-hidden relative group transition-colors ${node.status === 'error' ? 'border-red-500/50' : 'border-border-app hover:border-primary/50'}`}
        onDoubleClick={onDoubleClick}
      >
         {node.status === 'loading' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="size-12 rounded-full border-4 border-border-app border-t-primary animate-spin"></div>
              <span className="text-text-muted text-sm animate-pulse">{t.generating}</span>
           </div>
         )}
         
         {node.status === 'done' && node.imageData && (
           <img src={node.imageData} alt="Generated" className="w-full h-full object-cover" />
         )}

         {node.status === 'error' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 p-4 text-center bg-red-500/5 overflow-y-auto custom-scrollbar">
             <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Icon name="error" className="text-2xl" />
             </div>
             <div>
               <p className="text-sm font-bold">{t.errorGeneric}</p>
               <p className="text-xs text-red-300 mt-1 leading-relaxed whitespace-pre-wrap px-2">{node.errorMsg}</p>
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }}
                className="mt-2 flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition border border-red-500/20"
             >
                <Icon name="refresh" className="text-sm" />
                {t.retry}
             </button>
           </div>
         )}

         {/* Footer Info Badge */}
         <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 pointer-events-none">
            <Icon name="auto_awesome" className="text-yellow-500 text-xs" />
            <span className="text-[10px] text-white font-bold">
              {node.modelType === 'standard' ? "Nano Banana" : "Nano Banana Pro 2"}
            </span>
            {node.aspectRatio && <span className="text-[10px] text-slate-300 border-l border-white/20 pl-2 ml-1">{node.aspectRatio}</span>}
            {node.quality && <span className="text-[10px] text-slate-400 border-l border-white/20 pl-2 ml-1">{node.quality}</span>}
         </div>
         
         {/* Top Actions */}
         <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" 
              title={t.regenerate}
              onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }}
            >
               <Icon name="refresh" className="text-sm" />
            </button>
            <button 
              className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" 
              title={t.editImage}
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            >
               <Icon name="edit" className="text-sm" />
            </button>
            <button 
              className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" 
              title="Fullscreen"
              onClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
            >
               <Icon name="fullscreen" className="text-sm" />
            </button>
            <button 
              className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" 
              title="Download"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.();
              }}
            >
               <Icon name="download" className="text-sm" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="size-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center backdrop-blur-md border border-red-500/30 hover:scale-105 transition" 
              title={t.delete}
            >
               <Icon name="delete" className="text-sm" />
            </button>
         </div>
      </div>
    );
  }
  return null;
};
