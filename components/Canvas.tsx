
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
  type: 'prompt' | 'image' | 'text';
  x: number;
  y: number;
  content?: string;
  inputImages?: AttachedImage[]; // Store input images for prompt nodes
  imageData?: string; // Base64 output image
  status?: 'loading' | 'done' | 'error';
  errorMsg?: string;
  parentId?: string; // Legacy support
  parentIds?: string[]; // Support multiple parents
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

type AppMode = 'image' | 'chat';

export const Canvas: React.FC<CanvasProps> = ({ t, lang, onToggleLanguage, theme, onSetTheme }) => {
  // -- State --
  const [nodes, setNodes] = useState<Node[]>([]);
  const [prompt, setPrompt] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);
  
  // App Mode (Image vs Chat)
  const [activeMode, setActiveMode] = useState<AppMode>('image');

  // Selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Generation Options
  const [selectedCount, setSelectedCount] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('1K');
  const [selectedModel, setSelectedModel] = useState<'standard' | 'pro'>('pro'); // Shared state, logic changes based on mode
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

  // -- Helpers --
  // Calculate effective images (Uploaded + Selected from Nodes)
  const getEffectiveImages = () => {
    const fromNodes: AttachedImage[] = [];
    selectedNodeIds.forEach(id => {
      const node = nodes.find(n => n.id === id);
      if (node && node.imageData) {
        fromNodes.push({
          data: node.imageData,
          mimeType: 'image/png'
        });
      }
    });
    return [...attachedImages, ...fromNodes];
  };

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
      // If deleting a prompt, also delete its children (images or text)
      const nodeToDelete = prev.find(n => n.id === nodeId);
      if (nodeToDelete?.type === 'prompt') {
        return prev.filter(n => n.id !== nodeId && n.parentId !== nodeId && (!n.parentIds || !n.parentIds.includes(nodeId)));
      }
      return prev.filter(n => n.id !== nodeId);
    });
    // Remove from selection if deleted
    if (selectedNodeIds.has(nodeId)) {
      const newSet = new Set(selectedNodeIds);
      newSet.delete(nodeId);
      setSelectedNodeIds(newSet);
    }
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

  // -- Logic: Image Generation --
  const triggerImageGeneration = (
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
        parentIds: [promptNode.id],
        quality: quality,
        modelType: modelType,
        aspectRatio: aspectRatio
      };
      
      newNodes.push(imageNode);
      // Stagger to avoid rate limits
      setTimeout(() => generateImage(currentPrompt, currentImages, imageId, quality, modelType, aspectRatio), i * 1500);
    }
    
    setNodes(prev => [...prev, ...newNodes]);
    
    const targetPanX = -centerX * scale + window.innerWidth / 2;
    const targetPanY = -(centerY - 200) * scale + window.innerHeight / 2;
    setPan({ x: targetPanX, y: targetPanY });
  };

  // -- Logic: Text Generation (Chat) --
  const triggerTextGeneration = (promptNode: Node, modelType: 'standard' | 'pro') => {
      const textId = `text-${Date.now()}`;
      const textNode: Node = {
          id: textId,
          type: 'text',
          x: promptNode.x,
          y: promptNode.y + 350, // Place text response below prompt
          status: 'loading',
          parentId: promptNode.id,
          parentIds: [promptNode.id],
          modelType: modelType,
          content: ''
      };

      setNodes(prev => [...prev, textNode]);
      
      const targetPanX = -(promptNode.x + 225) * scale + window.innerWidth / 2;
      const targetPanY = -(promptNode.y + 100) * scale + window.innerHeight / 2;
      setPan({ x: targetPanX, y: targetPanY });

      generateText(promptNode.content || "", promptNode.inputImages || [], textId, modelType);
  };

  // -- API: Image --
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
      if (!key) throw new Error("MISSING_KEY");

      const ai = new GoogleGenAI({ apiKey: key });
      const isPro = modelType === 'pro';
      const modelId = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

      const config: any = {
        imageConfig: { aspectRatio: aspectRatio },
      };
      if (isPro) config.imageConfig.imageSize = quality;

      const parts: any[] = [];
      inputImages.forEach(img => {
        const base64Data = img.data.split(',')[1];
        parts.push({ inlineData: { data: base64Data, mimeType: img.mimeType } });
      });

      let finalPrompt = promptText.trim();
      if (!finalPrompt) finalPrompt = "Generate a high-quality creative image based on the provided visual inputs.";
      else finalPrompt = `Generate an image: ${finalPrompt}`;

      parts.push({ text: finalPrompt });

      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: parts },
        config: config,
      });

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error("Empty response from API");
      if (['SAFETY', 'RECITATION', 'OTHER'].includes(candidate.finishReason || '')) {
         throw new Error(`Blocked by Safety Filters (${candidate.finishReason})`);
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
        if (textResponse && textResponse.length < 150) throw new Error(textResponse.trim());
        throw new Error("No image data in response");
      }

      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { ...n, status: 'done', imageData: `data:image/png;base64,${base64Image}` } 
          : n
      ));

    } catch (error: any) {
      handleApiError(error, nodeId, () => generateImage(promptText, inputImages, nodeId, quality, modelType, aspectRatio, retryCount + 1), retryCount);
    }
  };

  // -- API: Text --
  const generateText = async (
      promptText: string,
      inputImages: AttachedImage[],
      nodeId: string,
      modelType: 'standard' | 'pro',
      retryCount = 0
  ) => {
      try {
          const key = userApiKey || process.env.API_KEY;
          if (!key) throw new Error("MISSING_KEY");

          const ai = new GoogleGenAI({ apiKey: key });
          const modelId = modelType === 'pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

          const parts: any[] = [];
          inputImages.forEach(img => {
              const base64Data = img.data.split(',')[1];
              parts.push({ inlineData: { data: base64Data, mimeType: img.mimeType } });
          });
          parts.push({ text: promptText });

          const response = await ai.models.generateContent({
              model: modelId,
              contents: { parts },
          });

          const text = response.text;
          if (!text) throw new Error("Empty text response");

          setNodes(prev => prev.map(n => 
              n.id === nodeId ? { ...n, status: 'done', content: text } : n
          ));

      } catch (error: any) {
          handleApiError(error, nodeId, () => generateText(promptText, inputImages, nodeId, modelType, retryCount + 1), retryCount);
      }
  };

  // Shared Error Handler
  const handleApiError = (error: any, nodeId: string, retryFn: () => void, retryCount: number) => {
      console.error("API failed", error);
      let friendlyError = t.errorGeneric;
      const originalMsg = error.message || error.toString();
      const msg = originalMsg.toLowerCase();

      if (msg.includes("missing_key")) friendlyError = t.errorMissingKey;
      else if (msg.includes("permission denied") || msg.includes("403")) friendlyError = t.errorPermissionDenied;
      else if (msg.includes("key not valid")) friendlyError = t.errorInvalidKey;
      else if (msg.includes("429") || msg.includes("quota")) {
        if (retryCount < 3) {
             const delay = 3000 * (retryCount + 1);
             setTimeout(retryFn, delay);
             return;
        }
        friendlyError = t.errorQuotaExceeded;
      } else if (msg.includes("500")) friendlyError = "Server Error (Google)";
      else friendlyError = originalMsg.length < 300 ? originalMsg : t.errorGeneric;

      setNodes(prev => prev.map(n => 
        n.id === nodeId ? { ...n, status: 'error', errorMsg: friendlyError } : n
      ));
  };


  // -- Button Handlers --

  const handleEditNode = (node: Node) => {
    // Allows branching from an image (Draw a new prompt connected to it)
    if (!node.imageData && node.type !== 'text') return;

    const promptId = `prompt-${Date.now()}`;
    const startX = node.x - 33; 
    const startY = node.y + (node.type === 'text' ? 250 : 450); 

    const newPromptNode: Node = {
      id: promptId,
      type: 'prompt',
      x: startX,
      y: startY,
      content: '', 
      inputImages: node.imageData ? [{ data: node.imageData, mimeType: 'image/png' }] : [],
      parentId: node.id,
      parentIds: [node.id],
      isEditing: true
    };

    setNodes(prev => [...prev, newPromptNode]);
    
    const targetPanX = -startX * scale + window.innerWidth / 2 - 225 * scale;
    const targetPanY = -startY * scale + window.innerHeight / 2;
    setPan({ x: targetPanX, y: targetPanY });
  };
  
  const handleRemixPrompt = (node: Node) => {
    const promptId = `prompt-${Date.now()}`;
    const startX = node.x + 40; 
    const startY = node.y + 40; 

    const newPromptNode: Node = {
      id: promptId,
      type: 'prompt',
      x: startX,
      y: startY,
      content: node.content, 
      inputImages: node.inputImages ? [...node.inputImages] : [],
      parentIds: node.parentIds ? [...node.parentIds] : (node.parentId ? [node.parentId] : undefined),
      parentId: node.parentId,
      isEditing: true
    };

    setNodes(prev => [...prev, newPromptNode]);
    setSelectedNodeIds(new Set([promptId]));
  };

  const handleNodeSubmit = (nodeId: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content, isEditing: false } : n));
    const node = nodes.find(n => n.id === nodeId);
    const nodeToRun = { ...node!, content }; 
    
    if (activeMode === 'image') {
        triggerImageGeneration(nodeToRun, selectedCount, selectedQuality, selectedModel, selectedAspectRatio);
    } else {
        triggerTextGeneration(nodeToRun, selectedModel);
    }
  };

  const handleRegenerate = (node: Node) => {
    const parentIds = node.parentIds || (node.parentId ? [node.parentId] : []);
    if (parentIds.length === 0) return;
    const parent = nodes.find(n => n.id === parentIds[0]);
    if (!parent) return;
    
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'loading', errorMsg: undefined, imageData: undefined, content: undefined } : n));

    if (node.type === 'image') {
        generateImage(parent.content || "", parent.inputImages || [], node.id, node.quality || '1K', node.modelType || 'pro', node.aspectRatio || '9:16');
    } else if (node.type === 'text') {
        generateText(parent.content || "", parent.inputImages || [], node.id, node.modelType || 'pro');
    }
  };

  const handleSubmit = () => {
    const effectiveImages = getEffectiveImages();
    if (!prompt.trim() && effectiveImages.length === 0) return;

    let startPromptX = 0;
    let startPromptY = 0;
    
    // Auto Layout Logic
    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
    const isConnectingToSelection = selectedNodes.length > 0;

    if (isConnectingToSelection) {
        const minX = Math.min(...selectedNodes.map(n => n.x));
        const maxX = Math.max(...selectedNodes.map(n => n.x + (n.type === 'prompt' ? 450 : 384))); 
        const maxY = Math.max(...selectedNodes.map(n => n.y + (n.type === 'prompt' ? 200 : 384))); 
        const centerX = (minX + maxX) / 2;
        startPromptX = centerX - 225;
        startPromptY = maxY + 150; 
    } else {
        const existingPrompts = nodes.filter(n => n.type === 'prompt').sort((a, b) => a.x - b.x);
        if (existingPrompts.length === 0) {
          startPromptX = -pan.x / scale + (window.innerWidth / 2) / scale - 225;
          startPromptY = -pan.y / scale + (window.innerHeight / 2) / scale - 400;
        } else {
          const lastPrompt = existingPrompts[existingPrompts.length - 1];
          const children = nodes.filter(n => n.parentId === lastPrompt.id);
          let maxChildX = lastPrompt.x + 450; 
          children.forEach(child => {
            const width = child.type === 'prompt' ? 450 : 384;
            if (child.x + width > maxChildX) maxChildX = child.x + width;
          });
          startPromptX = maxChildX + 400;
          startPromptY = lastPrompt.y;
        }
    }

    const promptId = `prompt-${Date.now()}`;
    const promptNode: Node = {
      id: promptId,
      type: 'prompt',
      x: startPromptX, 
      y: startPromptY, 
      content: prompt,
      inputImages: [...effectiveImages],
      parentIds: isConnectingToSelection ? selectedNodes.map(n => n.id) : undefined,
      parentId: isConnectingToSelection ? selectedNodes[0].id : undefined 
    };

    setNodes(prev => [...prev, promptNode]);
    setPrompt("");
    setAttachedImages([]); 
    setSelectedNodeIds(new Set()); 
    setIsSelectMode(false);
    setIsRatioMenuOpen(false);

    if (activeMode === 'image') {
        triggerImageGeneration(promptNode, selectedCount, selectedQuality, selectedModel, selectedAspectRatio);
    } else {
        triggerTextGeneration(promptNode, selectedModel);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // -- Event Listeners (Scroll/Drag) --
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const scrollable = target.closest('.overflow-y-auto, .overflow-x-auto, textarea');
      if (scrollable && !e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomSensitivity = 0.002;
        setScale(s => Math.min(Math.max(0.2, s - e.deltaY * zoomSensitivity), 3));
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent, nodeId?: string) => {
    const target = e.target as HTMLElement;
    if (['TEXTAREA', 'INPUT', 'BUTTON'].includes(target.tagName)) return;

    if (nodeId) {
       e.stopPropagation();
       (e.target as Element).setPointerCapture(e.pointerId);
       if (e.shiftKey || isSelectMode) {
          const newSet = new Set(selectedNodeIds);
          if (newSet.has(nodeId)) newSet.delete(nodeId);
          else newSet.add(nodeId);
          setSelectedNodeIds(newSet);
          return;
       } 
       if (!selectedNodeIds.has(nodeId)) setSelectedNodeIds(new Set([nodeId]));
       setDraggedNodeId(nodeId);
       const node = nodes.find(n => n.id === nodeId);
       if (node) initialNodePosRef.current = { x: node.x, y: node.y };
       dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else {
      if (!e.shiftKey && !isSelectMode) setSelectedNodeIds(new Set());
      setIsDraggingCanvas(true);
      initialPanRef.current = { ...pan };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      (e.target as Element).setPointerCapture(e.pointerId);
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

  const handlePointerUp = useCallback((e: PointerEvent) => {
    setDraggedNodeId(null);
    setIsDraggingCanvas(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(err) {}
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // -- Canvas Controls --
  const zoomIn = () => setScale(s => Math.min(s + 0.1, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.2));
  const fitView = () => { setPan({ x: 0, y: 0 }); setScale(1); };
  const clearCanvas = () => { setNodes([]); setSelectedNodeIds(new Set()); };
  const toggleCount = () => {
    const idx = COUNT_OPTIONS.indexOf(selectedCount);
    setSelectedCount(COUNT_OPTIONS[(idx + 1) % COUNT_OPTIONS.length]);
  };
  const toggleQuality = () => {
    const idx = QUALITY_OPTIONS.indexOf(selectedQuality);
    setSelectedQuality(QUALITY_OPTIONS[(idx + 1) % QUALITY_OPTIONS.length]);
  };

  const effectiveImages = getEffectiveImages();

  return (
    <main 
      ref={containerRef}
      className={`relative w-full h-full bg-app-bg overflow-hidden font-sans transition-colors duration-300 ${isSelectMode ? 'cursor-crosshair' : (isDraggingCanvas || draggedNodeId ? 'cursor-grabbing' : 'cursor-grab')}`}
      onPointerDown={(e) => handlePointerDown(e)}
      dir="ltr"
    >
      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

      <div className="absolute inset-0 pointer-events-none dot-grid" style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${24 * scale}px ${24 * scale}px` }} />

      {/* Top Left Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center bg-panel-bg border border-border-app rounded-lg p-1 shadow-2xl">
           <ToolbarBtn icon="space_dashboard" />
           <ToolbarBtn icon="chat_bubble" active />
           <div className="w-px h-5 bg-border-app mx-1"></div>
           <button onClick={onToggleLanguage} className="px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-main hover:bg-highlight rounded-md transition">
             {lang === 'ar' ? 'EN' : 'AR'}
           </button>
           <div className="w-px h-5 bg-border-app mx-1"></div>
           <div className="flex gap-1 px-1">
             <button onClick={() => onSetTheme('dark-blue')} title="Dark Blue" className={`size-4 rounded-full bg-[#137fec] ring-2 transition ${theme === 'dark-blue' ? 'ring-white ring-offset-1 ring-offset-[#18181b]' : 'ring-transparent hover:scale-110'}`}></button>
             <button onClick={() => onSetTheme('white-apple')} title="White Apple" className={`size-4 rounded-full bg-[#e5e5e5] border border-gray-300 ring-2 transition ${theme === 'white-apple' ? 'ring-blue-500 ring-offset-1 ring-offset-white' : 'ring-transparent hover:scale-110'}`}></button>
             <button onClick={() => onSetTheme('orange')} title="Orange" className={`size-4 rounded-full bg-[#f97316] ring-2 transition ${theme === 'orange' ? 'ring-white ring-offset-1 ring-offset-[#292524]' : 'ring-transparent hover:scale-110'}`}></button>
           </div>
        </div>
        <div className="flex items-center justify-center size-10 rounded-full bg-primary text-white font-bold text-sm shadow-lg ring-2 ring-app-bg cursor-pointer hover:scale-105 transition">A</div>
      </div>

      {/* Bottom Left Controls */}
      <div className="absolute bottom-28 left-4 z-50 flex flex-col gap-2" onPointerDown={e => e.stopPropagation()}>
         <div className="flex flex-col bg-panel-bg border border-border-app rounded-xl p-1.5 shadow-2xl gap-1">
            <ToolbarBtn icon="ads_click" active={isSelectMode} onClick={() => setIsSelectMode(!isSelectMode)} title={t.selectMode} />
            <div className="h-px w-full bg-border-app my-0.5"></div>
            <ToolbarBtn icon="add" onClick={zoomIn} title={t.zoomIn} />
            <ToolbarBtn icon="remove" onClick={zoomOut} title={t.zoomOut} />
            <div className="h-px w-full bg-border-app my-0.5"></div>
            <ToolbarBtn icon="center_focus_strong" onClick={fitView} title={t.fitView} />
            <ToolbarBtn icon="delete_sweep" onClick={clearCanvas} title={t.clearCanvas} />
         </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4" onPointerDown={e => e.stopPropagation()}>
        
        {/* Aspect Ratio Menu (Only for Image Mode) */}
        {isRatioMenuOpen && activeMode === 'image' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-panel-bg border border-border-app rounded-xl shadow-2xl overflow-hidden p-1 flex flex-col gap-0.5">
            {ASPECT_RATIOS.map((ratio) => (
              <button key={ratio.value} onClick={() => { setSelectedAspectRatio(ratio.value); setIsRatioMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition ${selectedAspectRatio === ratio.value ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-highlight'}`}>
                <Icon name={ratio.icon} className="text-sm" />
                <span className="flex-1 text-start">{t[ratio.labelKey as keyof Translations]}</span>
                {selectedAspectRatio === ratio.value && <Icon name="check" className="text-xs" />}
              </button>
            ))}
          </div>
        )}

        <div className={`relative bg-panel-bg border rounded-2xl shadow-2xl p-2 flex flex-col gap-2 transition-all duration-200 ${isDragOverInput ? 'border-primary ring-2 ring-primary/30 scale-[1.02]' : 'border-border-app focus-within:ring-1 focus-within:ring-primary/50'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
           {isDragOverInput && (
              <div className="absolute inset-0 bg-panel-bg/90 rounded-2xl flex flex-col items-center justify-center z-20 backdrop-blur-sm pointer-events-none">
                <Icon name="cloud_upload" className="text-4xl text-primary animate-bounce mb-2" />
                <span className="text-primary font-bold text-sm">{t.dragDropHint}</span>
              </div>
           )}

           {effectiveImages.length > 0 && (
             <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar pb-3">
               {effectiveImages.map((img, idx) => (
                 <div key={idx} className="relative size-16 shrink-0 group rounded-lg overflow-hidden border border-border-app bg-app-bg ring-1 ring-primary/50">
                   <img src={img.data} alt="attachment" className="w-full h-full object-cover" />
                   {idx < attachedImages.length && (
                     <button onClick={() => removeAttachedImage(idx)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                       <Icon name="close" className="text-white text-lg" />
                     </button>
                   )}
                   {idx >= attachedImages.length && <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5 pointer-events-none"><Icon name="link" className="text-[10px] text-white" /></div>}
                 </div>
               ))}
               <div className="flex items-center px-2 text-xs text-primary font-bold">{effectiveImages.length} {t.images}</div>
             </div>
           )}

           <div className="flex items-end gap-2 p-2">
              <button onClick={() => fileInputRef.current?.click()} className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-highlight text-text-muted hover:text-text-main transition" title={t.attachImage}>
                <Icon name="attach_file" className="rotate-45" />
              </button>

              <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} onPointerDown={(e) => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'} placeholder={t.writePrompt} className="w-full bg-transparent border-none text-text-main placeholder-text-muted focus:ring-0 resize-none h-12 max-h-32 py-2 custom-scrollbar select-text cursor-text selection:bg-blue-500 selection:text-white" style={{ minHeight: '48px' }} />
              
              <button onClick={handleSubmit} disabled={!prompt.trim() && effectiveImages.length === 0} className={`size-10 shrink-0 rounded-xl flex items-center justify-center transition ${(!prompt.trim() && effectiveImages.length === 0) ? 'bg-highlight text-text-muted cursor-not-allowed' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}>
                <Icon name="arrow_upward" />
              </button>
           </div>

           <div className="flex items-center justify-between px-2 pb-1 border-t border-border-app pt-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                
                {/* Mode Switcher */}
                <div className="flex items-center gap-0.5 bg-app-bg border border-border-app rounded-lg p-0.5 shrink-0">
                    <button 
                        onClick={() => setActiveMode('image')} 
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition ${activeMode === 'image' ? 'bg-panel-bg text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <Icon name="image" className="text-sm" />
                        <span>{t.modeImage}</span>
                    </button>
                    <button 
                        onClick={() => setActiveMode('chat')} 
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition ${activeMode === 'chat' ? 'bg-panel-bg text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <Icon name="chat" className="text-sm" />
                        <span>{t.modeChat}</span>
                    </button>
                </div>

                <div className="w-px h-6 bg-border-app mx-1 shrink-0"></div>

                {/* Model Selector */}
                <div className="flex items-center gap-2 bg-highlight hover:bg-highlight/80 px-3 py-1.5 rounded-lg cursor-pointer transition select-none shrink-0" onClick={() => setIsSettingsOpen(true)}>
                   {selectedModel === 'standard' 
                     ? <Icon name={activeMode === 'image' ? "flash_on" : "bolt"} className="text-yellow-500 text-sm" /> 
                     : <Icon name={activeMode === 'image' ? "auto_awesome" : "psychology"} className="text-cyan-400 text-sm" />
                   }
                   <span className="text-xs font-bold text-text-muted">
                     {activeMode === 'image' 
                        ? (selectedModel === 'standard' ? "Nano Banana" : "Nano Banana Pro 2")
                        : (selectedModel === 'standard' ? "Gemini 2.5 Flash" : "Gemini 3 Pro")
                     }
                   </span>
                </div>

                {/* Image Specific Tools */}
                {activeMode === 'image' && (
                    <>
                        <div className="w-px h-6 bg-border-app mx-1 shrink-0"></div>
                        <button onClick={() => setIsRatioMenuOpen(!isRatioMenuOpen)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${isRatioMenuOpen ? 'bg-primary/20 text-primary' : 'bg-highlight hover:bg-highlight/80 text-text-muted'}`} title={t.aspectRatio}>
                          <Icon name="aspect_ratio" className="text-sm" />
                          <span>{selectedAspectRatio}</span>
                        </button>
                        <button onClick={toggleCount} className="flex items-center gap-1.5 bg-highlight hover:bg-highlight/80 px-2 py-1.5 rounded-lg text-xs font-bold text-text-muted transition shrink-0" title={t.imageCount}>
                          <Icon name="collections" className="text-sm text-text-muted" />
                          <span>{selectedCount} {t.images}</span>
                        </button>
                        {selectedModel === 'pro' && (
                          <button onClick={toggleQuality} className="flex items-center gap-1.5 bg-highlight hover:bg-highlight/80 px-2 py-1.5 rounded-lg text-xs font-bold text-text-muted transition shrink-0" title={t.quality}>
                            <Icon name="hd" className="text-sm text-text-muted" />
                            <span>{selectedQuality}</span>
                          </button>
                        )}
                    </>
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

      {/* Settings Modal (Simplified for brevity, same logic applies) */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onPointerDown={e => e.stopPropagation()}>
           <div className="bg-panel-bg border border-border-app w-full max-w-md rounded-2xl shadow-2xl p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-text-main">{t.settings}</h2>
                 <button onClick={() => setIsSettingsOpen(false)} className="text-text-muted hover:text-text-main"><Icon name="close" /></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">{t.apiKey}</label>
                    <div className="flex gap-2">
                        <input type="password" value={userApiKey} onChange={(e) => setUserApiKey(e.target.value)} placeholder="AIzaSy..." className="flex-1 bg-app-bg border border-border-app rounded-lg p-3 text-text-main focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-muted/50" />
                        <button onClick={handleApplyKey} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isKeySaved ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}>{isKeySaved ? t.saved : t.apply}</button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">{t.apiKeyDesc}</p>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">{t.model}</label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setSelectedModel('standard')} className={`w-full text-start p-3 rounded-lg border flex items-center justify-between transition ${selectedModel === 'standard' ? 'bg-primary/10 border-primary text-primary' : 'bg-app-bg border-border-app text-text-muted hover:border-text-muted'}`}>
                         <div className="flex items-center gap-2">
                             <div className="size-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <Icon name={activeMode === 'image' ? "flash_on" : "bolt"} className="text-yellow-500" />
                             </div>
                             <span className="font-bold text-sm">{activeMode === 'image' ? t.modelStandard : t.chatModelStandard}</span>
                         </div>
                         {selectedModel === 'standard' && <Icon name="check_circle" className="text-sm" />}
                      </button>
                      <button onClick={() => setSelectedModel('pro')} className={`w-full text-start p-3 rounded-lg border flex items-center justify-between transition ${selectedModel === 'pro' ? 'bg-primary/10 border-primary text-primary' : 'bg-app-bg border-border-app text-text-muted hover:border-text-muted'}`}>
                         <div className="flex items-center gap-2">
                             <div className="size-8 rounded-full bg-cyan-400/20 flex items-center justify-center">
                                <Icon name={activeMode === 'image' ? "auto_awesome" : "psychology"} className="text-cyan-400" />
                             </div>
                             <span className="font-bold text-sm">{activeMode === 'image' ? t.modelPro : t.chatModelPro}</span>
                         </div>
                         {selectedModel === 'pro' && <Icon name="check_circle" className="text-sm" />}
                      </button>
                    </div>
                 </div>
              </div>
              <div className="mt-8 flex justify-end">
                 <button onClick={() => setIsSettingsOpen(false)} className="bg-highlight hover:bg-highlight/80 text-text-main px-6 py-2 rounded-lg font-medium transition">{t.close}</button>
              </div>
           </div>
        </div>
      )}

      {/* Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-in-95 animate-in duration-300" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/50 hover:text-white" onClick={() => setPreviewImage(null)}><Icon name="close" className="text-3xl" /></button>
        </div>
      )}

      {/* Nodes Layer */}
      <div className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
        <svg className="absolute overflow-visible pointer-events-none z-0">
          {nodes.map(node => {
            const parentIds = node.parentIds || (node.parentId ? [node.parentId] : []);
            if (parentIds.length === 0) return null;

            return parentIds.map((pid) => {
               const parent = nodes.find(n => n.id === pid);
               if (!parent) return null;
               
               let startX, startY, endX, endY;

               // Calculate connections based on node types
               if (parent.type === 'image' && node.type === 'prompt') {
                  startX = parent.x + 192; 
                  startY = parent.y + 384; 
                  endX = node.x + 225; 
                  endY = node.y;
               } else if (parent.type === 'prompt' && node.type === 'text') {
                  startX = parent.x + 225;
                  startY = parent.y + (parent.inputImages?.length ? 250 : 120);
                  endX = node.x + 225;
                  endY = node.y;
               } else if (parent.type === 'text' && node.type === 'prompt') {
                  startX = parent.x + 225;
                  startY = parent.y + 300; // Approx height of text node
                  endX = node.x + 225;
                  endY = node.y;
               } else {
                  // Prompt -> Image
                  startX = parent.x + 225; 
                  const hasImages = parent.inputImages && parent.inputImages.length > 0;
                  const promptHeight = hasImages ? 250 : 120;
                  startY = parent.y + promptHeight; 
                  endX = node.x + 192; 
                  endY = node.y;
               }

               return (
                 <path key={`link-${pid}-${node.id}`} d={`M ${startX} ${startY} C ${startX} ${startY + 100}, ${endX} ${endY - 100}, ${endX} ${endY}`} fill="none" stroke={theme === 'white-apple' ? '#cbd5e1' : '#52525b'} strokeWidth="2" strokeDasharray="4,4" />
               );
            });
          })}
        </svg>

        {nodes.map(node => (
          <div key={node.id} className="absolute z-10 touch-none select-none" style={{ transform: `translate(${node.x}px, ${node.y}px)` }} onPointerDown={(e) => handlePointerDown(e, node.id)}>
             <NodeItem 
               node={node} 
               t={t} 
               lang={lang} 
               theme={theme}
               isSelected={selectedNodeIds.has(node.id)}
               onDelete={() => deleteNode(node.id)} 
               onDoubleClick={() => node.imageData && setPreviewImage(node.imageData)}
               onDownload={() => node.imageData && downloadImage(node.imageData, `nano-banana-${node.id}.png`)}
               onImageClick={(src) => setPreviewImage(src)}
               onEdit={() => handleEditNode(node)}
               onRemix={() => handleRemixPrompt(node)}
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
  <button onClick={onClick} title={title} className={`size-9 flex items-center justify-center rounded-lg transition ${active ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:text-text-main hover:bg-highlight'}`}>
    <Icon name={icon} className="text-[20px]" />
  </button>
);

const NodeItem: React.FC<{ 
  node: Node; 
  t: Translations; 
  lang: Language; 
  theme: Theme;
  isSelected?: boolean;
  onDelete: () => void; 
  onDoubleClick?: () => void;
  onDownload?: () => void;
  onImageClick?: (src: string) => void;
  onEdit?: () => void;
  onRemix?: () => void;
  onSubmit?: (content: string) => void;
  onRegenerate?: () => void;
}> = ({ node, t, lang, theme, isSelected, onDelete, onDoubleClick, onDownload, onImageClick, onEdit, onRemix, onSubmit, onRegenerate }) => {
  const [localContent, setLocalContent] = useState(node.content || "");
  const selectionRing = isSelected ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : '';

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  if (node.type === 'prompt') {
    return (
      <div className="w-[450px] relative group">
        <div className={`backdrop-blur-md border rounded-[2rem] p-6 shadow-2xl transition-all ${theme === 'white-apple' ? 'bg-white/80 border-gray-200' : 'bg-panel-bg/90 border-primary/20'} ${node.isEditing ? 'border-primary ring-1 ring-primary' : 'hover:border-primary'} ${selectionRing}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-teal-600 flex items-center justify-center text-[10px] text-white font-bold">A</div>
                <span className="text-xs font-bold text-text-muted">User</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded-full" title={t.delete}><Icon name="delete" className="text-sm text-red-400" /></button>
           </div>
           
           {node.inputImages && node.inputImages.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-3">
               {node.inputImages.map((img, idx) => (
                 <img key={idx} src={img.data} alt="input" className="size-20 rounded-lg object-cover border border-border-app cursor-pointer hover:border-primary" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); onImageClick?.(img.data); }} />
               ))}
             </div>
           )}

           {node.isEditing ? (
             <div className="flex flex-col gap-2">
               <textarea value={localContent} onChange={(e) => setLocalContent(e.target.value)} onPointerDown={(e) => e.stopPropagation()} className="w-full bg-app-bg border border-border-app rounded-lg p-2 text-text-main text-lg focus:outline-none focus:border-primary resize-none h-24 select-text cursor-text selection:bg-blue-500 selection:text-white" placeholder={t.writePrompt} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit?.(localContent); } }} />
               <div className="flex justify-end">
                 <button onClick={(e) => { e.stopPropagation(); onSubmit?.(localContent); }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-primary/90 transition flex items-center gap-2"><Icon name="play_arrow" className="text-sm" />{t.run}</button>
               </div>
             </div>
           ) : (
             <div className="relative group/text">
                <p className="text-lg text-text-main font-medium whitespace-pre-wrap cursor-text select-text" dir="auto" onClick={(e) => { e.stopPropagation(); onRemix?.(); }}>{node.content}</p>
                <div className="absolute -top-2 -right-2 bg-panel-bg border border-border-app shadow-lg rounded-lg flex items-center gap-1 p-1 opacity-0 group-hover/text:opacity-100 transition-opacity z-20">
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(node.content || ""); }} className="p-1.5 hover:bg-highlight rounded-md text-text-muted hover:text-text-main transition" title="Copy Text"><Icon name="content_copy" className="text-xs" /></button>
                    <div className="w-px h-3 bg-border-app"></div>
                    <button onClick={(e) => { e.stopPropagation(); onRemix?.(); }} className="p-1.5 hover:bg-highlight rounded-md text-primary transition" title={t.editImage}><Icon name="edit" className="text-xs" /></button>
                </div>
             </div>
           )}
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50"></div>
      </div>
    );
  }

  if (node.type === 'text') {
    return (
      <div className="w-[500px] relative group">
        <div className={`backdrop-blur-md border rounded-[2rem] p-6 shadow-2xl transition-all ${theme === 'white-apple' ? 'bg-white border-blue-200 shadow-blue-500/10' : 'bg-[#1e1e24]/95 border-purple-500/20 shadow-purple-900/10'} ${selectionRing}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`size-6 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${node.modelType === 'standard' ? 'bg-amber-500' : 'bg-gradient-to-br from-indigo-500 to-purple-500'}`}>
                    <Icon name={node.modelType === 'standard' ? "bolt" : "psychology"} className="text-sm" />
                </div>
                <span className="text-xs font-bold text-text-muted">{node.modelType === 'standard' ? t.chatModelStandard : t.chatModelPro}</span>
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }} className="p-1.5 hover:bg-highlight rounded-full text-text-muted hover:text-text-main" title={t.regenerate}><Icon name="refresh" className="text-sm" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 hover:bg-red-500/10 rounded-full text-text-muted hover:text-red-400" title={t.delete}><Icon name="delete" className="text-sm" /></button>
              </div>
           </div>
           
           <div className="relative group/text min-h-[50px]">
             {node.status === 'loading' ? (
                <div className="flex items-center gap-2 text-text-muted animate-pulse py-4">
                    <Icon name="edit_note" className="animate-bounce" />
                    <span>{t.thinking}</span>
                </div>
             ) : node.status === 'error' ? (
                <div className="text-red-400 bg-red-500/5 p-3 rounded-lg border border-red-500/10 text-sm">
                    <div className="flex items-center gap-2 mb-1 font-bold"><Icon name="error" /> {t.errorGeneric}</div>
                    {node.errorMsg}
                </div>
             ) : (
                <>
                    <p className="text-base text-text-main leading-relaxed whitespace-pre-wrap cursor-text select-text selection:bg-purple-500/30 selection:text-white" dir="auto" onPointerDown={(e) => e.stopPropagation()}>
                    {node.content}
                    </p>
                    {/* Copy/Edit Actions */}
                    <div className="absolute top-0 right-0 bg-panel-bg border border-border-app shadow-lg rounded-lg flex items-center gap-1 p-1 opacity-0 group-hover/text:opacity-100 transition-opacity translate-x-2 -translate-y-2 z-20">
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(node.content || ""); }} className="p-1.5 hover:bg-highlight rounded-md text-text-muted hover:text-text-main transition" title={t.copyText}><Icon name="content_copy" className="text-xs" /></button>
                        <div className="w-px h-3 bg-border-app"></div>
                        <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }} className="p-1.5 hover:bg-highlight rounded-md text-primary transition" title="Continue Chat"><Icon name="chat_bubble" className="text-xs" /></button>
                    </div>
                </>
             )}
           </div>
        </div>
      </div>
    );
  }

  if (node.type === 'image') {
    return (
      <div 
        className={`size-96 bg-panel-bg rounded-[2rem] border shadow-2xl overflow-hidden relative group transition-colors ${node.status === 'error' ? 'border-red-500/50' : 'border-border-app hover:border-primary/50'} ${selectionRing}`}
        onDoubleClick={onDoubleClick}
      >
         {node.status === 'loading' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="size-12 rounded-full border-4 border-border-app border-t-primary animate-spin"></div>
              <span className="text-text-muted text-sm animate-pulse">{t.generating}</span>
           </div>
         )}
         
         {node.status === 'done' && node.imageData && (
           <img src={node.imageData} alt="Generated" className="w-full h-full object-cover" draggable={false} onDragStart={(e) => e.preventDefault()} />
         )}

         {node.status === 'error' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 p-4 text-center bg-red-500/5 overflow-y-auto custom-scrollbar">
             <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><Icon name="error" className="text-2xl" /></div>
             <div><p className="text-sm font-bold">{t.errorGeneric}</p><p className="text-xs text-red-300 mt-1 leading-relaxed whitespace-pre-wrap px-2">{node.errorMsg}</p></div>
             <button onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }} className="mt-2 flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition border border-red-500/20"><Icon name="refresh" className="text-sm" />{t.retry}</button>
           </div>
         )}

         <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 pointer-events-none">
            {node.modelType === 'standard' ? <Icon name="flash_on" className="text-yellow-500 text-xs" /> : <Icon name="auto_awesome" className="text-cyan-400 text-xs" />}
            <span className="text-[10px] text-white font-bold">{node.modelType === 'standard' ? "Nano Banana" : "Nano Banana Pro 2"}</span>
            {node.aspectRatio && <span className="text-[10px] text-slate-300 border-l border-white/20 pl-2 ml-1">{node.aspectRatio}</span>}
            {node.quality && <span className="text-[10px] text-slate-400 border-l border-white/20 pl-2 ml-1">{node.quality}</span>}
         </div>
         
         <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" title={t.regenerate} onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }}><Icon name="refresh" className="text-sm" /></button>
            <button className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" title={t.editImage} onClick={(e) => { e.stopPropagation(); onEdit?.(); }}><Icon name="edit" className="text-sm" /></button>
            <button className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" title="Fullscreen" onClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}><Icon name="fullscreen" className="text-sm" /></button>
            <button className="size-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md hover:scale-105 transition" title="Download" onClick={(e) => { e.stopPropagation(); onDownload?.(); }}><Icon name="download" className="text-sm" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="size-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center backdrop-blur-md border border-red-500/30 hover:scale-105 transition" title={t.delete}><Icon name="delete" className="text-sm" /></button>
         </div>
      </div>
    );
  }
  return null;
};
