import React, { useState, useEffect, useRef } from "react";
import { Mic, Headphones, X, Volume2, VolumeX, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { KinetraMetrics } from "@/utils/pose-evaluator";

interface AICoachPanelProps {
  metrics: KinetraMetrics;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
}

export function AICoachPanel({ metrics, isSpeaking, setIsSpeaking }: AICoachPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [transcript, setTranscript] = useState("");
  const [coachResponse, setCoachResponse] = useState<string>(
    "Hello, I am Aryan, your AI cricket coach. Click on a topic below or speak into the microphone to ask for biomechanical feedback!"
  );
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        
        rec.onstart = () => {
          setIsListening(true);
          setTranscript("Listening...");
        };
        
        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          setTranscript(resultText);
          handleVoiceCommand(resultText);
        };
        
        rec.onerror = (event: any) => {
          console.error("Speech recognition error", event);
          setIsListening(false);
          setTranscript("Speech recognition error occurred.");
        };
        
        rec.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = rec;
      }
    }
  }, [language, metrics]);

  // Make sure to cancel speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        if (synthRef.current) {
          synthRef.current.cancel();
          setIsSpeaking(false);
        }
        recognitionRef.current.lang = language === "en" ? "en-IN" : "hi-IN";
        recognitionRef.current.start();
      }
    } catch (err) {
      console.warn("SpeechRecognition error toggle:", err);
      // Force sync state if recognition was in an unexpected state
      setIsListening(false);
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    
    // Choose appropriate voice
    let selectedVoice = null;
    if (language === "hi") {
      selectedVoice = voices.find(v => v.lang.startsWith("hi") || v.name.includes("Hindi") || v.name.includes("Google हिन्दी"));
      utterance.lang = "hi-IN";
    } else {
      selectedVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("India") || v.name.includes("Google English")));
      utterance.lang = "en-IN";
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };

  const generateFeedback = (topic: "technique" | "balance" | "posture" | "drill") => {
    let text = "";
    if (language === "en") {
      switch (topic) {
        case "technique":
          text = `Your technique score is ${metrics.techniqueScore} out of 100. `;
          if (metrics.warnings.length > 0) {
            text += `I have detected some errors: ${metrics.warnings.join(", ")}. Please follow my corrections.`;
          } else {
            text += `Fantastic technique! Your joint angles match standard cricket models. Maintain this tempo!`;
          }
          break;
        case "balance":
          text = `Your balance score is ${metrics.balanceScore} percent. `;
          if (metrics.balanceScore < 75) {
            text += `Your hips are slightly unaligned. Focus on building a stable foundation and landing firmly.`;
          } else {
            text += `Your body weight transfer and balance look perfect!`;
          }
          break;
        case "posture":
          text = `Your posture score is ${metrics.postureScore} percent. `;
          if (metrics.spineTilt > 25) {
            text += `Your spine is tilting too much at ${metrics.spineTilt} degrees. Engage your core to keep your body vertical.`;
          } else {
            text += `Excellent posture! Your spine alignment is straight and steady.`;
          }
          break;
        case "drill":
          if (metrics.warnings.includes("Elbow angle too low") || metrics.elbowAngle < 80) {
            text = "For your elbow extension drop, practice Wall Shadow Bowling: stand next to a wall and bowl without a ball to lock a high release point.";
          } else if (metrics.warnings.includes("Excessive spine tilt") || metrics.spineTilt > 25) {
            text = "For spine tilt, practice Upright Stride Drills: step forward over a line and hold your finish upright for 3 seconds.";
          } else {
            text = "I recommend Target Spot shadow practice: perform 15 repetitions focusing on a steady head and vertical follow-through.";
          }
          break;
      }
    } else {
      // Hindi responses
      switch (topic) {
        case "technique":
          text = `आपकी तकनीक का स्कोर 100 में से ${metrics.techniqueScore} है। `;
          if (metrics.warnings.length > 0) {
            text += `मुझे कुछ कमियां मिली हैं, जैसे कि: ${metrics.warnings.map(w => {
              if (w === "Elbow angle too low") return "कोहनी का नीचे गिरना";
              if (w === "Excessive spine tilt") return "कमर का ज्यादा झुकना";
              if (w === "Poor shoulder rotation") return "कंधे का ठीक से न घूमना";
              if (w === "Front knee bent too much") return "घुटने का ज्यादा झुकना";
              return w;
            }).join(", ")}। कृपया इन गलतियों को सुधारें।`;
          } else {
            text += `बहुत ही बढ़िया तकनीक! आपकी पोजीशन बिल्कुल सही है। इसी तरह अभ्यास करते रहें।`;
          }
          break;
        case "balance":
          text = `आपका बॉडी बैलेंस ${metrics.balanceScore} प्रतिशत है। `;
          if (metrics.balanceScore < 75) {
            text += `आपके पैर और हिप्स थोड़े असंतुलित हैं। जमीन पर अपने सामने वाले पैर को मजबूती से रखें।`;
          } else {
            text += `आपका शरीर का संतुलन और वजन ट्रांसफर बहुत ही बढ़िया है!`;
          }
          break;
        case "posture":
          text = `आपका पोस्चर स्कोर ${metrics.postureScore} प्रतिशत है। `;
          if (metrics.spineTilt > 25) {
            text += `आपकी रीढ़ की हड्डी ${metrics.spineTilt} डिग्री तक झुकी हुई है। सीधे रहने के लिए अपने कोर को मजबूत रखें।`;
          } else {
            text += `उत्कृष्ट पोस्चर! आपकी रीढ़ की हड्डी बिल्कुल सीधी और स्थिर है।`;
          }
          break;
        case "drill":
          if (metrics.warnings.includes("Elbow angle too low") || metrics.elbowAngle < 80) {
            text = "कोहनी की पोजीशन सुधारने के लिए बिना गेंद के दीवार के साथ शैडो बॉलिंग का अभ्यास करें, ताकि कोहनी ऊंची रहे।";
          } else if (metrics.warnings.includes("Excessive spine tilt") || metrics.spineTilt > 25) {
            text = "कमर के झुकाव को रोकने के लिए, सीधे खड़े होकर कदम बढ़ाने का अभ्यास करें और अंत में 3 सेकंड तक सीधे रहें।";
          } else {
            text = "मैं आपको शैडो प्रैक्टिस करने की सलाह दूंगा: सीधे सिर और शरीर के साथ 15 बार एक्शन दोहराएं।";
          }
          break;
      }
    }
    setCoachResponse(text);
    speakText(text);
  };

  const handleVoiceCommand = (command: string) => {
    const cmd = command.toLowerCase();
    
    // English intents
    if (cmd.includes("score") || cmd.includes("technique") || cmd.includes("performance") || cmd.includes("accuracy")) {
      generateFeedback("technique");
    } else if (cmd.includes("balance") || cmd.includes("unstable") || cmd.includes("footwork") || cmd.includes("weight")) {
      generateFeedback("balance");
    } else if (cmd.includes("posture") || cmd.includes("spine") || cmd.includes("tilt") || cmd.includes("lean")) {
      generateFeedback("posture");
    } else if (cmd.includes("drill") || cmd.includes("drill") || cmd.includes("exercise") || cmd.includes("practice") || cmd.includes("tip")) {
      generateFeedback("drill");
    }
    // Hindi intents
    else if (cmd.includes("तकनीक") || cmd.includes("स्कोर") || cmd.includes("प्रदर्शन")) {
      generateFeedback("technique");
    } else if (cmd.includes("बैलेंस") || cmd.includes("संतुलन") || cmd.includes("समतल")) {
      generateFeedback("balance");
    } else if (cmd.includes("झुकाव") || cmd.includes("पोस्चर") || cmd.includes("कमर")) {
      generateFeedback("posture");
    } else if (cmd.includes("अभ्यास") || cmd.includes("ड्रिल") || cmd.includes("टिप्स")) {
      generateFeedback("drill");
    } else {
      const fallback = language === "en" 
        ? "I heard: '" + command + "'. Ask me about your score, posture, balance, or drills." 
        : "मैंने सुना: '" + command + "'। आप मुझसे अपने स्कोर, संतुलन, पोस्चर या प्रैक्टिस ड्रिल के बारे में पूछ सकते हैं।";
      setCoachResponse(fallback);
      speakText(fallback);
    }
  };

  const switchLanguage = () => {
    const newLang = language === "en" ? "hi" : "en";
    setLanguage(newLang);
    const welcome = newLang === "en" 
      ? "Language switched to English. How can I help you with your technique today?"
      : "भाषा हिंदी में बदल दी गई है। आज मैं आपकी तकनीक में कैसे मदद कर सकता हूँ?";
    setCoachResponse(welcome);
    speakText(welcome);
  };

  return (
    <>
      {/* Floating AI Coach Circular Trigger Icon */}
      <div className="fixed top-20 right-6 z-40 flex flex-col items-center">
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-full border border-white/20 bg-gray-900/60 backdrop-blur-md flex items-center justify-center text-primary shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:scale-105 active:scale-95 transition-all"
          title="Open AI Coach"
        >
          <Headphones className="w-5 h-5 animate-pulse" />
        </button>
        <span className="text-[9px] font-mono font-bold tracking-widest mt-1 text-orange-400 bg-gray-950/80 px-1.5 py-0.5 rounded border border-white/5 uppercase">
          AI Coach
        </span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            className="fixed top-20 right-20 w-80 z-50 rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur-lg shadow-2xl overflow-hidden font-sans"
          >
            {/* Panel Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gray-950/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <h3 className="font-bold text-xs tracking-wider uppercase text-gray-200">Coach Aryan</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Language Switch Button */}
                <button
                  onClick={switchLanguage}
                  className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold font-mono"
                  title="Switch Language (English / हिन्दी)"
                >
                  <Globe className="w-3.5 h-3.5 text-orange-500" />
                  <span className="uppercase">{language}</span>
                </button>
                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel Body */}
            <div className="p-4 space-y-4">
              {/* Transcript/Message Bubble */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 text-xs text-gray-200 leading-relaxed font-medium min-h-[80px]">
                <p className="text-[10px] text-gray-400 font-mono mb-1 uppercase font-bold tracking-wider">
                  Feedback Verdict
                </p>
                <p className="transition-all duration-300">{coachResponse}</p>
              </div>

              {/* User Voice Input Indicator */}
              {transcript && (
                <div className="text-[11px] font-mono italic text-orange-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-orange-400 animate-ping" />
                  <span>{transcript}</span>
                </div>
              )}

              {/* Suggestions Grid */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider px-1">
                  Ask About
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => generateFeedback("technique")}
                    className="p-2 border border-white/5 bg-white/3 hover:bg-white/5 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-all font-semibold"
                  >
                    🎯 {language === "en" ? "My Technique" : "तकनीक स्कोर"}
                  </button>
                  <button
                    onClick={() => generateFeedback("balance")}
                    className="p-2 border border-white/5 bg-white/3 hover:bg-white/5 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-all font-semibold"
                  >
                    ⚖️ {language === "en" ? "Body Balance" : "शारीरिक संतुलन"}
                  </button>
                  <button
                    onClick={() => generateFeedback("posture")}
                    className="p-2 border border-white/5 bg-white/3 hover:bg-white/5 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-all font-semibold"
                  >
                    📐 {language === "en" ? "Spine & Posture" : "पोस्चर / झुकाव"}
                  </button>
                  <button
                    onClick={() => generateFeedback("drill")}
                    className="p-2 border border-white/5 bg-white/3 hover:bg-white/5 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-all font-semibold"
                  >
                    🏏 {language === "en" ? "Corrective Drill" : "प्रैक्टिस ड्रिल"}
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Footer (Mic Trigger) */}
            <div className="p-3 bg-gray-950/40 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-500">
                {isListening ? "Listening closely..." : "Click microphone to speak"}
              </span>

              <button
                onClick={toggleMic}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all border ${
                  isListening
                    ? "bg-red-500 border-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                    : "bg-orange-500 border-orange-400 hover:scale-105"
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
