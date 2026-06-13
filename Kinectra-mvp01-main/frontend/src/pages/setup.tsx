import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  CircleUserRound, 
  Loader2, 
  ArrowRight, 
  Camera, 
  Upload, 
  AlertTriangle, 
  FileVideo 
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import { useStartSession } from "@workspace/api-client-react";
import { useSessionContext } from "@/contexts/SessionContext";
import ProcessingScreen from "@/components/analysis/ProcessingScreen";

const setupSchema = z.object({
  athleteName: z.string().min(2, "Name must be at least 2 characters"),
  analysisType: z.enum(["bowling", "batting"]),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "professional"]),
  dominantHand: z.enum(["right", "left"]),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function Setup() {
  const [, setLocation] = useLocation();
  const { setConfig } = useSessionContext();
  const { toast } = useToast();
  
  const [analysisMode, setAnalysisMode] = useState<"live" | "upload">("live");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      athleteName: "",
      analysisType: "bowling",
      skillLevel: "intermediate",
      dominantHand: "right",
    },
  });

  const startSessionMutation = useStartSession();

  const handleFileChange = (file: File) => {
    setUploadError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "mp4" && ext !== "mov" && ext !== "avi") {
      setUploadError("Invalid format. Only MP4, MOV, and AVI are supported.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError("File size exceeds 100 MB limit.");
      return;
    }
    
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    const tempVideo = document.createElement("video");
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration);
    };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const onSubmit = async (data: SetupFormValues) => {
    if (analysisMode === "live") {
      startSessionMutation.mutate(
        { data },
        {
          onSuccess: (session) => {
            setConfig({
              sessionId: session.id,
              athleteName: data.athleteName,
              analysisType: data.analysisType,
              skillLevel: data.skillLevel,
              dominantHand: data.dominantHand,
            });
            toast({
              title: "Session Created",
              description: "Initializing computer vision models...",
            });
            setLocation("/analysis");
          },
          onError: () => {
            toast({
              variant: "destructive",
              title: "Setup Failed",
              description: "Could not start analysis session. Please try again.",
            });
          },
        }
      );
    } else {
      if (!selectedFile) {
        setUploadError("Please select a video file to analyze.");
        return;
      }
      
      if (videoDuration && videoDuration > 60.5) {
        setUploadError("Video must be under 60 seconds.");
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("video", selectedFile);
      formData.append("athleteName", data.athleteName);
      formData.append("analysisType", data.analysisType);
      formData.append("skillLevel", data.skillLevel);
      formData.append("dominantHand", data.dominantHand);

      try {
        const response = await fetch("/api/video/upload", {
          method: "POST",
          body: formData,
        });

        const resData = await response.json();
        if (!response.ok || !resData.success) {
          throw new Error(resData.message || "Upload failed");
        }

        setJobId(resData.jobId);
      } catch (err: any) {
        console.error(err);
        setIsUploading(false);
        setUploadError(err.message || "Failed to upload video for analysis.");
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: err.message || "Could not upload video. Please try again.",
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8 md:py-12 max-w-3xl mx-auto animate-in fade-in duration-300">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Configure Analysis</h1>
            <p className="text-muted-foreground">Select your discipline, analysis mode, and parameters to initialize the computer vision engine.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Discipline (Analysis Type) */}
              <FormField
                control={form.control}
                name="analysisType"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-base font-semibold">Discipline</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card 
                          className={`cursor-pointer border-2 transition-all ${field.value === 'bowling' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                          onClick={() => field.onChange("bowling")}
                        >
                          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                            <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                              <Activity className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">Pace / Spin Bowling</h3>
                            <p className="text-sm text-muted-foreground">Analyze arm angles, spine tilt, and delivery stride biomechanics.</p>
                          </CardContent>
                        </Card>
                        
                        <Card 
                          className={`cursor-pointer border-2 transition-all ${field.value === 'batting' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                          onClick={() => field.onChange("batting")}
                        >
                          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                            <div className="w-12 h-12 rounded-full bg-accent/30 dark:bg-accent/15 flex items-center justify-center mb-4">
                              <CircleUserRound className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">Batting Stance</h3>
                            <p className="text-sm text-muted-foreground">Track head stability, front foot planting, and bat lift angles.</p>
                          </CardContent>
                        </Card>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Analysis Mode Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Analysis Mode</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card 
                    className={`cursor-pointer border-2 transition-all ${analysisMode === 'live' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                    onClick={() => { setAnalysisMode("live"); setUploadError(null); }}
                  >
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                      <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">Option 1: Live Analysis</h3>
                      <p className="text-sm text-muted-foreground">Start Camera for real-time browser-native pose tracking and instant technique scores.</p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer border-2 transition-all ${analysisMode === 'upload' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                    onClick={() => setAnalysisMode("upload")}
                  >
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                      <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">Option 2: Upload Video Analysis</h3>
                      <p className="text-sm text-muted-foreground">Select a pre-recorded sports video file to undergo high-precision biomechanics processing.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Drag and Drop Upload Area */}
              {analysisMode === "upload" && (
                <div className="space-y-4 border rounded-xl p-6 bg-card animate-in slide-in-from-top-4 duration-300">
                  <Label className="text-base font-semibold">Upload sports video file</Label>
                  
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>For best results, upload a clear side-view or front-view video under 60 seconds. Max size: 100 MB.</span>
                  </div>

                  {!selectedFile ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        dragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => document.getElementById("video-upload")?.click()}
                    >
                      <Upload className="h-10 w-10 text-muted-foreground mb-4 animate-pulse" />
                      <p className="text-sm font-semibold mb-1">Drag & Drop your video file here</p>
                      <p className="text-xs text-muted-foreground mb-4">Supported formats: MP4, MOV, AVI (Max 60s, 100MB)</p>
                      
                      <Input
                        id="video-upload"
                        type="file"
                        accept=".mp4,.mov,.avi"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById("video-upload")?.click();
                        }}
                      >
                        Select Video Button
                      </Button>
                    </div>
                  ) : (
                    // File Preview & Metadata details
                    <div className="space-y-4">
                      <div className="relative aspect-video max-h-[300px] w-full rounded-xl overflow-hidden border bg-black flex items-center justify-center">
                        <video
                          src={videoPreviewUrl || ""}
                          controls
                          className="h-full w-full object-contain"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileVideo className="h-8 w-8 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate text-foreground">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                              {videoDuration !== null && ` • ${Math.round(videoDuration)} seconds`}
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setVideoDuration(null);
                            setVideoPreviewUrl(null);
                          }}
                          className="text-red-500 hover:text-red-600 font-semibold"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs font-semibold text-red-500">{uploadError}</p>
                  )}
                </div>
              )}

              {/* Athlete parameters input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-card">
                <FormField
                  control={form.control}
                  name="athleteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Athlete Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Virat K." {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skillLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level Benchmark</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dominantHand"
                  render={({ field }) => (
                    <FormItem className="space-y-3 md:col-span-2">
                      <FormLabel>Dominant Hand / Stance</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0 border rounded-lg p-3 pr-6 bg-background">
                            <FormControl>
                              <RadioGroupItem value="right" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Right
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0 border rounded-lg p-3 pr-6 bg-background">
                            <FormControl>
                              <RadioGroupItem value="left" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Left
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Trigger */}
              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={startSessionMutation.isPending || isUploading}
                  className="w-full md:w-auto min-w-[200px] shadow-lg shadow-primary/20 font-semibold"
                >
                  {startSessionMutation.isPending || isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isUploading ? "Uploading..." : "Initializing..."}
                    </>
                  ) : (
                    <>
                      {analysisMode === "live" ? "Start Camera" : "Analyze Video"}{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </motion.div>
      </main>

      {/* Render Processing modal Screen */}
      <AnimatePresence>
        {jobId && (
          <ProcessingScreen
            jobId={jobId}
            onCancel={() => {
              setJobId(null);
              setIsUploading(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
