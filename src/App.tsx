import React, { useState, useRef } from "react";
import { 
  Upload, 
  BookOpen, 
  Brain, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Lightbulb, 
  Loader2, 
  PlayCircle, 
  RefreshCw, 
  Sparkles,
  Trophy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from "@/src/lib/utils";
import { Course, Module, Lesson, Flashcard, QuizQuestion } from "./types";

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const COURSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    course_title: { type: Type.STRING },
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ["title", "content", "summary"],
            },
          },
        },
        required: ["title", "lessons"],
      },
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ["question", "answer"],
      },
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correct_answer: { type: Type.STRING },
        },
        required: ["question", "options", "correct_answer"],
      },
    },
    highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    final_insights: { type: Type.STRING },
  },
  required: ["course_title", "modules", "flashcards", "quiz", "highlights", "final_insights"],
};

// --- Components ---

const FlashcardComponent: React.FC<{ card: Flashcard }> = ({ card }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="perspective-1000 w-full h-36 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full transition-all duration-500 preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-bg border border-dashed border-accent rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <p className="text-text-primary font-medium text-sm leading-relaxed">{card.question}</p>
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider mt-3">Click to Flip</span>
        </div>
        {/* Back */}
        <div 
          className="absolute inset-0 backface-hidden bg-surface border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm rotate-y-180"
        >
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Answer</span>
          <p className="text-text-primary text-sm leading-relaxed">{card.answer}</p>
        </div>
      </motion.div>
    </div>
  );
};

const QuizComponent = ({ quiz }: { quiz: QuizQuestion[] }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const handleOptionSelect = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);
    if (option === quiz[currentQuestion].correct_answer) {
      setScore(score + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
    } else {
      setShowResult(true);
    }
  };

  if (showResult) {
    return (
      <div className="bg-bg border border-border rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Trophy className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1">Quiz Completed!</h3>
        <p className="text-sm text-text-secondary mb-4">You scored {score} out of {quiz.length}</p>
        <button 
          onClick={() => {
            setCurrentQuestion(0);
            setSelectedOption(null);
            setShowResult(false);
            setScore(0);
          }}
          className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Retake Quiz
        </button>
      </div>
    );
  }

  const question = quiz[currentQuestion];

  return (
    <div className="bg-bg border border-border rounded-xl p-5">
      <div className="quiz-question text-[13px] font-semibold text-text-primary mb-3 leading-relaxed">
        {question.question}
      </div>
      <div className="space-y-2 mb-4">
        {question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleOptionSelect(option)}
            disabled={!!selectedOption}
            className={cn(
              "w-full text-left p-3 rounded-lg border text-xs transition-all duration-200",
              !selectedOption && "border-border hover:border-accent hover:bg-accent-soft text-text-secondary",
              selectedOption === option && option === question.correct_answer && "border-green-500 bg-green-500/10 text-green-400",
              selectedOption === option && option !== question.correct_answer && "border-red-500 bg-red-500/10 text-red-400",
              selectedOption && option === question.correct_answer && "border-green-500 bg-green-500/10 text-green-400"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {selectedOption && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={nextQuestion}
          className="w-full py-2 bg-text-primary text-bg rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
        >
          {currentQuestion === quiz.length - 1 ? "Finish Quiz" : "Next Question"}
        </motion.button>
      )}
    </div>
  );
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<{ mIdx: number; lIdx: number } | null>(null);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const generateCourse = async () => {
    if (!file) return;

    try {
      setIsExtracting(true);
      setError(null);

      // 1. Extract Text
      const formData = new FormData();
      formData.append("pdf", file);

      const extractRes = await fetch("https://kortex-backend-j3is.onrender.com/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await extractRes.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to extract text from PDF");
      }
      
      const { text } = result.data;

      if (!text || text.trim().length < 50) {
        throw new Error("The PDF seems to have too little text to generate a course.");
      }

      setIsExtracting(false);
      setIsGenerating(true);

      // 2. Generate Course with Gemini (Frontend)
      const prompt = `
        You are an expert educator. Transform the following text extracted from a PDF into a structured interactive learning course.
        Follow the provided schema strictly.
        
        Text Content:
        ${text.substring(0, 15000)}
        
        Requirements:
        - Create a logical flow of modules and lessons.
        - Lessons should be detailed but scannable.
        - Flashcards should cover key terms and concepts.
        - Quiz should test understanding of the main points.
        - Highlights should be punchy bullet points.
        - Final insights should summarize the core value of the material.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: COURSE_SCHEMA,
        },
      });

      const courseData = JSON.parse(response.text || "{}");

      setCourse(courseData);
      setActiveLesson({ mIdx: 0, lIdx: 0 });
      setExpandedModules([0]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsExtracting(false);
      setIsGenerating(false);
    }
  };

  const toggleModule = (idx: number) => {
    setExpandedModules(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans selection:bg-accent/30 selection:text-white flex flex-col">
      {/* Header */}
      <header className="h-[60px] sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-accent rounded-[4px] flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Kortex: LearnPDF</span>
        </div>
        <div className="flex items-center gap-4">
          {file && !course && (
            <div className="text-[12px] color-[#22C55E] bg-[#22C55E]/10 px-[10px] py-[4px] rounded-[12px] flex items-center gap-[6px]">
              <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
              PDF Ready: {file.name}
            </div>
          )}
          {course && (
            <button 
              onClick={() => {
                setCourse(null);
                setFile(null);
                setActiveLesson(null);
              }}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Course
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!course ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center py-24 px-6"
            >
              <div className="mb-10">
                <h1 className="text-5xl font-extrabold tracking-tight text-text-primary mb-5">
                  Knowledge <span className="text-accent">Transformed</span>
                </h1>
                <p className="text-lg text-text-secondary leading-relaxed max-w-lg mx-auto">
                  Upload any PDF and let AI convert it into a structured, interactive learning system.
                </p>
              </div>

              <div 
                className={cn(
                  "relative group cursor-pointer border border-dashed rounded-2xl p-16 transition-all duration-300",
                  file ? "border-accent bg-accent-soft" : "border-border hover:border-accent/50 hover:bg-surface"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110",
                    file ? "bg-accent text-white" : "bg-surface text-text-secondary"
                  )}>
                    {file ? <FileText className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
                  </div>
                  <h3 className="text-base font-bold text-text-primary mb-1">
                    {file ? file.name : "Select a PDF"}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Drag and drop your file here"}
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                  {error}
                </div>
              )}

              <button
                disabled={!file || isExtracting || isGenerating}
                onClick={generateCourse}
                className="mt-10 w-full py-4 bg-accent text-white rounded-xl font-bold text-base shadow-lg shadow-accent/10 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
              >
                {(isExtracting || isGenerating) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isExtracting ? "Extracting..." : "Generating Course..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Course
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="course"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-[260px_1fr_280px] h-full overflow-hidden"
            >
              {/* Sidebar: Modules */}
              <aside className="border-r border-border p-6 overflow-y-auto">
                <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-4">Modules</div>
                <div className="space-y-1">
                  {course.modules.map((module, mIdx) => (
                    <div key={mIdx} className="space-y-1">
                      <button 
                        onClick={() => toggleModule(mIdx)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-md text-[13px] transition-colors",
                          expandedModules.includes(mIdx) ? "text-text-primary" : "text-text-secondary hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            expandedModules.includes(mIdx) ? "bg-accent shadow-[0_0_8px_var(--color-accent)]" : "bg-text-secondary opacity-50"
                          )} />
                          <span className="font-medium text-left truncate">{module.title}</span>
                        </div>
                        {expandedModules.includes(mIdx) ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                      <AnimatePresence>
                        {expandedModules.includes(mIdx) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pl-6 space-y-0.5"
                          >
                            {module.lessons.map((lesson, lIdx) => (
                              <button
                                key={lIdx}
                                onClick={() => setActiveLesson({ mIdx, lIdx })}
                                className={cn(
                                  "w-full text-left py-1.5 text-[12px] transition-all truncate",
                                  activeLesson?.mIdx === mIdx && activeLesson?.lIdx === lIdx 
                                    ? "text-accent font-bold" 
                                    : "text-text-secondary hover:text-text-primary"
                                )}
                              >
                                {lesson.title}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-4 mt-10">Progress</div>
                <div className="h-1 bg-border rounded-full w-full relative mb-2">
                  <div 
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: "45%" }}
                  />
                </div>
                <div className="text-[11px] text-text-secondary">45% Complete</div>
              </aside>

              {/* Content Area */}
              <section className="content-gradient p-10 overflow-y-auto">
                {activeLesson && (
                  <motion.article 
                    key={`${activeLesson.mIdx}-${activeLesson.lIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                  >
                    <div className="mb-8">
                      <span className="text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-[4px] uppercase mb-3 inline-block">
                        MODULE {activeLesson.mIdx + 1}
                      </span>
                      <h1 className="text-[32px] font-bold text-text-primary tracking-[-0.03em] mb-2 leading-tight">
                        {course.modules[activeLesson.mIdx].lessons[activeLesson.lIdx].title}
                      </h1>
                      <p className="text-sm text-text-secondary">
                        {course.modules[activeLesson.mIdx].lessons[activeLesson.lIdx].summary}
                      </p>
                    </div>

                    <div className="lesson-body text-[15px] leading-[1.6] text-text-secondary space-y-6 whitespace-pre-wrap">
                      {course.modules[activeLesson.mIdx].lessons[activeLesson.lIdx].content}
                    </div>

                    <div className="bg-[#1C1917] border-l-[3px] border-[#F59E0B] p-5 rounded-[4px] italic my-8 text-sm text-[#FDE68A]">
                      "{course.final_insights.split('.')[0]}."
                    </div>
                  </motion.article>
                )}
              </section>

              {/* Right Panel: Widgets */}
              <aside className="border-l border-border bg-surface p-6 overflow-y-auto flex flex-col gap-8">
                <div>
                  <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-4">Flashcard</div>
                  <div className="bg-bg border border-border rounded-xl p-4">
                    {course.flashcards.length > 0 && (
                      <FlashcardComponent card={course.flashcards[0]} />
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-4">Knowledge Check</div>
                  <QuizComponent quiz={course.quiz} />
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em] mb-4">AI Insights</div>
                  <div className="text-[12px] leading-[1.5] text-text-secondary space-y-3">
                    {course.highlights.slice(0, 3).map((h, i) => (
                      <p key={i}>• {h}</p>
                    ))}
                  </div>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
