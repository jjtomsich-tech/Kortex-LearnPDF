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

  const [coverage, setCoverage] = useState("standard");

  const [adaptation, setAdaptation] = useState("adult");

  const [depth, setDepth] = useState("essentials");

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

      console.log("TEXT LENGTH:", text.length);

      if (!text || text.trim().length < 50) {
        throw new Error("The PDF seems to have too little text to generate a course.");
      }

      let maxChars = 15000;

if (coverage === "xl") {
  maxChars = 45000;
}

if (coverage === "xxl") {
  maxChars = 90000;
}
      
      setIsExtracting(false);
      setIsGenerating(true);

      // 2. Generate Course with Gemini (Frontend)
      let coverageInstructions = "";

      let depthInstructions = "";

      let adaptationInstructions = "";

if (coverage === "standard") {
  coverageInstructions = `
  Coverage Mode: STANDARD

  Create the course using the standard approach.

  Focus on creating a clear and useful learning structure from the available material.

  `;
}

if (coverage === "xl") {
  coverageInstructions = `
  Coverage Mode: XL

  The priority is increasing coverage of the provided source material, not increasing verbosity.

  The provided text segment is the complete available source for this generation.

  Only analyze and transform the information contained in the provided text segment.

  Do not use prior knowledge about the original document.
  Do not reconstruct missing chapters or sections.
  Do not add information from parts of the document that are not included in the provided text.

  Preserve the internal structure of the provided material whenever possible.

  If the provided text contains chapter titles, section titles or numbered parts, preserve them as module or lesson titles whenever appropriate.

  Represent the main topics contained inside the provided text segment.

  Do not merge multiple important sections from the provided material into a single generic summary unless necessary.

  Compression is allowed inside lessons, but do not remove important concepts from the available material.

  Generate the course in the same language as the source document.

  Do not translate unless explicitly requested.
  `;
}

if (coverage === "xxl") {
  coverageInstructions = `
  Coverage Mode: XXL

  The priority is maximizing coverage of the provided source material.

  The provided text segment is the complete available source for this generation.

  Only analyze and transform the information contained in the provided text segment.

  Do not use prior knowledge about the original document.
  Do not reconstruct missing chapters or sections.
  Do not complete the document from memory.

  Preserve the internal structure of the provided material as faithfully as possible.

  If the provided text contains chapter titles, section titles or numbered parts, preserve them as module or lesson titles whenever appropriate.

  Represent all major topics and sections that appear inside the provided text segment.

  Avoid creating broad summaries that combine multiple independent sections.

  Maintain the progression of ideas present in the provided material.

  Compress explanations only when necessary, but never by omitting complete sections that are present in the provided text.

  Generate the course in the same language as the source document.

  Do not translate unless explicitly requested.
  `;
}

if (depth === "essentials") {
  depthInstructions = `
  Depth Mode: ESSENTIALS
The goal is rapid learning and efficient review.
Prioritize only the information that is essential for understanding and remembering the subject.
Produce a concise, practical and highly focused course.
Remove secondary details, repetitions, anecdotes, excessive historical context and non-essential explanations whenever possible.
Compress the material aggressively while preserving the core concepts.
Favor clarity over completeness.
Structure the content so it can be reviewed quickly before an exam or assessment.
Do not generate new ideas, interpretations or reflections.
Do not expand beyond the information contained in the source document unless absolutely necessary for basic comprehension.
The objective is helping the learner understand and remember the most important concepts in the shortest possible time.
  `;
}

if (depth === "academic") {
  depthInstructions = `
  Depth Mode: ACADEMIC
The goal is academic rigor.
Explain concepts using precise terminology and complete definitions.
Preserve conceptual accuracy and formal structure.
Whenever appropriate, include formal examples that improve understanding.
Maintain an educational style equivalent to university-level teaching.
Do not oversimplify concepts merely to reduce length.
Present ideas in a logical progression that supports systematic learning.
Avoid unnecessary creativity or speculation.
Prioritize precision, correctness and educational quality.
  `;
}

if (depth === "insight") {
  depthInstructions = `
  Depth Mode: INSIGHT
The goal is deep understanding rather than memorization.
Go beyond describing concepts.
Explain why each important idea matters.
Identify relationships between concepts throughout the document.
Highlight cause-and-effect relationships whenever appropriate.
Provide historical or conceptual context that improves understanding.
Connect related disciplines whenever those connections naturally emerge from the material.
Help the learner understand not only what the document says, but why the ideas are significant and how they interact.
Do not invent new theories or unsupported conclusions.
Focus on revealing connections already implicit in the source material.
  `;
}

if (depth === "research") {
  depthInstructions = `
  Depth Mode: RESEARCH
The goal is supporting research-oriented reading.
Identify:
- evidence
- hypotheses
- methodologies
- experimental design when applicable
- limitations
- uncertainties
- assumptions
- future research opportunities
Clearly distinguish established evidence from interpretation.
Highlight methodological strengths and weaknesses whenever relevant.
Identify unanswered questions suggested by the document.
Help the learner understand not only the conclusions but also how those conclusions were reached.
Maintain an evidence-oriented and academically rigorous approach.
  `;
}

if (depth === "insightplus") {
  depthInstructions = `
  Depth Mode: INSIGHT+

  The goal is generating new insights inspired by the document.

  The source material should be treated as a starting point for intellectual exploration, not only as content to summarize or explain.

  Explore unexpected connections with other fields whenever meaningful.

  Explore possible consequences of these ideas when they are extended into new contexts.

  Use thought experiments when they help explore the potential meaning or implications of an idea.

  First, explain the original ideas accurately and preserve the meaning of the source material.

  Then expand the intellectual potential of those ideas by exploring their possible implications, connections and applications.

  You may generate:
  - reasonable hypotheses
  - possible applications
  - future possibilities
  - creative interpretations
  - interdisciplinary connections
  - lateral thinking
  - alternative perspectives
  - innovative ideas inspired by the material

  Clearly distinguish between:
  - established facts
  - logical inferences
  - speculative ideas
  - creative proposals

  Never present speculation as established knowledge, but allow creative exploration when it is clearly identified as an inference, possibility or proposal.

  Insight+ expansions should be integrated inside the lessons themselves, not only in final summaries or closing insights.

  Each relevant lesson should combine:
  1. Accurate explanation of the source material.
  2. Deeper understanding of the original ideas.
  3. Additional exploration of new connections, applications, hypotheses or perspectives inspired by the material.

  Prefer concrete expansions over abstract reflections.

  When possible, transform insights into:
  - examples
  - scenarios
  - applications
  - strategies
  - new perspectives

  The purpose is stimulating creativity, expanding possibilities and helping the learner discover ideas that naturally emerge from the document while remaining intellectually honest.
  `;
}

if (depth === "thinker") {
  depthInstructions = `
  Depth Mode: THINKER
The goal is thoughtful reflection.
Do not focus on creativity.
Instead, encourage critical and philosophical thinking.
Explore:
- philosophical implications
- ethical questions
- human consequences
- social impact
- psychological dimensions
- cultural significance
- long-term implications
Whenever appropriate, formulate meaningful questions that encourage reflection.
Do not force definitive answers to every question.
The objective is helping the learner think more deeply about the implications of the knowledge rather than simply acquiring information.
  `;
}

if (depth === "synthesis") {
  depthInstructions = `
  Depth Mode: SYNTHESIS
The goal is conceptual integration.
Treat the available source material as one coherent knowledge system.
Identify the major ideas and show how they connect to one another.
Whenever multiple lessons or concepts share underlying principles, explicitly identify and explain those common patterns.
Integrate concepts that appear in different chapters into a unified conceptual framework.
Reduce fragmentation by emphasizing relationships between ideas.
Construct a coherent mental model of the document.
Do not introduce new knowledge or speculative ideas.
Your task is reorganizing existing knowledge into a clearer and more interconnected structure.
  `;
}

if (depth === "scientific") {
  depthInstructions = `
  Depth Mode: SCIENTIFIC
The goal is assisting scientific work at the highest possible level.
Maintain maximum methodological rigor.
Prioritize evidence quality over narrative simplicity.
Whenever appropriate:
- compare methodologies
- evaluate strength of evidence
- identify knowledge gaps
- distinguish correlation from causation
- identify reproducibility concerns
- connect complementary disciplines
- compare competing explanations
- identify unanswered scientific questions
- suggest testable future research directions
Do not speculate without clearly labeling uncertainty.
Maintain complete scientific neutrality.
Every conclusion should remain proportional to the available evidence.
This mode is intended to support real scientific reasoning rather than simply producing a more technical summary.
  `;
}

if (depth === "analyst") {
  depthInstructions = `
  Depth Mode: ANALYST
The goal is objective analytical evaluation.
Maintain a serious, rigorous and highly neutral tone.
Separate facts from opinions.
Identify arguments and supporting evidence.
Evaluate logical consistency.
Identify assumptions whenever possible.
Point out strengths and weaknesses of arguments presented in the document.
Detect contradictions, inconsistencies or unresolved tensions if they exist.
Avoid emotional language.
Avoid unnecessary creativity.

Always begin by explaining the document faithfully. Then analyze the structure and quality of the reasoning and perform the analytical evaluation.

For each important argument, identify:
- the central claim
- the supporting evidence
- underlying assumptions
- the logical reasoning connecting evidence to conclusions

Evaluate not only what arguments claim, but whether the evidence provided is sufficient to support those conclusions.
Analyze the strength of the reasoning and inferences connecting evidence to claims.

Clearly distinguish:
- observations
- interpretations
- conclusions
- opinions
Also clearly distinguish between:
- The author's own analysis and arguments.
- Logical consequences that follow from the author's ideas.
- Your own analytical evaluation based on logical reasoning and critical analysis.

When appropriate, include a separate analytical evaluation section after explaining the author's ideas.
This section should not summarize the document again. It should provide an independent analysis of:
- argument strength
- evidence quality
- logical consistency
- hidden assumptions
- possible limitations or alternative interpretations.

When appropriate, identify:
- possible counterarguments
- limitations of the reasoning
- alternative explanations
- unsupported generalizations

Evaluate arguments fairly and proportionally.
Critique ideas only when the analysis reveals genuine weaknesses, unsupported assumptions, logical gaps or limitations.
Do not avoid criticism when it is justified by the evidence and reasoning.
The absence of obvious errors does not mean an argument cannot be examined. Analyze the assumptions, scope and limitations of every important claim.
The objective is helping the learner analyze the document critically and objectively.
  `;
}      

if (adaptation === "6-8") {
  adaptationInstructions = `
  Adaptation Mode: 6–8 YEARS OLD

The goal is building intuitive understanding before introducing formal terminology.

Adapt the educational experience for children approximately 6–8 years old.
The learner may have limited reading ability, limited attention span and little prior exposure to formal academic concepts.

The adaptation must preserve the selected Coverage Mode and Depth Mode.
Do not remove important ideas simply because they are difficult.
Instead, make difficult ideas accessible through concrete language, examples, analogies, stories, visualizable situations and simple sequences of reasoning.

Cognitive Approach:

Prioritize:
- simple cause-and-effect relationships
- concrete examples
- short sequences
- familiar categories
- analogies
- imagination
- "what would happen if...?" questions
- observable or everyday situations

Do not rely on prolonged abstract explanations.
When an abstract concept is necessary, first build an intuitive mental model through something concrete and familiar.

Language:

Use:
- very short sentences
- simple vocabulary
- clear syntax
- one main idea per paragraph
- familiar words whenever possible
- concrete verbs and descriptions
- warm, friendly and encouraging language

Introduce technical terms only when they are genuinely important.
When a technical term is necessary, explain it immediately using simple language and a concrete example.

Explanation Structure:

Whenever appropriate, structure explanations progressively:

1. Core idea
2. Concrete example
3. Familiar analogy or comparison
4. Simple explanation of what is happening
5. Small question or thought experiment

Use this structure flexibly rather than mechanically in every paragraph.

Examples and Analogies:

Prefer examples drawn from:
- games
- toys
- school
- family
- animals
- nature
- everyday objects
- simple social situations
- familiar experiences

Use imagination and playful comparisons when they genuinely improve understanding.

Questions:

Use short questions that invite the learner to predict, compare, imagine or reason.

Examples include:
- "What do you think would happen?"
- "Why do you think that happened?"
- "What would change if...?"
- "Which one would you choose?"
- "Can you imagine what this would look like?"

Questions should encourage thinking rather than test the child aggressively.

Pedagogical Tone:

Be:
- warm
- patient
- encouraging
- friendly
- curious
- playful when appropriate
- reassuring

The communication may be intentionally child-friendly and playful.
Stories, imagination, gentle humor and playful analogies are encouraged when they support learning.

However, never assume that simple language means simple thinking.
Do not talk down to the learner, mock them, or imply that difficult ideas are beyond their ability to understand.

Preserve Intellectual Meaning:

Simplify:
- vocabulary
- sentence structure
- initial abstractions
- information density
- explanation complexity

Do not simplify by changing the meaning of the concept, removing essential relationships, inventing false explanations or replacing an important idea with an inaccurate analogy.

When an analogy is imperfect, use it only as an intuitive bridge and make the underlying concept clear.

Adaptation must change the presentation, not the intellectual substance of the selected Depth Mode.

The objective is to help a young learner construct a clear mental model of the subject, develop curiosity and begin reasoning about the ideas independently.
  `;
}

if (adaptation === "9-12") {
  adaptationInstructions = `
  Adaptation Mode: 9–12 YEARS OLD

The goal is developing clear conceptual understanding while encouraging curiosity and independent reasoning.

Adapt the educational experience for learners approximately 9–12 years old.
At this stage, the learner can begin working directly with concepts, explanations and simple forms of abstraction, while still benefiting from concrete examples and familiar contexts.

The adaptation must preserve the selected Coverage Mode and Depth Mode.
Do not remove important ideas because they are complex.
Instead, make them cognitively accessible through clear explanations, concrete examples, comparisons, progressive reasoning and appropriate scaffolding.

Cognitive Approach:

The learner can work with:
- chains of cause and effect
- classifications and categories
- comparisons
- simple hypotheses
- step-by-step explanations
- relationships between multiple ideas
- basic abstract concepts when supported by examples

Move beyond purely intuitive explanations when the subject requires conceptual understanding.
Do not explain everything through analogies if the actual concept can be taught clearly.

Language:

Use:
- clear and accessible language
- relatively simple syntax
- familiar vocabulary whenever possible
- precise explanations
- moderate sentence length
- technical terminology when useful and appropriate

Technical terms may be introduced more directly than for younger learners.
When a technical term is important, define it clearly and connect it to an example or previously understood idea.

Explanation Structure:

Whenever appropriate, organize explanations progressively:

1. Concept
2. Explanation
3. Concrete example
4. Comparison or connection to something familiar
5. Curiosity or interesting implication
6. Open question

Use this structure flexibly rather than mechanically.

Examples and Comparisons:

Prefer examples from:
- school
- everyday life
- science and nature
- technology
- games
- history
- familiar social situations
- age-appropriate current contexts

Use analogies and comparisons when they clarify a difficult idea, but gradually reduce dependence on them as the learner becomes capable of understanding the concept directly.

Curiosity Hooks:

When genuinely relevant, introduce brief curiosity hooks such as:

"Did you know...?"
"Here's something surprising..."
"An interesting consequence is..."

Use these only when they improve understanding, reveal an important implication, connect ideas or motivate further investigation.

Do not turn lessons into collections of trivia.
Curiosity should support learning rather than distract from the main concept.

Questions and Reasoning:

Encourage the learner to:
- predict outcomes
- compare explanations
- identify causes and effects
- formulate simple hypotheses
- notice patterns
- explain why something happens
- consider alternative possibilities

Use questions such as:
- "Why do you think this happens?"
- "What would happen if...?"
- "Which explanation makes more sense?"
- "What evidence would help us decide?"
- "Can you think of another example?"

Questions should encourage genuine reasoning rather than simply checking whether the learner remembers a fact.

Pedagogical Tone:

Be:
- clear
- encouraging
- curious
- engaging
- respectful
- appropriately playful

Use light humor or culturally familiar references when they genuinely improve engagement or understanding, but do not force an artificial "kid" voice.

Do not speak to the learner as if they were much younger than their developmental level.

Preserve Intellectual Meaning:

Simplify:
- unnecessary vocabulary complexity
- sentence structure
- excessive information density
- unexplained abstraction

Do not simplify by changing the meaning of a concept, removing essential relationships, inventing explanations or replacing accurate reasoning with misleading analogies.

When an analogy is imperfect, treat it as a bridge toward the real concept rather than as the concept itself.

Adaptation must change the presentation, scaffolding and accessibility of the material, not the intellectual substance of the selected Depth Mode.

The objective is to help the learner build a clear conceptual model, become comfortable with increasingly abstract ideas, develop curiosity and begin reasoning independently about what they learn.
  `;
}

if (adaptation === "12-15") {
  adaptationInstructions = `
Adaptation Mode: 12–15 YEARS OLD

The goal is connecting increasingly abstract concepts with familiar contemporary experiences while encouraging independent thought, recognition and discovery.

Adapt the educational experience for learners approximately 12–15 years old.

At this stage, learners can work with:
- moderate abstraction
- contradictions and tensions
- hypotheses
- multiple perspectives
- causal chains
- increasingly complex social and conceptual relationships

Do not reduce the intellectual complexity of the selected Depth Mode.
Make complex ideas accessible through recognizable experiences, contemporary contexts, concrete examples, memorable representations and clear conceptual scaffolding.

Language:

Use:
- natural contemporary language
- clear and precise explanations
- moderate abstraction
- vocabulary appropriate for teenagers
- a conversational but intellectually serious tone

Do not deliberately imitate teenage slang or speak as a caricature of a teenager.

Speak naturally to teenagers rather than trying to sound like a teenager.

Examples and Contemporary Contexts:

Actively connect important concepts to experiences and situations that learners aged 12–15 are likely to recognize.

Use relevant contexts such as:
- arguments with friends
- misunderstandings in chats
- group projects
- school situations
- social media interactions
- gaming
- competition
- embarrassment
- wanting approval
- being criticized
- making mistakes
- trying to convince someone
- conflicts with parents, teachers or friends
- situations involving behavior the learner may recognize in themselves

Also use:
- technology
- internet culture
- games
- science
- media
- current cultural phenomena
- everyday experiences
- familiar contemporary situations

When a concept describes a familiar human behavior, connect the concept directly to a recognizable real-life situation before or during the explanation.

Prefer examples that can produce a recognition reaction such as:
"I know this feeling."
"I have done this."
"That actually happens to me."
"I have seen this before."

The purpose is to create a sense of discovery: the learner should sometimes recognize that an abstract concept describes something they already experience in everyday life.

Do not use contemporary references merely as decoration. Their purpose is to provide an intuitive entry point, clarify the concept, create recognition, or make the idea more memorable.

Conceptual Accessibility:

Do not assume that learners aged 12–15 will automatically understand abstract, academic or professional language simply because they can handle moderate abstraction.

When an idea is abstract, unfamiliar or conceptually dense, first anchor it in something the learner can recognize.

Use:
- familiar situations
- contemporary contexts
- humorous comparisons
- visual metaphors
- cultural references
- meme-like scenarios
- memorable examples
- recognizable social situations

These representations should function as vehicles for the concept, not replacements for the concept.

The learner should be able to move from:
recognizable experience → intuitive understanding → conceptual explanation → more abstract understanding.

Do not remove important complexity simply to make the explanation easier.

Humor, Memes and Memorable Learning:

Use humor, playful framing, memes or meme-like structures when they can make an important concept easier to notice, understand or remember.

Do not treat humor as decoration. Use it as a learning mechanism.

When a humorous or meme-like representation fits naturally with the concept, prefer it over a generic example when it produces a stronger cognitive or emotional connection.

Memes may function as:
- memorable representations of an idea
- contrasts
- humorous analogies
- compressed explanations
- recognizable social situations
- cognitive shortcuts
- conceptual hooks

A particularly effective meme, joke, comparison or humorous scenario may be used to create a memorable "aha" moment.

The learner should sometimes feel that they are encountering an entertaining or recognizable situation while simultaneously learning the underlying concept.

Humor must not replace conceptual accuracy.
When a meme, analogy or joke is imperfect, preserve the distinction between the representation and the actual concept.

Memorability and Discovery:

Important concepts should be presented in ways that make them easy to recognize and remember.

Whenever a concept has a strong connection to everyday adolescent experience, make that connection visible.

Prefer explanations that create moments of:
"Wait, I do that."
"So that's why that happens."
"I never thought about it that way."
"That's exactly what happens online."
"I've seen this before."

These moments should emerge from the relationship between the learner's experience and the concept being taught, not from artificial enthusiasm.

Explanation Structure:

For important concepts, prefer a progression such as:

recognizable experience → concept → explanation → contemporary example → comparison, humor or cultural connection → deeper implication → question

When appropriate, begin with the recognizable situation rather than introducing the formal concept first.

Do not apply this sequence mechanically to every paragraph. Use it as the preferred architecture for important concepts.

Independent Thinking:

Encourage learners to:
- question assumptions
- compare perspectives
- identify contradictions
- propose hypotheses
- predict consequences
- connect ideas
- explain their reasoning
- consider alternative interpretations

Questions should increasingly require reasoning rather than simple recall.

Whenever possible within the selected Depth Mode, use questions that connect the concept back to the learner's own experiences.

Pedagogical Tone:

Be:
- engaging
- natural
- respectful
- curious
- intellectually stimulating
- occasionally playful
- warm without becoming childish

Avoid both extremes:
- overly childish communication
- artificially adult or academic communication

The learner should feel that the material is written for someone their age who is capable of thinking seriously, not for a younger child and not for an adult professional.

Preserve Intellectual Meaning:

Do not simplify concepts by removing important complexity, contradictions or uncertainty.

Simplify presentation when necessary, not the underlying intellectual content.

Do not change conclusions, reasoning, evidence or conceptual relationships produced by the selected Depth Mode.

When an analogy, meme or cultural reference is imperfect, make sure the learner can distinguish the analogy from the actual concept.

The objective is to make sophisticated ideas accessible, recognizable, engaging and memorable while helping the learner develop independent thought and increasingly abstract reasoning.

The ideal result is that the learner can understand a serious concept while feeling that it emerged naturally from something familiar, interesting, funny or personally recognizable.
  `;
}

if (adaptation === "15-18") {
  adaptationInstructions = `
  Adaptation Mode: 15–18 YEARS OLD

The goal is developing mature conceptual understanding, critical thinking and practical transfer.

Adapt the educational experience for learners approximately 15–18 years old.

At this stage, learners can work comfortably with:
- abstract concepts
- moderately technical language
- complex arguments
- evidence and reasoning
- counterarguments
- multiple perspectives
- theoretical models
- real-world applications
- increasingly independent analysis

Do not unnecessarily simplify ideas that can be understood through a normal explanation.
The adaptation should make the material accessible and engaging without reducing its intellectual complexity.

Language:

Use:
- natural and mature language
- precise terminology
- moderately technical vocabulary
- clear and well-structured explanations
- language appropriate for advanced secondary education

Introduce technical terminology directly when it is useful, explaining it when necessary rather than avoiding it automatically.

Do not imitate teenage slang or deliberately make the language sound youthful.
The tone should feel contemporary and natural, not artificially "teenage".

Explanation:

Prefer direct conceptual explanations.

Use examples, analogies and comparisons when they genuinely clarify a difficult idea, but do not over-explain concepts that can be understood directly.

Avoid turning every concept into multiple analogies, stories or simplified explanations.

When appropriate, structure explanations as:

concept → explanation → evidence or example → implications → application → question

Use this structure flexibly rather than mechanically.

Critical Thinking:

Encourage learners to:
- examine assumptions
- compare explanations
- evaluate evidence
- identify contradictions
- consider counterarguments
- distinguish claims from evidence
- reason about consequences
- transfer concepts to unfamiliar situations
- form and defend their own conclusions

Questions should increasingly require analysis, evaluation and independent reasoning rather than recall.

Practical Transfer:

Whenever appropriate, connect knowledge to:
- real-world situations
- contemporary issues
- technology
- science
- education
- work
- society
- personal decision-making

Show how a concept can be applied beyond the immediate material.

Conceptual Memorability:

When appropriate, deliberately create memorable representations of important ideas.

Use concise images, metaphors, humorous contrasts, memorable phrases, surprising comparisons or culturally recognizable formats that allow a complex concept to become mentally "sticky".

The goal is not merely to make the lesson entertaining, but to create a memorable mental representation that allows the learner to recall the underlying concept later, even after leaving the lesson.

Prioritize memorability when it can be achieved without sacrificing accuracy.

Humor and Cultural References:

Humor, contemporary references and occasional meme-like formats may be used when they genuinely improve comprehension, memorability or engagement.

Use them selectively and naturally.

Do not force cultural references or humor into the material.

Pedagogical Tone:

Be:
- mature
- clear
- intellectually engaging
- respectful
- direct
- curious
- occasionally playful when appropriate

Avoid both unnecessary simplification and unnecessary academic density.

Preserve Intellectual Meaning:

Do not remove important complexity, uncertainty, competing interpretations or difficult ideas merely because they require more thought.

Simplify presentation only when doing so improves clarity.

Do not replace rigorous explanations with analogies when precision is required.

The objective is to provide an increasingly mature learning experience that prepares the learner to understand, analyze and apply knowledge with a level of independence approaching university-level learning.
  `;
}

if (adaptation === "18-21") {
  adaptationInstructions = `
  Adaptation Mode: 18–21 YEARS OLD

The goal is supporting independent learning at an early university level.

Adapt the educational experience for learners approximately 18–21 years old.

At this stage, learners can work with:
- specialized terminology
- abstract concepts
- formal reasoning
- complex arguments
- theoretical frameworks
- specialized concepts
- evidence and competing interpretations
- complete explanations
- independent analysis

Do not simplify concepts merely because they are complex.
Assume that the learner is capable of engaging directly with intellectually demanding material.

Language:

Use:
- natural adult language
- precise terminology
- specialized vocabulary when appropriate
- complete and logically structured explanations
- academically appropriate language

Technical terminology should generally be introduced directly when relevant.
Define specialized terms when necessary for comprehension, but do not avoid them simply because they increase difficulty.

Explanation:

Prioritize clear, complete explanations over simplification.

Use:
- conceptual context
- examples
- comparisons
- connections between ideas
- applications
- implications

When appropriate, structure explanations as:

concept → context → explanation → evidence/example → connections → implications → application

Use this structure flexibly rather than mechanically.

Independent Learning:

Support the learner in understanding material without requiring constant simplification or guidance.

Encourage learners to:
- follow multi-step reasoning
- evaluate evidence
- compare theoretical perspectives
- identify assumptions
- formulate interpretations
- recognize uncertainty
- connect concepts across different parts of the material
- apply knowledge to unfamiliar situations
- develop their own conclusions

Questions should promote analysis, synthesis and independent reasoning rather than simple recall.

Conceptual Memorability:

When appropriate, create memorable representations of particularly important or difficult ideas.

Use concise metaphors, striking comparisons, conceptual contrasts, thought experiments or memorable formulations when they genuinely improve understanding or later recall.

Do not force memorability techniques into explanations that are already clear.

The objective is durable understanding, not entertainment.

Contextualization:

When useful, connect concepts to:
- academic disciplines
- contemporary contexts
- professional applications
- real-world problems
- historical development
- related theories or concepts

Use contextualization to deepen understanding rather than merely make the material more accessible.

Pedagogical Tone:

Be:
- mature
- precise
- intellectually serious
- clear
- independent-learning oriented
- engaging without being artificially casual

Do not use childish language, forced humor, teenage slang or unnecessary simplification.

Preserve Intellectual Meaning:

Preserve the complexity, uncertainty, nuance and technical precision of the source material.

Do not remove difficult concepts merely because they require sustained attention.

Simplify only when necessary to improve clarity, not to reduce intellectual demands.

The objective is to help the learner engage with knowledge at an early university level and increasingly take responsibility for understanding, questioning and applying what they learn.
  `;
}

if (adaptation === "adult") {
  adaptationInstructions = `
  Adaptation Mode: ADULT / PROFESSIONAL

The goal is optimizing learning for efficient acquisition, retention and application of knowledge.

Adapt the educational experience for adult learners and professionals.

Do not assume that the learner wants maximum depth simply because they are an adult.
The learner may be studying to:
- perform a task at work
- solve a specific problem
- acquire a skill quickly
- update existing knowledge
- make an informed decision
- understand a subject before applying it
- pursue personal intellectual interest

Optimize the presentation according to the practical relationship between knowledge and the learner's likely goal.

Language:

Use:
- natural adult language
- precise terminology
- professional vocabulary when appropriate
- concise but complete explanations
- high information density without sacrificing clarity

Do not simplify terminology unnecessarily.
Do not add explanations merely for the sake of length.

Efficiency:

Prioritize high-value information.

Reduce:
- unnecessary repetition
- decorative explanations
- excessive analogies
- redundant examples
- unnecessary introductory material

When a concept can be explained clearly in a few sentences, do so.

Do not confuse brevity with superficiality.
Important complexity, conditions, exceptions and uncertainty must remain when they affect understanding or application.

Knowledge Structure:

When appropriate, organize information around:

concept → relevance → mechanism → application → example/case → implications → decision or action

Use the structure flexibly according to the material.

Practical Application:

Whenever appropriate, connect knowledge to:
- real-world problems
- professional situations
- procedures
- decisions
- workflows
- case studies
- tools
- strategies
- measurable outcomes

Show not only what something means, but how the knowledge can be used.

Frameworks and Procedures:

When the source material contains processes, methods, frameworks, rules or decision criteria, make them explicit and easy to apply.

Prefer actionable structures such as:
- steps
- checklists
- decision criteria
- frameworks
- comparisons
- trade-offs
- cause-and-effect relationships
- practical examples

Do not invent procedures or recommendations that are not supported by the source material.

Retention:

Use concise summaries, memorable formulations, conceptual contrasts or practical examples when they improve retention.

Prioritize durable understanding over decorative memorability.

Critical and Strategic Thinking:

When relevant, help the learner identify:
- assumptions
- risks
- limitations
- trade-offs
- competing options
- consequences
- uncertainty
- conditions under which an idea may or may not apply

Do not turn every topic into a critical analysis unless required by the selected Depth Mode.

Context:

Prefer context that helps the learner understand why the information matters and where it can be applied.

When the learner's practical objective is clear from the source material, prioritize information most relevant to that objective.

When no practical objective is apparent, maintain a balanced presentation suitable for independent adult learning.

Pedagogical Tone:

Be:
- direct
- professional
- clear
- efficient
- intellectually respectful
- context-aware

Avoid childish language, forced enthusiasm, unnecessary humor and artificial simplification.

Preserve Intellectual Meaning:

Do not reduce complexity merely to make the material faster to consume.

Preserve important nuance, uncertainty, evidence, exceptions and competing interpretations.

The objective is to minimize unnecessary friction between the learner and the knowledge while preserving enough depth and structure for accurate understanding, retention and effective application.
  `;
}      

if (adaptation === "natural") {
  adaptationInstructions = `
    Adaptation Mode: NATURAL

    Preserve the natural presentation style produced by the selected Coverage and Depth Modes.

    Do not adapt the language, vocabulary, examples, structure, tone or complexity for a specific age group or professional context.

    Allow the selected Depth and Coverage Modes to determine the educational presentation naturally.

    Do not introduce additional pedagogical simplification, personalization or contextual framing beyond what is required by the selected Coverage and Depth Modes.
  `;
}      
      
      const prompt = `
        You are an expert educator specialized in transforming source material into effective learning experiences.

        Your task is to transform the following text extracted from a PDF into a structured interactive learning course.

        Follow the provided schema strictly.

        Text Content:
        ${text.substring(0, maxChars)}

        Configuration Modes:

        The generated course must follow these configuration modes.

        Coverage Mode:
        ${coverageInstructions}

        Depth Mode:
        ${depthInstructions}

        Adaptation Mode:
        ${adaptationInstructions}

        These modes define HOW the educational transformation should be performed.

        The course generation is controlled by multiple independent dimensions.

        Each dimension modifies a different aspect of the learning experience.

        Do not let one dimension replace another.
        Combine all selected modes together.

        Coverage controls the amount and distribution of source material represented.

        Depth controls the intellectual processing, explanation style and learning approach.

        Adaptation controls how the resulting knowledge is communicated according to the learner's developmental level.

        Do not ignore these modes.
        They are core parameters of the course generation process.

        General Course Requirements:

        - Create a logical learning progression.
        - Adapt explanations according to the selected Depth Mode.
        - Preserve the intended Coverage Mode.
        - Lessons should be detailed but scannable.
        - Flashcards should cover key terms and concepts.
        - Quiz should test understanding of the main points.
        - Highlights should summarize important ideas.
        - Final insights should reflect the selected Depth Mode.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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

  const downloadHTML = () => {
  if (!course) return;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${course.course_title}</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #0f0f0f;
  color: white;
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 250px;
  background: #1a1a1a;
  padding: 20px;
  overflow-y: auto;
  border-right: 1px solid #333;
}

.sidebar h2 {
  font-size: 16px;
  margin-bottom: 10px;
}

.lesson {
  font-size: 13px;
  margin: 5px 0;
  cursor: pointer;
  color: #aaa;
}

.lesson:hover {
  color: white;
}

.content {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.title {
  font-size: 24px;
  margin-bottom: 10px;
}

.text {
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
</head>

<body>

<div class="sidebar">
  ${course.modules.map((m, mIdx) => `
    <h2>${m.title}</h2>
    ${m.lessons.map((l, lIdx) => `
      <div class="lesson" onclick="loadLesson(${mIdx}, ${lIdx})">
        ${l.title}
      </div>
    `).join("")}
  `).join("")}
</div>

<div class="content">
  <div class="title" id="title"></div>
  <div class="text" id="content"></div>
</div>

<script>
const course = ${JSON.stringify(course)};

function loadLesson(mIdx, lIdx) {
  const lesson = course.modules[mIdx].lessons[lIdx];
  document.getElementById("title").innerText = lesson.title;
  document.getElementById("content").innerText = lesson.content;
}

// default
loadLesson(0,0);
</script>

</body>
</html>
`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "course.html";
  a.click();

  URL.revokeObjectURL(url);
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
        <span className="text-lg font-bold tracking-tight">
          Kortex: LearnPDF
        </span>
      </div>

      <div className="flex items-center gap-4">

        {file && !course && (
          <div className="text-[12px] color-[#22C55E] bg-[#22C55E]/10 px-[10px] py-[4px] rounded-[12px] flex items-center gap-[6px]">
            <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
            PDF Ready: {file.name}
          </div>
        )}

        {course && (
          <div className="flex items-center gap-2">
            
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
            >
              New Course
            </button>

            <button 
              onClick={downloadHTML}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              Download
            </button>

          </div>
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
              
<div className="mt-8 text-left">
  <label className="block text-sm font-semibold mb-2">
  Coverage
  </label>

  <select
    value={coverage}
    onChange={(e) => setCoverage(e.target.value)}
    className="w-full bg-surface border border-border rounded-xl px-4 py-3"
  >
    <option value="standard">Standard (≈15 pages)</option>
    <option value="xl">XL (≈50 pages)</option>
    <option value="xxl">XXL (≈100 pages)</option>
  </select>
</div>

<div className="mt-8 text-left">
  <label className="block text-sm font-semibold mb-2">
    Depth
  </label>

  <select
    value={depth}
    onChange={(e) => setDepth(e.target.value)}
    className="w-full bg-surface border border-border rounded-xl px-4 py-3"
  >
    <option value="essentials">Essentials</option>
    <option value="academic">Academic</option>
    <option value="insight">Insight</option>
    <option value="research">Research</option>
    <option value="insightplus">Insight+</option>
    <option value="thinker">Thinker</option>
    <option value="synthesis">Synthesis</option>
    <option value="scientific">Scientific (Beta)</option>
    <option value="analyst">Analyst</option>
  </select>
</div>              

<div className="mt-8 text-left">
  <label className="block text-sm font-semibold mb-2">
    Adaptation
  </label>

  <select
    value={adaptation}
    onChange={(e) => setAdaptation(e.target.value)}
    className="w-full bg-surface border border-border rounded-xl px-4 py-3"
  >
    <option value="natural">Natural/Neutral</option>
    <option value="6-8">6–8 años</option>
    <option value="9-12">9–12 años</option>
    <option value="12-15">12–15 años</option>
    <option value="15-18">15–18 años</option>
    <option value="18-21">18–21 años</option>
    <option value="adult">Adulto / Profesional</option>
  </select>
</div>
              
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
              <div className="mt-6 text-center">
  <p className="text-xs text-text-secondary mb-2">
    Buy me a coffee ☕
  </p>

  <a
    href="https://link.mercadopago.com.ar/kortexapps"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:opacity-90 transition"
  >
    Support Kortex
  </a>
</div>

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
